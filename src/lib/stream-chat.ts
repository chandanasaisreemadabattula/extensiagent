type Msg = { role: "user" | "assistant"; content: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CHAT_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/index` : "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Supabase endpoint is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building the extension."
  );
}

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onReport,
  onAllReports,
  onVersionScores,
  onRecommendations,
  onSecurityAssessment,
  onInsights,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onReport?: (report: any) => void;
  onAllReports?: (reports: any[]) => void;
  onVersionScores?: (data: { versions: any[]; averageScore: number }) => void;
  onRecommendations?: (recommendations: any[]) => void;
  onSecurityAssessment?: (assessment: any) => void;
  onInsights?: (data: { insights: any[]; trendAnalyses: any[]; predictions: any[] }) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const errorText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Request failed (${resp.status}): ${errorText}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;

      // Check for custom report event
      if (line.startsWith("event: report")) continue;

      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        
        // Check if it's a report payload
        if (parsed.report && onReport) {
          onReport(parsed.report);
          if (parsed.allReports && onAllReports) {
            onAllReports(parsed.allReports);
          }
          continue;
        }
        
        // Check for version scores
        if (parsed.versionScores && onVersionScores) {
          onVersionScores({
            versions: parsed.versionScores,
            averageScore: parsed.averageVersionScore || 0,
          });
          continue;
        }
        
        // Check for recommendations
        if (parsed.recommendations && onRecommendations) {
          onRecommendations(parsed.recommendations);
          continue;
        }
        
        // Check for security assessment
        if (parsed.securityAssessment && onSecurityAssessment) {
          onSecurityAssessment(parsed.securityAssessment);
          continue;
        }
        
        // Check for insights
        if (parsed.insights && onInsights) {
          onInsights({
            insights: parsed.insights || [],
            trendAnalyses: parsed.trendAnalyses || [],
            predictions: parsed.predictions || [],
          });
          continue;
        }
        
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.report && onReport) { onReport(parsed.report); continue; }
        if (parsed.versionScores && onVersionScores) {
          onVersionScores({
            versions: parsed.versionScores,
            averageScore: parsed.averageVersionScore || 0,
          });
          continue;
        }
        if (parsed.recommendations && onRecommendations) {
          onRecommendations(parsed.recommendations);
          continue;
        }
        if (parsed.securityAssessment && onSecurityAssessment) {
          onSecurityAssessment(parsed.securityAssessment);
          continue;
        }
        if (parsed.insights && onInsights) {
          onInsights({
            insights: parsed.insights || [],
            trendAnalyses: parsed.trendAnalyses || [],
            predictions: parsed.predictions || [],
          });
          continue;
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}
