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

async function searchMarketplace(query: string): Promise<MarketplaceExtension[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 10, value: query },
        ],
        pageNumber: 1,
        pageSize: 5,
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
  return data.results?.[0]?.extensions || [];
}

function getStat(ext: MarketplaceExtension, name: string): number {
  return ext.statistics?.find((s) => s.statisticName === name)?.value || 0;
}

function formatExtensionContext(extensions: MarketplaceExtension[]): string {
  return extensions
    .map((ext, i) => {
      const installs = getStat(ext, "install");
      const rating = getStat(ext, "averagerating");
      const ratingCount = getStat(ext, "ratingcount");
      const lastVersion = ext.versions?.[0];
      const lastUpdated = lastVersion?.lastUpdated
        ? new Date(lastVersion.lastUpdated).toISOString().split("T")[0]
        : "unknown";

      return `
## Extension ${i + 1}: ${ext.displayName}
- **ID**: ${ext.publisher.publisherName}.${ext.extensionName}
- **Publisher**: ${ext.publisher.displayName} (verified: ${ext.publisher.isDomainVerified})
- **Description**: ${ext.shortDescription || "N/A"}
- **Installs**: ${installs}
- **Rating**: ${rating.toFixed(1)}/5 (${Math.round(ratingCount)} ratings)
- **Last Updated**: ${lastUpdated}
- **Version**: ${lastVersion?.version || "unknown"}
`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are ExtensiAgent, a VS Code Extension Vetting Agent. You help developers find and evaluate VS Code extensions.

When the user asks about extensions, you will receive marketplace data. Analyze it and:
1. Recommend the BEST extension for their needs
2. Explain WHY in clear, concise terms
3. Assess trust signals: publisher verification, download count, update frequency, rating

After your analysis, you MUST output a JSON block wrapped in \`\`\`json ... \`\`\` at the END of your response with this exact structure:
\`\`\`json
{
  "name": "Extension Display Name",
  "extensionId": "publisher.extensionName",
  "publisher": "Publisher Name",
  "publisherVerified": true/false,
  "trustScore": 0-100,
  "permissionsScore": 0-100,
  "communityScore": 0-100,
  "downloads": number,
  "rating": number,
  "ratingCount": number,
  "lastUpdated": "YYYY-MM-DD",
  "openIssues": number or null,
  "permissions": [
    {"type": "filesystem|network|terminal|workspace|other", "level": "none|read-only|restricted|full", "description": "brief explanation"}
  ]
}
\`\`\`

Trust score calculation:
- Publisher verified: +20 points
- Downloads > 1M: +20, > 100K: +15, > 10K: +10
- Rating >= 4.5: +20, >= 4.0: +15, >= 3.5: +10
- Updated within 3 months: +20, 6 months: +10
- Permissions (fewer = higher score, max +20)

Permissions score: Based on the extension's capabilities. Extensions that don't need filesystem/terminal access score higher.
Community score: Based on downloads, ratings, and update frequency.

Be direct. Use terminal-style language. No fluff.`;

async function callSupabaseFunction(functionName: string, payload: any): Promise<any> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase configuration missing");
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`${functionName} error:`, response.status, await response.text());
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error(`Error calling ${functionName}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get the latest user message to search marketplace
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let marketplaceContext = "";
    let extensions: MarketplaceExtension[] = [];

    if (lastUserMsg) {
      extensions = await searchMarketplace(lastUserMsg.content);
      if (extensions.length > 0) {
        marketplaceContext = `\n\n--- VS Code Marketplace Results ---\n${formatExtensionContext(extensions)}\n--- End Results ---`;
      }
    }

    // Build messages with marketplace context injected
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m: any, i: number) => {
        if (m.role === "user" && i === messages.length - 1 && marketplaceContext) {
          return { role: "user", content: m.content + marketplaceContext };
        }
        return m;
      }),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need to intercept the stream to extract the JSON report
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Forward the chunk to client
          controller.enqueue(value);

          // Also accumulate full content to extract report
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
            } catch {}
          }
        }

        // Extract JSON report from full content
        const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const report = JSON.parse(jsonMatch[1]);
            const reportEvent = encoder.encode(`data: ${JSON.stringify({ report })}\n\n`);
            controller.enqueue(reportEvent);

            // Call Version 2 functions in parallel
            const extensionId = report.extensionId;
            
            // Call all Version 2 functions concurrently
            const [versionScoresResult, recommendationsResult, securityResult, insightsResult] = await Promise.allSettled([
              callSupabaseFunction('ai-version-scoring', { extensionId }),
              callSupabaseFunction('personalized-recommendations', { 
                userId: 'anonymous', 
                installedExtensions: [extensionId] 
              }),
              callSupabaseFunction('security-assessment', { extensionId }),
              callSupabaseFunction('ai-insights', { extensionId }),
            ]);

            // Send version scores
            if (versionScoresResult.status === 'fulfilled' && versionScoresResult.value) {
              const versionData = versionScoresResult.value;
              const versionEvent = encoder.encode(`data: ${JSON.stringify({ 
                versionScores: versionData.versionScores || [],
                averageVersionScore: versionData.averageVersionScore || 0,
              })}\n\n`);
              controller.enqueue(versionEvent);
            }

            // Send recommendations
            if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value) {
              const recData = recommendationsResult.value;
              const recEvent = encoder.encode(`data: ${JSON.stringify({ 
                recommendations: recData.recommendations || [],
              })}\n\n`);
              controller.enqueue(recEvent);
            }

            // Send security assessment
            if (securityResult.status === 'fulfilled' && securityResult.value) {
              const secData = securityResult.value;
              if (secData.results && secData.results.length > 0) {
                const secEvent = encoder.encode(`data: ${JSON.stringify({ 
                  securityAssessment: secData.results[0],
                })}\n\n`);
                controller.enqueue(secEvent);
              }
            }

            // Send insights
            if (insightsResult.status === 'fulfilled' && insightsResult.value) {
              const insightData = insightsResult.value;
              const insightEvent = encoder.encode(`data: ${JSON.stringify({ 
                insights: insightData.insights || [],
                trendAnalyses: insightData.trendAnalyses || [],
                predictions: insightData.predictions || [],
              })}\n\n`);
              controller.enqueue(insightEvent);
            }

          } catch (e) {
            console.error("Failed to parse report JSON:", e);
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("vet-extension error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
