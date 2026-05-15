import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";

interface CommandBarProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export function CommandBar({ onSubmit, isLoading }: CommandBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center gap-3 px-6 py-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/20">
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
        ) : (
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What extension do you need? (e.g. &quot;Python formatter&quot;, &quot;Git history viewer&quot;, &quot;REST client&quot;)"
          className="flex-1 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          disabled={isLoading}
        />
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-md hidden sm:block">
            ENTER ↵
          </span>
        </div>
      </div>
    </form>
  );
}
