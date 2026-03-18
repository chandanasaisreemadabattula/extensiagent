import { motion, AnimatePresence } from "framer-motion";
import { TrustShield } from "./TrustShield";
import { PermissionRow } from "./PermissionRow";
import { InstallButton } from "./InstallButton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Download, Star, GitBranch, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExtensionReport {
  name: string;
  extensionId: string;
  publisher: string;
  publisherVerified: boolean;
  trustScore: number;
  permissionsScore: number;
  communityScore: number;
  downloads: number;
  rating: number;
  ratingCount: number;
  lastUpdated: string;
  repoUrl?: string;
  openIssues?: number;
  permissions: {
    type: "filesystem" | "network" | "terminal" | "workspace" | "other";
    level: "none" | "read-only" | "restricted" | "full";
    description?: string;
  }[];
}

interface TrustReportProps {
  report: ExtensionReport | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function TrustReport({ report }: TrustReportProps) {
  return (
    <AnimatePresence mode="wait">
      {!report ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex items-center justify-center p-8"
        >
          <p className="text-xs font-mono text-muted-foreground text-center">
            Trust report will appear here
          </p>
        </motion.div>
      ) : (
        <motion.div
          key={report.extensionId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 overflow-y-auto p-4 space-y-5"
        >
          {/* Header */}
          <div className="space-y-1">
            <h2 className="font-mono font-bold text-sm">{report.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{report.publisher}</span>
              {report.publisherVerified ? (
                <Badge variant="outline" className="text-[10px] font-mono rounded-sm px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                  <CheckCircle className="w-2.5 h-2.5 mr-1" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-mono rounded-sm px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/30">
                  <XCircle className="w-2.5 h-2.5 mr-1" /> Unverified
                </Badge>
              )}
            </div>
          </div>

          {/* Trust Shield */}
          <TrustShield
            score={report.trustScore}
            permissionsScore={report.permissionsScore}
            communityScore={report.communityScore}
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatItem icon={Download} label="Downloads" value={formatNumber(report.downloads)} />
            <StatItem icon={Star} label="Rating" value={`${report.rating.toFixed(1)} (${formatNumber(report.ratingCount)})`} />
            <StatItem icon={Calendar} label="Updated" value={report.lastUpdated} />
            {report.openIssues !== null && report.openIssues !== undefined && (
              <StatItem icon={GitBranch} label="Open Issues" value={report.openIssues.toString()} />
            )}
          </div>

          {/* Permissions */}
          <div className="space-y-1">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Permissions</h3>
            <div className="border border-border rounded-sm">
              {report.permissions.map((p, i) => (
                <PermissionRow key={i} {...p} />
              ))}
            </div>
          </div>

          {/* Install */}
          <div className="space-y-1">
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Install</h3>
            <InstallButton extensionId={report.extensionId} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border border-border rounded-sm px-2.5 py-2">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <div>
        <div className="text-[10px] text-muted-foreground font-mono">{label}</div>
        <div className="text-xs font-mono font-medium">{value}</div>
      </div>
    </div>
  );
}
