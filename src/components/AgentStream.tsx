import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentStreamProps {
  messages: Message[];
  isStreaming: boolean;
  allReports?: any[];
  onSelectExtension?: (extensionId: string) => void;
}

export function AgentStream({ messages, isStreaming, allReports, onSelectExtension }: AgentStreamProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-lg">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur-2xl opacity-30 animate-pulse"></div>
              <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/50">
                <span className="text-3xl font-mono font-bold text-white">EA</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to ExtensiAgent</h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Describe what you need — I'll find the best VS Code extension, analyze its permissions, and provide a comprehensive trust score.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Python formatter", "Git history viewer", "REST client", "Markdown editor"].map((s) => (
              <span key={s} className="px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-default">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6 max-w-3xl">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex gap-3" : ""}>
            {msg.role === "user" ? (
              <div className="flex gap-3 items-start w-full">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shrink-0">
                  <span className="text-white font-bold text-sm">U</span>
                </div>
                <div className="flex-1 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-start w-full">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shrink-0">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none
                      prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-headings:font-semibold
                      prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed
                      prose-strong:text-slate-900 dark:prose-strong:text-slate-100 
                      prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-blue-50 dark:prose-code:bg-blue-950/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:cursor-pointer hover:prose-code:bg-blue-100 dark:hover:prose-code:bg-blue-900/50
                      prose-li:text-slate-700 dark:prose-li:text-slate-300
                      prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:cursor-pointer
                    "
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      // Handle code blocks with View Trust Report
                      if (target.tagName === 'CODE' && target.textContent === '[View Trust Report]') {
                        e.preventDefault();
                        const comment = target.nextSibling;
                        if (comment && comment.nodeType === Node.COMMENT_NODE) {
                          const match = comment.textContent?.match(/ext-id:(.+)/);
                          if (match && onSelectExtension) {
                            onSelectExtension(match[1].trim());
                          }
                        }
                      }
                    }}
                  >
                    <ReactMarkdown
                      components={{
                        a: ({ node, href, children, ...props }) => {
                          if (href?.startsWith('ext://')) {
                            return (
                              <a
                                {...props}
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const extensionId = href.replace('ext://', '');
                                  if (onSelectExtension) {
                                    onSelectExtension(extensionId);
                                  }
                                }}
                              >
                                {children}
                              </a>
                            );
                          }
                          return <a href={href} {...props}>{children}</a>;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {isStreaming && i === messages.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-emerald-500 animate-pulse ml-1 align-text-bottom rounded-sm" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
