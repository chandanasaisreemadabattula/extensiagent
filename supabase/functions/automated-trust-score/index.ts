import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MARKETPLACE_API = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface MarketplaceExtension {
  extensionName: string;
  extensionId: string;
  publisher: { publisherName: string; isDomainVerified: boolean; displayName: string };
  versions: { version: string; lastUpdated: string; properties?: { key: string; value: string }[] }[];
  statistics: { statisticName: string; value: number }[];
  displayName: string;
  shortDescription: string;
  categories: string[];
}

interface TrustScoreBreakdown {
  publisherVerified: number;
  downloads: number;
  rating: number;
  updateRecency: number;
  permissions: number;
  aiVersionScore: number;
  securityScore: number;
}

interface EnhancedTrustScore {
  extensionId: string;
  extensionName: string;
  publisher: string;
  trustScore: number;
  breakdown: TrustScoreBreakdown;
  metrics: {
    downloads: number;
    rating: number;
    ratingCount: number;
    lastUpdated: string;
    latestVersion: string;
    publisherVerified: boolean;
  };
  calculatedAt: string;
}

async function fetchExtensionData(extensionId: string): Promise<MarketplaceExtension | null> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 7, value: extensionId },
        ],
        pageNumber: 1,
        pageSize: 1,
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
    return null;
  }

  const data = await resp.json();
  return data.results?.[0]?.extensions?.[0] || null;
}

function getStat(ext: MarketplaceExtension, name: string): number {
  return ext.statistics?.find((s) => s.statisticName === name)?.value || 0;
}

function calculatePublisherScore(publisher: MarketplaceExtension['publisher']): number {
  return publisher.isDomainVerified ? 20 : 0;
}

function calculateDownloadScore(downloads: number): number {
  if (downloads > 1000000) return 20;
  if (downloads > 100000) return 15;
  if (downloads > 10000) return 10;
  if (downloads > 1000) return 5;
  return 0;
}

function calculateRatingScore(rating: number): number {
  if (rating >= 4.5) return 20;
  if (rating >= 4.0) return 15;
  if (rating >= 3.5) return 10;
  if (rating >= 3.0) return 5;
  return 0;
}

function calculateUpdateRecencyScore(lastUpdated: string): number {
  const updateDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 30) return 20; // Updated within 1 month
  if (daysDiff <= 90) return 15; // Updated within 3 months
  if (daysDiff <= 180) return 10; // Updated within 6 months
  if (daysDiff <= 365) return 5; // Updated within 1 year
  return 0;
}

function calculatePermissionsScore(extension: MarketplaceExtension): number {
  // Analyze extension properties for permissions
  const props = extension.versions?.[0]?.properties || [];
  const hasFileSystem = props.some(p => p.key.includes("FileSystem"));
  const hasTerminal = props.some(p => p.key.includes("Terminal"));
  const hasNetwork = props.some(p => p.key.includes("Network"));
  const hasWorkspace = props.some(p => p.key.includes("Workspace"));
  
  let score = 20; // Start with max score
  
  // Deduct points for each permission type
  if (hasFileSystem) score -= 5;
  if (hasTerminal) score -= 5;
  if (hasNetwork) score -= 5;
  if (hasWorkspace) score -= 5;
  
  return Math.max(0, score);
}

async function getAIVersionScore(supabase: any, extensionId: string): Promise<number> {
  const { data, error } = await supabase
    .from('extension_versions')
    .select('ai_version_score')
    .eq('extension_id', extensionId)
    .order('release_date', { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return 50; // Default score if no version data
  }

  // Calculate average of recent version scores
  const avgScore = Math.round(
    data.reduce((sum: number, v: any) => sum + (v.ai_version_score || 50), 0) / data.length
  );
  
  return avgScore;
}

async function getSecurityScore(supabase: any, extensionId: string): Promise<number> {
  const { data, error } = await supabase
    .from('security_assessments')
    .select('risk_score')
    .eq('extension_id', extensionId)
    .single();

  if (error || !data) {
    return 75; // Default security score
  }

  // Invert risk_score (lower risk = higher security score)
  return 100 - (data.risk_score || 25);
}

async function calculateEnhancedTrustScore(
  extension: MarketplaceExtension,
  supabase: any
): Promise<EnhancedTrustScore> {
  const downloads = getStat(extension, "install");
  const rating = getStat(extension, "averagerating");
  const ratingCount = getStat(extension, "ratingcount");
  const lastVersion = extension.versions?.[0];
  const lastUpdated = lastVersion?.lastUpdated || new Date().toISOString();

  // Calculate individual scores
  const publisherScore = calculatePublisherScore(extension.publisher);
  const downloadScore = calculateDownloadScore(downloads);
  const ratingScore = calculateRatingScore(rating);
  const updateScore = calculateUpdateRecencyScore(lastUpdated);
  const permissionsScore = calculatePermissionsScore(extension);
  const aiVersionScore = await getAIVersionScore(supabase, extension.extensionId);
  const securityScore = await getSecurityScore(supabase, extension.extensionId);

  // Calculate weighted trust score
  // Weights: Publisher (15%), Downloads (15%), Rating (15%), Updates (15%), Permissions (10%), AI Version (15%), Security (15%)
  const trustScore = Math.round(
    publisherScore * 0.15 +
    downloadScore * 0.15 +
    ratingScore * 0.15 +
    updateScore * 0.15 +
    permissionsScore * 0.10 +
    aiVersionScore * 0.15 +
    securityScore * 0.15
  );

  return {
    extensionId: `${extension.publisher.publisherName}.${extension.extensionName}`,
    extensionName: extension.displayName,
    publisher: extension.publisher.displayName,
    trustScore: Math.min(100, Math.max(0, trustScore)),
    breakdown: {
      publisherVerified: publisherScore,
      downloads: downloadScore,
      rating: ratingScore,
      updateRecency: updateScore,
      permissions: permissionsScore,
      aiVersionScore,
      securityScore,
    },
    metrics: {
      downloads,
      rating,
      ratingCount,
      lastUpdated,
      latestVersion: lastVersion?.version || "unknown",
      publisherVerified: extension.publisher.isDomainVerified,
    },
    calculatedAt: new Date().toISOString(),
  };
}

async function storeTrustScore(supabase: any, trustScore: EnhancedTrustScore) {
  // Store in trust_scores_history
  const { error: historyError } = await supabase
    .from('trust_scores_history')
    .insert({
      extension_id: trustScore.extensionId,
      trust_score: trustScore.trustScore,
      permissions_score: trustScore.breakdown.permissions,
      community_score: Math.round((trustScore.breakdown.downloads + trustScore.breakdown.rating) / 2),
      ai_version_score: trustScore.breakdown.aiVersionScore,
      security_score: trustScore.breakdown.securityScore,
      downloads: trustScore.metrics.downloads,
      rating: trustScore.metrics.rating,
      rating_count: trustScore.metrics.ratingCount,
      publisher_verified: trustScore.metrics.publisherVerified,
    });

  if (historyError) {
    console.error("Error storing trust score history:", historyError);
  }

  // Update extension_metadata
  const { error: metadataError } = await supabase
    .from('extension_metadata')
    .upsert({
      extension_id: trustScore.extensionId,
      display_name: trustScore.extensionName,
      publisher_name: trustScore.publisher,
      publisher_verified: trustScore.metrics.publisherVerified,
      latest_version: trustScore.metrics.latestVersion,
      latest_version_date: trustScore.metrics.lastUpdated,
      downloads: trustScore.metrics.downloads,
      rating: trustScore.metrics.rating,
      rating_count: trustScore.metrics.ratingCount,
      last_updated: new Date().toISOString(),
    }, {
      onConflict: 'extension_id'
    });

  if (metadataError) {
    console.error("Error storing extension metadata:", metadataError);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { extensionId, extensionIds } = await req.json();
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle single extension or batch of extensions
    const idsToProcess = extensionIds || (extensionId ? [extensionId] : []);
    
    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: "extensionId or extensionIds is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: EnhancedTrustScore[] = [];
    const errors: string[] = [];

    for (const id of idsToProcess) {
      try {
        const extension = await fetchExtensionData(id);
        
        if (!extension) {
          errors.push(`Extension not found: ${id}`);
          continue;
        }

        const trustScore = await calculateEnhancedTrustScore(extension, supabase);
        await storeTrustScore(supabase, trustScore);
        results.push(trustScore);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        errors.push(`Error processing ${id}: ${errorMsg}`);
        console.error(`Error processing extension ${id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors: errors.length > 0 ? errors : undefined,
        processedCount: results.length,
        totalRequested: idsToProcess.length,
        calculatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("automated-trust-score error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
