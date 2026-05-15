import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MARKETPLACE_API = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface SecurityAssessment {
  extensionId: string;
  extensionName: string;
  publisher: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  permissionsAnalysis: {
    filesystem: { level: string; risk: number };
    network: { level: string; risk: number };
    terminal: { level: string; risk: number };
    workspace: { level: string; risk: number };
    other: { level: string; risk: number };
  };
  publisherTrustScore: number;
  malwareIndicators: string[];
  suspiciousPatterns: string[];
  recommendations: string[];
  assessedAt: string;
}

interface MarketplaceExtension {
  extensionName: string;
  extensionId: string;
  publisher: { publisherName: string; isDomainVerified: boolean; displayName: string };
  versions: { version: string; lastUpdated: string; properties?: { key: string; value: string }[] }[];
  statistics: { statisticName: string; value: number }[];
  displayName: string;
  shortDescription: string;
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

function analyzePermissions(extension: MarketplaceExtension): SecurityAssessment['permissionsAnalysis'] {
  const props = extension.versions?.[0]?.properties || [];
  
  const analysis = {
    filesystem: { level: 'none', risk: 0 },
    network: { level: 'none', risk: 0 },
    terminal: { level: 'none', risk: 0 },
    workspace: { level: 'none', risk: 0 },
    other: { level: 'none', risk: 0 },
  };
  
  // Analyze each property for permission indicators
  props.forEach(prop => {
    const key = prop.key.toLowerCase();
    const value = prop.value?.toLowerCase() || '';
    
    // Filesystem permissions
    if (key.includes('filesystem') || key.includes('file') || key.includes('read') || key.includes('write')) {
      if (value.includes('full') || value.includes('write')) {
        analysis.filesystem = { level: 'full', risk: 30 };
      } else if (value.includes('read')) {
        analysis.filesystem = { level: 'read-only', risk: 10 };
      } else {
        analysis.filesystem = { level: 'restricted', risk: 20 };
      }
    }
    
    // Network permissions
    if (key.includes('network') || key.includes('http') || key.includes('fetch') || key.includes('request')) {
      if (value.includes('full') || value.includes('unrestricted')) {
        analysis.network = { level: 'full', risk: 35 };
      } else if (value.includes('restricted')) {
        analysis.network = { level: 'restricted', risk: 15 };
      } else {
        analysis.network = { level: 'limited', risk: 25 };
      }
    }
    
    // Terminal permissions
    if (key.includes('terminal') || key.includes('shell') || key.includes('exec')) {
      if (value.includes('full') || value.includes('execute')) {
        analysis.terminal = { level: 'full', risk: 40 };
      } else if (value.includes('restricted')) {
        analysis.terminal = { level: 'restricted', risk: 20 };
      } else {
        analysis.terminal = { level: 'limited', risk: 30 };
      }
    }
    
    // Workspace permissions
    if (key.includes('workspace') || key.includes('project')) {
      if (value.includes('full') || value.includes('modify')) {
        analysis.workspace = { level: 'full', risk: 25 };
      } else if (value.includes('read')) {
        analysis.workspace = { level: 'read-only', risk: 10 };
      } else {
        analysis.workspace = { level: 'restricted', risk: 15 };
      }
    }
  });
  
  return analysis;
}

function calculatePublisherTrustScore(publisher: MarketplaceExtension['publisher']): number {
  let score = 50; // Base score
  
  // Verified publisher
  if (publisher.isDomainVerified) {
    score += 30;
  }
  
  // Known publishers (Microsoft, GitHub, etc.)
  const knownPublishers = ['microsoft', 'github', 'redhat', 'pivotal', 'vmware'];
  if (knownPublishers.includes(publisher.publisherName.toLowerCase())) {
    score += 20;
  }
  
  return Math.min(100, score);
}

function detectMalwareIndicators(extension: MarketplaceExtension): string[] {
  const indicators: string[] = [];
  const description = (extension.shortDescription || '').toLowerCase();
  const name = extension.displayName.toLowerCase();
  
  // Suspicious keywords
  const suspiciousKeywords = [
    'crypto', 'miner', 'bitcoin', 'ethereum', 'wallet',
    'keylogger', 'spy', 'steal', 'hack', 'exploit',
    'backdoor', 'trojan', 'virus', 'malware', 'ransomware',
  ];
  
  suspiciousKeywords.forEach(keyword => {
    if (description.includes(keyword) || name.includes(keyword)) {
      indicators.push(`Suspicious keyword detected: "${keyword}"`);
    }
  });
  
  // Check for obfuscated code patterns in properties
  const props = extension.versions?.[0]?.properties || [];
  props.forEach(prop => {
    const value = prop.value || '';
    // Check for base64 encoded strings
    if (/[A-Za-z0-9+/]{50,}={0,2}/.test(value)) {
      indicators.push('Potential obfuscated code detected in properties');
    }
    // Check for eval or Function constructor
    if (value.includes('eval(') || value.includes('Function(')) {
      indicators.push('Dynamic code execution detected');
    }
  });
  
  return indicators;
}

function detectSuspiciousPatterns(extension: MarketplaceExtension): string[] {
  const patterns: string[] = [];
  
  // Check for very new extension with high downloads
  const downloads = getStat(extension, "install");
  const lastUpdated = extension.versions?.[0]?.lastUpdated;
  
  if (lastUpdated) {
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceCreation < 30 && downloads > 10000) {
      patterns.push('New extension with unusually high download count');
    }
  }
  
  // Check for low rating with high downloads
  const rating = getStat(extension, "averagerating");
  const ratingCount = getStat(extension, "ratingcount");
  
  if (downloads > 50000 && rating < 3.0 && ratingCount > 100) {
    patterns.push('High downloads but low rating - potential manipulation');
  }
  
  // Check for missing description
  if (!extension.shortDescription || extension.shortDescription.length < 20) {
    patterns.push('Very short or missing description');
  }
  
  // Check for publisher not verified
  if (!extension.publisher.isDomainVerified) {
    patterns.push('Publisher domain not verified');
  }
  
  // Check for no recent updates
  if (lastUpdated) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceUpdate > 365) {
      patterns.push('No updates in over a year - potentially abandoned');
    }
  }
  
  return patterns;
}

function generateRecommendations(
  riskLevel: string,
  permissionsAnalysis: SecurityAssessment['permissionsAnalysis'],
  malwareIndicators: string[],
  suspiciousPatterns: string[]
): string[] {
  const recommendations: string[] = [];
  
  if (riskLevel === 'critical' || riskLevel === 'high') {
    recommendations.push('Consider removing this extension due to high security risk');
    recommendations.push('Look for alternative extensions with better security profiles');
  }
  
  if (malwareIndicators.length > 0) {
    recommendations.push('Report this extension to VS Code Marketplace for review');
    recommendations.push('Do not install or update this extension');
  }
  
  if (permissionsAnalysis.terminal.level === 'full') {
    recommendations.push('This extension has full terminal access - review its code if possible');
  }
  
  if (permissionsAnalysis.network.level === 'full') {
    recommendations.push('This extension can make unrestricted network requests - monitor its activity');
  }
  
  if (permissionsAnalysis.filesystem.level === 'full') {
    recommendations.push('This extension has full filesystem access - ensure it\'s from a trusted source');
  }
  
  if (suspiciousPatterns.includes('Publisher domain not verified')) {
    recommendations.push('Verify the publisher\'s identity before trusting this extension');
  }
  
  if (suspiciousPatterns.includes('No updates in over a year - potentially abandoned')) {
    recommendations.push('Consider using an actively maintained alternative');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Extension appears safe to use');
    recommendations.push('Always keep extensions updated to the latest version');
  }
  
  return recommendations;
}

function calculateRiskScore(
  permissionsAnalysis: SecurityAssessment['permissionsAnalysis'],
  publisherTrustScore: number,
  malwareIndicators: string[],
  suspiciousPatterns: string[]
): number {
  let riskScore = 0;
  
  // Permission risks
  riskScore += permissionsAnalysis.filesystem.risk;
  riskScore += permissionsAnalysis.network.risk;
  riskScore += permissionsAnalysis.terminal.risk;
  riskScore += permissionsAnalysis.workspace.risk;
  
  // Publisher trust (inverse - lower trust = higher risk)
  riskScore += (100 - publisherTrustScore) * 0.3;
  
  // Malware indicators
  riskScore += malwareIndicators.length * 25;
  
  // Suspicious patterns
  riskScore += suspiciousPatterns.length * 10;
  
  return Math.min(100, Math.max(0, riskScore));
}

function determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

async function performSecurityAssessment(
  extension: MarketplaceExtension
): Promise<SecurityAssessment> {
  const permissionsAnalysis = analyzePermissions(extension);
  const publisherTrustScore = calculatePublisherTrustScore(extension.publisher);
  const malwareIndicators = detectMalwareIndicators(extension);
  const suspiciousPatterns = detectSuspiciousPatterns(extension);
  
  const riskScore = calculateRiskScore(
    permissionsAnalysis,
    publisherTrustScore,
    malwareIndicators,
    suspiciousPatterns
  );
  
  const riskLevel = determineRiskLevel(riskScore);
  const recommendations = generateRecommendations(
    riskLevel,
    permissionsAnalysis,
    malwareIndicators,
    suspiciousPatterns
  );
  
  return {
    extensionId: `${extension.publisher.publisherName}.${extension.extensionName}`,
    extensionName: extension.displayName,
    publisher: extension.publisher.displayName,
    riskLevel,
    riskScore: Math.round(riskScore),
    permissionsAnalysis,
    publisherTrustScore,
    malwareIndicators,
    suspiciousPatterns,
    recommendations,
    assessedAt: new Date().toISOString(),
  };
}

async function storeSecurityAssessment(
  supabase: any,
  assessment: SecurityAssessment
) {
  const { error } = await supabase
    .from('security_assessments')
    .upsert({
      extension_id: assessment.extensionId,
      risk_level: assessment.riskLevel,
      risk_score: assessment.riskScore,
      permissions_analysis: assessment.permissionsAnalysis,
      publisher_trust_score: assessment.publisherTrustScore,
      malware_indicators: assessment.malwareIndicators,
      suspicious_patterns: assessment.suspiciousPatterns,
      recommendations: assessment.recommendations,
      assessed_at: assessment.assessedAt,
    }, {
      onConflict: 'extension_id'
    });

  if (error) {
    console.error("Error storing security assessment:", error);
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

    const results: SecurityAssessment[] = [];
    const errors: string[] = [];

    for (const id of idsToProcess) {
      try {
        const extension = await fetchExtensionData(id);
        
        if (!extension) {
          errors.push(`Extension not found: ${id}`);
          continue;
        }

        const assessment = await performSecurityAssessment(extension);
        await storeSecurityAssessment(supabase, assessment);
        results.push(assessment);
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
        assessedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("security-assessment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
