import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MARKETPLACE_API = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface UserExtension {
  id: string;
  name: string;
  publisher: string;
  categories: string[];
}

interface Recommendation {
  extensionId: string;
  extensionName: string;
  publisher: string;
  trustScore: number;
  recommendationType: 'alternative' | 'complementary' | 'trending' | 'must_have' | 'security_upgrade';
  reason: string;
  confidenceScore: number;
  basedOn: string[];
  downloads: number;
  rating: number;
}

interface UserProfile {
  userId: string;
  installedExtensions: string[];
  preferredCategories: string[];
  techStack: string[];
}

async function fetchUserExtensions(extensionIds: string[]): Promise<UserExtension[]> {
  if (extensionIds.length === 0) return [];

  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          ...extensionIds.map(id => ({ filterType: 7, value: id })),
        ],
        pageNumber: 1,
        pageSize: extensionIds.length,
        sortBy: 0,
        sortOrder: 0,
      },
    ],
    assetTypes: [],
    flags: 914,
  };

  const resp = await fetch(MARKETPLACE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;api-version=6.0-preview.1",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    console.error("Marketplace API error:", resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  const extensions = data.results?.[0]?.extensions || [];
  
  return extensions.map((ext: any) => ({
    id: `${ext.publisher.publisherName}.${ext.extensionName}`,
    name: ext.displayName,
    publisher: ext.publisher.displayName,
    categories: ext.categories || [],
  }));
}

async function fetchTrendingExtensions(categories: string[]): Promise<any[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 5, value: "trending" }, // Trending filter
          ...categories.map(cat => ({ filterType: 1, value: cat })),
        ],
        pageNumber: 1,
        pageSize: 10,
        sortBy: 4, // Sort by trending
        sortOrder: 0,
      },
    ],
    assetTypes: [],
    flags: 914,
  };

  const resp = await fetch(MARKETPLACE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;api-version=6.0-preview.1",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    console.error("Marketplace API error:", resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  return data.results?.[0]?.extensions || [];
}

async function fetchCategoryExtensions(category: string): Promise<any[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 1, value: category },
        ],
        pageNumber: 1,
        pageSize: 20,
        sortBy: 4, // Sort by trending
        sortOrder: 0,
      },
    ],
    assetTypes: [],
    flags: 914,
  };

  const resp = await fetch(MARKETPLACE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;api-version=6.0-preview.1",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    console.error("Marketplace API error:", resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  return data.results?.[0]?.extensions || [];
}

function getStat(ext: any, name: string): number {
  return ext.statistics?.find((s: any) => s.statisticName === name)?.value || 0;
}

function calculateTrustScore(ext: any): number {
  const downloads = getStat(ext, "install");
  const rating = getStat(ext, "averagerating");
  const publisherVerified = ext.publisher?.isDomainVerified || false;
  
  let score = 0;
  
  // Publisher verification
  if (publisherVerified) score += 20;
  
  // Downloads
  if (downloads > 1000000) score += 20;
  else if (downloads > 100000) score += 15;
  else if (downloads > 10000) score += 10;
  else if (downloads > 1000) score += 5;
  
  // Rating
  if (rating >= 4.5) score += 20;
  else if (rating >= 4.0) score += 15;
  else if (rating >= 3.5) score += 10;
  else if (rating >= 3.0) score += 5;
  
  // Update recency
  const lastUpdated = ext.versions?.[0]?.lastUpdated;
  if (lastUpdated) {
    const daysDiff = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 30) score += 20;
    else if (daysDiff <= 90) score += 15;
    else if (daysDiff <= 180) score += 10;
    else if (daysDiff <= 365) score += 5;
  }
  
  return Math.min(100, score);
}

function findRedundantExtensions(userExtensions: UserExtension[]): Map<string, string[]> {
  const redundant = new Map<string, string[]>();
  
  // Group extensions by category
  const categoryGroups = new Map<string, UserExtension[]>();
  userExtensions.forEach(ext => {
    ext.categories.forEach(cat => {
      if (!categoryGroups.has(cat)) {
        categoryGroups.set(cat, []);
      }
      categoryGroups.get(cat)!.push(ext);
    });
  });
  
  // Find categories with multiple extensions (potential redundancy)
  categoryGroups.forEach((extensions, category) => {
    if (extensions.length > 1) {
      extensions.forEach(ext => {
        const others = extensions.filter(e => e.id !== ext.id).map(e => e.id);
        if (others.length > 0) {
          redundant.set(ext.id, others);
        }
      });
    }
  });
  
  return redundant;
}

async function generateRecommendations(
  userId: string,
  userExtensions: UserExtension[],
  supabase: any
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const userExtensionIds = new Set(userExtensions.map(e => e.id));
  
  // Get user's categories
  const userCategories = new Set<string>();
  userExtensions.forEach(ext => {
    ext.categories.forEach(cat => userCategories.add(cat));
  });
  
  // 1. Find redundant extensions
  const redundantExtensions = findRedundantExtensions(userExtensions);
  
  // 2. Get trending extensions in user's categories
  const trendingExtensions = await fetchTrendingExtensions(Array.from(userCategories));
  
  // 3. Get must-have extensions for common categories
  const mustHaveCategories = ['Programming Languages', 'Linters', 'Themes', 'Debuggers', 'Formatters'];
  const mustHaveExtensions: any[] = [];
  
  for (const cat of mustHaveCategories) {
    if (userCategories.has(cat)) {
      const catExtensions = await fetchCategoryExtensions(cat);
      mustHaveExtensions.push(...catExtensions.slice(0, 3));
    }
  }
  
  // 4. Generate alternative recommendations for redundant extensions
  for (const [extId, redundantWith] of redundantExtensions) {
    const userExt = userExtensions.find(e => e.id === extId);
    if (!userExt) continue;
    
    // Find better alternatives in the same category
    for (const cat of userExt.categories) {
      const catExtensions = await fetchCategoryExtensions(cat);
      const alternatives = catExtensions
        .filter(ext => {
          const extId = `${ext.publisher.publisherName}.${ext.extensionName}`;
          return !userExtensionIds.has(extId) && !redundantWith.includes(extId);
        })
        .slice(0, 2);
      
      for (const alt of alternatives) {
        const altId = `${alt.publisher.publisherName}.${alt.extensionName}`;
        const trustScore = calculateTrustScore(alt);
        
        if (trustScore > 60) {
          recommendations.push({
            extensionId: altId,
            extensionName: alt.displayName,
            publisher: alt.publisher.displayName,
            trustScore,
            recommendationType: 'alternative',
            reason: `Replaces ${userExt.name} with better trust score and active maintenance`,
            confidenceScore: Math.min(100, trustScore - 20),
            basedOn: ['redundancy_detection', 'trust_score_comparison', 'category_match'],
            downloads: getStat(alt, "install"),
            rating: getStat(alt, "averagerating"),
          });
        }
      }
    }
  }
  
  // 5. Generate complementary recommendations
  for (const ext of trendingExtensions) {
    const extId = `${ext.publisher.publisherName}.${ext.extensionName}`;
    if (userExtensionIds.has(extId)) continue;
    
    const trustScore = calculateTrustScore(ext);
    if (trustScore > 70) {
      recommendations.push({
        extensionId: extId,
        extensionName: ext.displayName,
        publisher: ext.publisher.displayName,
        trustScore,
        recommendationType: 'complementary',
        reason: 'Trending extension that complements your current setup',
        confidenceScore: Math.min(100, trustScore - 10),
        basedOn: ['trending', 'category_match', 'high_trust_score'],
        downloads: getStat(ext, "install"),
        rating: getStat(ext, "averagerating"),
      });
    }
  }
  
  // 6. Generate must-have recommendations
  for (const ext of mustHaveExtensions) {
    const extId = `${ext.publisher.publisherName}.${ext.extensionName}`;
    if (userExtensionIds.has(extId)) continue;
    
    const trustScore = calculateTrustScore(ext);
    if (trustScore > 75) {
      recommendations.push({
        extensionId: extId,
        extensionName: ext.displayName,
        publisher: ext.publisher.displayName,
        trustScore,
        recommendationType: 'must_have',
        reason: 'Essential extension for your development workflow',
        confidenceScore: Math.min(100, trustScore),
        basedOn: ['must_have_category', 'high_trust_score', 'popular'],
        downloads: getStat(ext, "install"),
        rating: getStat(ext, "averagerating"),
      });
    }
  }
  
  // 7. Security upgrade recommendations
  for (const ext of userExtensions) {
    // Check if there are better alternatives with higher trust scores
    for (const cat of ext.categories) {
      const catExtensions = await fetchCategoryExtensions(cat);
      const betterAlternatives = catExtensions
        .filter(e => {
          const eId = `${e.publisher.publisherName}.${e.extensionName}`;
          return !userExtensionIds.has(eId) && calculateTrustScore(e) > 80;
        })
        .slice(0, 1);
      
      for (const alt of betterAlternatives) {
        const altId = `${alt.publisher.publisherName}.${alt.extensionName}`;
        const trustScore = calculateTrustScore(alt);
        
        recommendations.push({
          extensionId: altId,
          extensionName: alt.displayName,
          publisher: alt.publisher.displayName,
          trustScore,
          recommendationType: 'security_upgrade',
          reason: `Higher security and trust score than ${ext.name}`,
          confidenceScore: Math.min(100, trustScore - 15),
          basedOn: ['security_improvement', 'trust_score_comparison'],
          downloads: getStat(alt, "install"),
          rating: getStat(alt, "averagerating"),
        });
      }
    }
  }
  
  // Remove duplicates and sort by confidence score
  const uniqueRecommendations = Array.from(
    new Map(recommendations.map(r => [r.extensionId, r])).values()
  );
  
  return uniqueRecommendations
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 10); // Return top 10 recommendations
}

async function storeRecommendations(
  supabase: any,
  userId: string,
  recommendations: Recommendation[]
) {
  // Clear old recommendations
  await supabase
    .from('extension_recommendations')
    .delete()
    .eq('user_id', userId);
  
  // Insert new recommendations
  for (const rec of recommendations) {
    const { error } = await supabase
      .from('extension_recommendations')
      .insert({
        user_id: userId,
        extension_id: rec.extensionId,
        recommendation_type: rec.recommendationType,
        reason: rec.reason,
        confidence_score: rec.confidenceScore,
        based_on: rec.basedOn,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });
    
    if (error) {
      console.error("Error storing recommendation:", error);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, installedExtensions } = await req.json();
    
    if (!userId || !installedExtensions) {
      return new Response(
        JSON.stringify({ error: "userId and installedExtensions are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's extensions from marketplace
    const userExtensions = await fetchUserExtensions(installedExtensions);
    
    // Generate personalized recommendations
    const recommendations = await generateRecommendations(userId, userExtensions, supabase);
    
    // Store recommendations in database
    await storeRecommendations(supabase, userId, recommendations);
    
    // Update user profile
    const categories = Array.from(new Set(userExtensions.flatMap(e => e.categories)));
    await supabase
      .from('user_extension_profiles')
      .upsert({
        user_id: userId,
        installed_extensions: installedExtensions,
        preferred_categories: categories,
        last_analyzed: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        recommendations,
        userExtensions: userExtensions.map(e => ({
          id: e.id,
          name: e.name,
          categories: e.categories,
        })),
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("personalized-recommendations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
