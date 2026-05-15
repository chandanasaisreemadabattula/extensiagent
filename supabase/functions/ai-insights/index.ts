import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MARKETPLACE_API = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface ExtensionInsight {
  extensionId: string;
  extensionName: string;
  insightType: 'trend' | 'prediction' | 'category' | 'maintenance' | 'popularity';
  insightText: string;
  confidenceScore: number;
  supportingData: Record<string, any>;
  generatedAt: string;
}

interface TrendAnalysis {
  extensionId: string;
  extensionName: string;
  trend: 'rising' | 'stable' | 'declining';
  trendScore: number;
  downloadGrowth: number;
  ratingChange: number;
  updateFrequency: number;
  analysis: string;
}

interface Prediction {
  extensionId: string;
  extensionName: string;
  predictionType: 'deprecation' | 'growth' | 'stability';
  prediction: string;
  confidence: number;
  factors: string[];
}

async function fetchExtensionData(extensionId: string): Promise<any | null> {
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

async function fetchCategoryTrends(category: string): Promise<any[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 1, value: category },
        ],
        pageNumber: 1,
        pageSize: 50,
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

async function analyzeTrend(
  extension: any,
  supabase: any
): Promise<TrendAnalysis> {
  const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
  const downloads = getStat(extension, "install");
  const rating = getStat(extension, "averagerating");
  const lastUpdated = extension.versions?.[0]?.lastUpdated;
  
  // Get historical data from database
  const { data: history } = await supabase
    .from('trust_scores_history')
    .select('*')
    .eq('extension_id', extensionId)
    .order('recorded_at', { ascending: false })
    .limit(10);
  
  let downloadGrowth = 0;
  let ratingChange = 0;
  let updateFrequency = 0;
  
  if (history && history.length >= 2) {
    const latest = history[0];
    const oldest = history[history.length - 1];
    
    downloadGrowth = ((latest.downloads - oldest.downloads) / oldest.downloads) * 100;
    ratingChange = latest.rating - oldest.rating;
    
    // Calculate update frequency (updates per month)
    const daysDiff = Math.floor(
      (new Date(latest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    updateFrequency = (history.length / daysDiff) * 30;
  }
  
  // Calculate trend score
  let trendScore = 50; // Neutral
  
  // Download growth impact
  if (downloadGrowth > 50) trendScore += 20;
  else if (downloadGrowth > 20) trendScore += 10;
  else if (downloadGrowth < -20) trendScore -= 10;
  else if (downloadGrowth < -50) trendScore -= 20;
  
  // Rating change impact
  if (ratingChange > 0.5) trendScore += 15;
  else if (ratingChange > 0.2) trendScore += 10;
  else if (ratingChange < -0.2) trendScore -= 10;
  else if (ratingChange < -0.5) trendScore -= 15;
  
  // Update frequency impact
  if (updateFrequency > 4) trendScore += 15; // Weekly updates
  else if (updateFrequency > 1) trendScore += 10; // Monthly updates
  else if (updateFrequency < 0.5) trendScore -= 10; // Rare updates
  
  // Determine trend
  let trend: 'rising' | 'stable' | 'declining';
  if (trendScore >= 60) trend = 'rising';
  else if (trendScore >= 40) trend = 'stable';
  else trend = 'declining';
  
  // Generate analysis text
  let analysis = '';
  if (trend === 'rising') {
    analysis = `${extension.displayName} is showing strong growth with ${downloadGrowth.toFixed(1)}% download increase and improving ratings.`;
  } else if (trend === 'declining') {
    analysis = `${extension.displayName} is declining with ${Math.abs(downloadGrowth).toFixed(1)}% download decrease and may need attention.`;
  } else {
    analysis = `${extension.displayName} is maintaining stable performance with consistent downloads and ratings.`;
  }
  
  return {
    extensionId,
    extensionName: extension.displayName,
    trend,
    trendScore: Math.min(100, Math.max(0, trendScore)),
    downloadGrowth,
    ratingChange,
    updateFrequency,
    analysis,
  };
}

async function generatePredictions(
  extension: any,
  trendAnalysis: TrendAnalysis
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
  const lastUpdated = extension.versions?.[0]?.lastUpdated;
  const downloads = getStat(extension, "install");
  const rating = getStat(extension, "averagerating");
  
  // Deprecation prediction
  if (lastUpdated) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceUpdate > 365) {
      predictions.push({
        extensionId,
        extensionName: extension.displayName,
        predictionType: 'deprecation',
        prediction: 'This extension may be abandoned or deprecated. Consider finding an alternative.',
        confidence: 85,
        factors: ['No updates in over a year', 'Potentially abandoned by publisher'],
      });
    } else if (daysSinceUpdate > 180) {
      predictions.push({
        extensionId,
        extensionName: extension.displayName,
        predictionType: 'deprecation',
        prediction: 'This extension may be at risk of abandonment. Monitor for updates.',
        confidence: 60,
        factors: ['No updates in 6+ months', 'Declining maintenance'],
      });
    }
  }
  
  // Growth prediction
  if (trendAnalysis.trend === 'rising' && trendAnalysis.downloadGrowth > 30) {
    predictions.push({
      extensionId,
      extensionName: extension.displayName,
      predictionType: 'growth',
      prediction: 'This extension is likely to continue growing in popularity.',
      confidence: 75,
      factors: ['Strong download growth', 'Positive trend', 'Active development'],
    });
  }
  
  // Stability prediction
  if (trendAnalysis.trend === 'stable' && rating >= 4.0) {
    predictions.push({
      extensionId,
      extensionName: extension.displayName,
      predictionType: 'stability',
      prediction: 'This extension is stable and reliable for long-term use.',
      confidence: 80,
      factors: ['Consistent performance', 'Good ratings', 'Regular updates'],
    });
  }
  
  return predictions;
}

async function generateCategoryInsights(
  category: string,
  extensions: any[]
): Promise<ExtensionInsight[]> {
  const insights: ExtensionInsight[] = [];
  
  // Find top extensions in category
  const topExtensions = extensions
    .sort((a, b) => getStat(b, "install") - getStat(a, "install"))
    .slice(0, 5);
  
  if (topExtensions.length > 0) {
    const topNames = topExtensions.map(e => e.displayName).join(', ');
    insights.push({
      extensionId: `category:${category}`,
      extensionName: `${category} Category`,
      insightType: 'category',
      insightText: `Top extensions in ${category}: ${topNames}`,
      confidenceScore: 90,
      supportingData: {
        category,
        topExtensions: topExtensions.map(e => ({
          name: e.displayName,
          downloads: getStat(e, "install"),
          rating: getStat(e, "averagerating"),
        })),
      },
      generatedAt: new Date().toISOString(),
    });
  }
  
  // Calculate category statistics
  const totalDownloads = extensions.reduce((sum, e) => sum + getStat(e, "install"), 0);
  const avgRating = extensions.reduce((sum, e) => sum + getStat(e, "averagerating"), 0) / extensions.length;
  
  insights.push({
    extensionId: `category:${category}`,
    extensionName: `${category} Category`,
    insightType: 'popularity',
    insightText: `${category} has ${extensions.length} extensions with ${totalDownloads.toLocaleString()} total downloads and ${avgRating.toFixed(1)} average rating.`,
    confidenceScore: 95,
    supportingData: {
      category,
      extensionCount: extensions.length,
      totalDownloads,
      averageRating: avgRating,
    },
    generatedAt: new Date().toISOString(),
  });
  
  return insights;
}

async function generateMaintenanceInsights(
  extension: any
): Promise<ExtensionInsight[]> {
  const insights: ExtensionInsight[] = [];
  const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
  const lastUpdated = extension.versions?.[0]?.lastUpdated;
  const versions = extension.versions || [];
  
  if (lastUpdated) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceUpdate <= 30) {
      insights.push({
        extensionId,
        extensionName: extension.displayName,
        insightType: 'maintenance',
        insightText: 'This extension is actively maintained with recent updates.',
        confidenceScore: 95,
        supportingData: {
          daysSinceUpdate,
          lastUpdated,
          versionCount: versions.length,
        },
        generatedAt: new Date().toISOString(),
      });
    } else if (daysSinceUpdate <= 90) {
      insights.push({
        extensionId,
        extensionName: extension.displayName,
        insightType: 'maintenance',
        insightText: 'This extension is regularly maintained with updates every few months.',
        confidenceScore: 85,
        supportingData: {
          daysSinceUpdate,
          lastUpdated,
          versionCount: versions.length,
        },
        generatedAt: new Date().toISOString(),
      });
    } else if (daysSinceUpdate > 180) {
      insights.push({
        extensionId,
        extensionName: extension.displayName,
        insightType: 'maintenance',
        insightText: 'This extension may have infrequent maintenance. Consider alternatives if issues arise.',
        confidenceScore: 75,
        supportingData: {
          daysSinceUpdate,
          lastUpdated,
          versionCount: versions.length,
        },
        generatedAt: new Date().toISOString(),
      });
    }
  }
  
  // Version frequency insight
  if (versions.length > 10) {
    insights.push({
      extensionId,
      extensionName: extension.displayName,
      insightType: 'maintenance',
      insightText: `This extension has ${versions.length} versions, indicating active development history.`,
      confidenceScore: 90,
      supportingData: {
        versionCount: versions.length,
        latestVersion: versions[0]?.version,
      },
      generatedAt: new Date().toISOString(),
    });
  }
  
  return insights;
}

async function storeInsights(
  supabase: any,
  insights: ExtensionInsight[]
) {
  for (const insight of insights) {
    const { error } = await supabase
      .from('extension_insights')
      .insert({
        extension_id: insight.extensionId,
        insight_type: insight.insightType,
        insight_text: insight.insightText,
        confidence_score: insight.confidenceScore,
        supporting_data: insight.supportingData,
        generated_at: insight.generatedAt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
    
    if (error) {
      console.error("Error storing insight:", error);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { extensionId, category, type } = await req.json();
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const insights: ExtensionInsight[] = [];
    const predictions: Prediction[] = [];
    const trendAnalyses: TrendAnalysis[] = [];

    // Handle extension-specific insights
    if (extensionId) {
      const extension = await fetchExtensionData(extensionId);
      
      if (!extension) {
        return new Response(
          JSON.stringify({ error: "Extension not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Analyze trend
      const trend = await analyzeTrend(extension, supabase);
      trendAnalyses.push(trend);

      // Generate predictions
      const preds = await generatePredictions(extension, trend);
      predictions.push(...preds);

      // Generate maintenance insights
      const maintenanceInsights = await generateMaintenanceInsights(extension);
      insights.push(...maintenanceInsights);

      // Store insights
      await storeInsights(supabase, [...insights, ...preds.map(p => ({
        extensionId: p.extensionId,
        extensionName: p.extensionName,
        insightType: p.predictionType as ExtensionInsight['insightType'],
        insightText: p.prediction,
        confidenceScore: p.confidence,
        supportingData: { factors: p.factors },
        generatedAt: new Date().toISOString(),
      }))]);
    }

    // Handle category insights
    if (category) {
      const categoryExtensions = await fetchCategoryTrends(category);
      const categoryInsights = await generateCategoryInsights(category, categoryExtensions);
      insights.push(...categoryInsights);
      
      // Store category insights
      await storeInsights(supabase, categoryInsights);
    }

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        predictions,
        trendAnalyses,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
