import { useState } from "react";
import { Copy, Check, Terminal, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallButtonProps {
  extensionId: string;
}

export function InstallButton({ extensionId }: InstallButtonProps) {
  const [copied, setCopied] = useState(false);
  const command = `code --install-extension ${extensionId}`;
  const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMarketplace = () => {
    window.open(marketplaceUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Option 1: Terminal command */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">Option 1: Run in VS Code terminal</p>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2">
          <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
          <code className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-300 select-all">{command}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        {copied && (
          <p className="text-[10px] text-green-600 dark:text-green-400">✓ Copied! Paste in terminal to install</p>
        )}
      </div>

      {/* Option 2: Direct link */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">Option 2: Open in VS Code</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleOpenMarketplace}
        >
          <ExternalLink className="w-4 h-4" />
          Open in VS Code Marketplace
        </Button>
      </div>
    </div>
  );
}
