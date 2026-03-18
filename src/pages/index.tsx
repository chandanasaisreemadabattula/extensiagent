import { useState, useCallback } from "react";
import { CommandBar } from "@/components/CommandBar";
import { AgentStream } from "@/components/AgentStream";
import { TrustReport, ExtensionReport } from "@/components/TrustReport";
import { streamChat } from "@/lib/stream-chat";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const Index = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<ExtensionReport | null>(null);
  const [allReports, setAllReports] = useState<ExtensionReport[]>([]);

  const handleSubmit = useCallback(async (query: string) => {
    // Start fresh conversation for each new search
    const userMsg: Msg = { role: "user", content: query };
    const newMessages = [userMsg]; // Only include the new query, not previous messages
    setMessages(newMessages);
    setReport(null); // Clear previous report
    setAllReports([]); // Clear all reports
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
        onReport: (r) => {
          // Don't set report here - let onAllReports handle it with sorting
          // This ensures the top recommendation is always the highest trust score one
        },
        onAllReports: (reports) => {
          // Sort reports: trustScore (desc) > downloads (desc) > rating (desc)
          const sortedReports = [...reports].sort((a, b) => {
            // Primary: trustScore (higher is better)
            if (b.trustScore !== a.trustScore) {
              return b.trustScore - a.trustScore;
            }
            // Secondary: downloads (higher is better)
            if (b.downloads !== a.downloads) {
              return b.downloads - a.downloads;
            }
            // Tertiary: rating (higher is better)
            return b.rating - a.rating;
          });
          setAllReports(sortedReports);
          // Set the top recommendation (first after sorting) as the selected report
          if (sortedReports.length > 0) {
            setReport(sortedReports[0]);
          }
        },
      });
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
      toast({
        title: "Error",
        description: e.message || "Failed to get response",
        variant: "destructive",
      });
    }
  }, []); // Remove messages dependency since we're starting fresh each time

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Top bar with gradient */}
      <header className="relative flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
            <span className="font-mono font-bold text-lg text-white">EA</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base text-slate-900 dark:text-slate-100">ExtensiAgent</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Analyze extensions with security insights</span>
          </div>
        </div>
      </header>

      {/* Command bar with enhanced styling */}
      <div className="px-6 py-4">
        <CommandBar onSubmit={handleSubmit} isLoading={isLoading} />
      </div>

      {/* Main content with cards */}
      <div className="flex flex-1 min-h-0 gap-4 px-6 pb-6">
        {/* Left: Agent chat */}
        <div className="flex flex-col flex-[3] min-w-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Analysis</h2>
          </div>
          <AgentStream 
            messages={messages} 
            isStreaming={isLoading}
            allReports={allReports}
            onSelectExtension={(extensionId) => {
              const selected = allReports.find(r => r.extensionId === extensionId);
              if (selected) setReport(selected);
            }}
          />
        </div>

        {/* Right: Trust report */}
        <div className="flex flex-col flex-[2] min-w-0 hidden md:flex bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/30">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Trust Report</h2>
              {allReports.length > 1 && (
                <select 
                  className="text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-blue-700 dark:text-blue-300"
                  value={report?.extensionId || ''}
                  onChange={(e) => {
                    const selected = allReports.find(r => r.extensionId === e.target.value);
                    if (selected) setReport(selected);
                  }}
                >
                  {allReports.map((r) => (
                    <option key={r.extensionId} value={r.extensionId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <TrustReport report={report} />
        </div>
      </div>
    </div>
  );
};

export default Index;

