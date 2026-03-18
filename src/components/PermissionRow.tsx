import { Shield, Wifi, Terminal, FolderOpen, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PermissionLevel = "none" | "read-only" | "restricted" | "full";

interface PermissionRowProps {
  type: "filesystem" | "network" | "terminal" | "workspace" | "other";
  level: PermissionLevel;
  description?: string;
}

const icons = {
  filesystem: FolderOpen,
  network: Wifi,
  terminal: Terminal,
  workspace: Eye,
  other: Shield,
};

const levelColors: Record<PermissionLevel, string> = {
  none: "bg-trust-high/15 text-trust-high border-trust-high/30",
  "read-only": "bg-trust-high/15 text-trust-high border-trust-high/30",
  restricted: "bg-trust-medium/15 text-trust-medium border-trust-medium/30",
  full: "bg-trust-low/15 text-trust-low border-trust-low/30",
};

export function PermissionRow({ type, level, description }: PermissionRowProps) {
  const Icon = icons[type];

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <div>
          <span className="text-xs font-mono capitalize">{type}</span>
          {description && (
            <p className="text-[10px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn("text-[10px] font-mono uppercase tracking-wider rounded-sm px-1.5 py-0", levelColors[level])}
      >
        {level}
      </Badge>
    </div>
  );
}
