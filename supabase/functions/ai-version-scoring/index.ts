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
}

interface VersionScore {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  aiVersionScore: number;
  changeImpact: 'major' | 'minor' | 'patch' | 'breaking' | 'deprecation';
  changeSummary: string;
}

async function fetchExtensionVersions(extensionId: string): Promise<MarketplaceExtension | null> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 7, value: extensionId }, // Extension ID filter
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

function extractReleaseNotes(version: any): string {
  // Try to extract release notes from version properties
  const props = version.properties || [];
  const releaseNotesProp = props.find((p: any) => 
    p.key === "Microsoft.VisualStudio.Code.ReleaseNotes" || 
    p.key === "Microsoft.VisualStudio.Services.Content.LatestReleaseNotes"
  );
  return releaseNotesProp?.value || "No release notes available";
}

async function analyzeVersionWithAI(
  version: string,
  releaseNotes: string,
  previousVersion: string | null,
  apiKey: string
): Promise<{ score: number; impact: string; summary: string }> {
  const prompt = `Analyze this VS Code extension version update and provide a score from 0-100.

Version: ${version}
${previousVersion ? `Previous Version: ${previousVersion}` : 'First version'}

Release Notes:
${releaseNotes || "No release notes provided"}

Analyze the release notes and determine:
1. A version score (0-100) based on:
   - Major feature additions: 80-100
   - Significant improvements: 60-80
   - Bug fixes and minor improvements: 40-60
   - Breaking changes or deprecations: 20-40
   - No significant changes: 0-20

2. Change impact type:
   - "major" - New features, significant functionality
   - "minor" - Improvements, enhancements
   - "patch" - Bug fixes, small changes
   - "breaking" - Breaking changes, API changes
   - "deprecation" - Deprecated features

3. A brief summary of the changes (1-2 sentences)

Respond in JSON format:
{
  "score": <number>,
  "impact": "<major|minor|patch|breaking|deprecation>",
  "summary": "<brief summary>"
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    console.error("AI gateway error:", response.status, await response.text());
    return { score: 50, impact: "patch", summary: "Unable to analyze version changes" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, parsed.score || 50)),
        impact: parsed.impact || "patch",
        summary: parsed.summary || "Version analysis completed"
      };
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }

  return { score: 50, impact: "patch", summary: "Version analysis completed" };
}

async function storeVersionScore(
  supabase: any,
  extensionId: string,
  versionScore: VersionScore
) {
  const { error } = await supabase
    .from('extension_versions')
    .upsert({
      extension_id: extensionId,
      version: versionScore.version,
      release_notes: versionScore.releaseNotes,
      release_date: versionScore.releaseDate,
      ai_version_score: versionScore.aiVersionScore,
      change_impact: versionScore.changeImpact,
      change_summary: versionScore.changeSummary,
    }, {
      onConflict: 'extension_id,version'
    });

  if (error) {
    console.error("Error storing version score:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { extensionId, versions } = await req.json();
    
    if (!extensionId) {
      return new Response(
        JSON.stringify({ error: "extensionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch extension data from marketplace
    const extension = await fetchExtensionVersions(extensionId);
    
    if (!extension) {
      return new Response(
        JSON.stringify({ error: "Extension not found in marketplace" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get versions to analyze (either specified or all recent versions)
    const versionsToAnalyze = versions || extension.versions.slice(0, 5);
    const versionScores: VersionScore[] = [];

    for (let i = 0; i < versionsToAnalyze.length; i++) {
      const version = versionsToAnalyze[i];
      const previousVersion = i < versionsToAnalyze.length - 1 ? versionsToAnalyze[i + 1].version : null;
      const releaseNotes = extractReleaseNotes(version);

      // Analyze version with AI
      const analysis = await analyzeVersionWithAI(
        version.version,
        releaseNotes,
        previousVersion,
        LOVABLE_API_KEY
      );

      const versionScore: VersionScore = {
        version: version.version,
        releaseDate: version.lastUpdated,
        releaseNotes,
        aiVersionScore: analysis.score,
        changeImpact: analysis.impact as VersionScore['changeImpact'],
        changeSummary: analysis.summary,
      };

      versionScores.push(versionScore);

      // Store in database
      await storeVersionScore(supabase, extensionId, versionScore);
    }

    // Calculate average version score
    const avgVersionScore = versionScores.length > 0
      ? Math.round(versionScores.reduce((sum, vs) => sum + vs.aiVersionScore, 0) / versionScores.length)
      : 50;

    return new Response(
      JSON.stringify({
        success: true,
        extensionId,
        extensionName: extension.displayName,
        publisher: extension.publisher.displayName,
        versionScores,
        averageVersionScore: avgVersionScore,
        analyzedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-version-scoring error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
