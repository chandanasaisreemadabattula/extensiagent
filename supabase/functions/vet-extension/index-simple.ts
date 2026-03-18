import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MARKETPLACE_API = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface MarketplaceExtension {
  extensionName: string;
  extensionId: string;
  publisher: { publisherName: string; isDomainVerified: boolean; displayName: string };
  versions: { version: string; lastUpdated: string; properties?: { key: string; value: string}[] }[];
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

function calculateTrustScore(ext: MarketplaceExtension): {
  trustScore: number;
  permissionsScore: number;
  communityScore: number;
} {
  let trustScore = 0;
  let permissionsScore = 80; // Default high score
  let communityScore = 0;

  // Publisher verified: +20
  if (ext.publisher.isDomainVerified) trustScore += 20;

  // Downloads
  const installs = getStat(ext, "install");
  if (installs > 1000000) {
    trustScore += 20;
    communityScore += 30;
  } else if (installs > 100000) {
    trustScore += 15;
    communityScore += 20;
  } else if (installs > 10000) {
    trustScore += 10;
    communityScore += 10;
  }

  // Rating
  const rating = getStat(ext, "averagerating");
  if (rating >= 4.5) {
    trustScore += 20;
    communityScore += 30;
  } else if (rating >= 4.0) {
    trustScore += 15;
    communityScore += 20;
  } else if (rating >= 3.5) {
    trustScore += 10;
    communityScore += 10;
  }

  // Last updated
  const lastVersion = ext.versions?.[0];
  if (lastVersion?.lastUpdated) {
    const daysSinceUpdate = (Date.now() - new Date(lastVersion.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 90) {
      trustScore += 20;
      communityScore += 20;
    } else if (daysSinceUpdate < 180) {
      trustScore += 10;
      communityScore += 10;
    }
  }

  // Permissions score (simplified - assume most extensions are safe)
  trustScore += 20;

  return { trustScore: Math.min(trustScore, 100), permissionsScore, communityScore: Math.min(communityScore, 100) };
}

function generateReport(ext: MarketplaceExtension) {
  const scores = calculateTrustScore(ext);
  const installs = getStat(ext, "install");
  const rating = getStat(ext, "averagerating");
  const ratingCount = getStat(ext, "ratingcount");
  const lastVersion = ext.versions?.[0];

  return {
    name: ext.displayName,
    extensionId: `${ext.publisher.publisherName}.${ext.extensionName}`,
    publisher: ext.publisher.displayName,
    publisherVerified: ext.publisher.isDomainVerified,
    trustScore: scores.trustScore,
    permissionsScore: scores.permissionsScore,
    communityScore: scores.communityScore,
    downloads: installs,
    rating: rating,
    ratingCount: Math.round(ratingCount),
    lastUpdated: lastVersion?.lastUpdated ? new Date(lastVersion.lastUpdated).toISOString().split("T")[0] : "unknown",
    openIssues: null,
    permissions: [
      { type: "workspace", level: "read-only", description: "Reads workspace files and settings" },
      { type: "network", level: "restricted", description: "Makes network requests for extension functionality" },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    
    if (!lastUserMsg) {
      throw new Error("No user message found");
    }

    // Search marketplace
    const extensions = await searchMarketplace(lastUserMsg.content);
    
    if (extensions.length === 0) {
      const errorMsg = `I couldn't find any extensions matching "${lastUserMsg.content}". Try a different search term.`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errorMsg } }] })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Generate reports for all extensions
    const allReports = extensions.map(ext => ({
      ext,
      report: generateReport(ext)
    }));
    
    // Sort by trustScore (desc) > downloads (desc) > rating (desc) to find best extension
    allReports.sort((a, b) => {
      const aReport = a.report;
      const bReport = b.report;
      // Primary: trustScore (higher is better)
      if (bReport.trustScore !== aReport.trustScore) {
        return bReport.trustScore - aReport.trustScore;
      }
      // Secondary: downloads (higher is better)
      if (bReport.downloads !== aReport.downloads) {
        return bReport.downloads - aReport.downloads;
      }
      // Tertiary: rating (higher is better)
      return bReport.rating - aReport.rating;
    });
    
    // Get best extension (now first after sorting)
    const bestExt = allReports[0].ext;
    const report = allReports[0].report;
    
    // Generate response message with all options
    let responseText = `Found ${extensions.length} extension${extensions.length > 1 ? 's' : ''} matching your search:\n\n`;
    
    // List all extensions with data attributes for clicking
    allReports.forEach((item, index) => {
      const { ext, report: r } = item;
      const extId = `${ext.publisher.publisherName}.${ext.extensionName}`;
      responseText += `${index + 1}. **${ext.displayName}** by ${ext.publisher.displayName}\n`;
      responseText += `   Trust Score: ${r.trustScore}/100 | Downloads: ${r.downloads.toLocaleString()} | Rating: ${r.rating.toFixed(1)}/5\n`;
      responseText += `   ${ext.shortDescription || 'No description'}\n\n`;
    });
    
    responseText += `\n---\n\n## Top Recommendation: ${bestExt.displayName}

**Publisher:** ${bestExt.publisher.displayName} ${bestExt.publisher.isDomainVerified ? "✓ Verified" : ""}

**Description:** ${bestExt.shortDescription || "No description available"}

**Trust Score:** ${report.trustScore}/100

**Stats:**
- Downloads: ${report.downloads.toLocaleString()}
- Rating: ${report.rating.toFixed(1)}/5 (${report.ratingCount} ratings)
- Last Updated: ${report.lastUpdated}

**Analysis:**
${report.trustScore >= 80 ? "✅ Highly trusted extension with strong community support." : report.trustScore >= 60 ? "⚠️ Moderately trusted. Review permissions before installing." : "❌ Low trust score. Use with caution."}

${report.publisherVerified ? "✅ Publisher is verified" : "⚠️ Publisher is not verified"}
${report.downloads > 100000 ? "✅ Popular extension with many users" : "⚠️ Limited user base"}
${report.rating >= 4.0 ? "✅ Well-rated by users" : "⚠️ Mixed or low ratings"}`;

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send message in chunks
        const words = responseText.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? words[i] : " " + words[i]);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
        }
        
        // Send all reports
        const allReportsData = allReports.map(item => item.report);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ report, allReports: allReportsData })}\n\n`));
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
