import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, GitCommit, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VersionScore {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  aiVersionScore: number;
  changeImpact: 'major' | 'minor' | 'patch' | 'breaking' | 'deprecation';
  changeSummary: string;
}

interface VersionScoresProps {
  versions: VersionScore[];
  averageScore: number;
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'major': return 'bg-green-500/10 text-green-700 border-green-500/30';
    case 'minor': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    case 'patch': return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
    case 'breaking': return 'bg-red-500/10 text-red-700 border-red-500/30';
    case 'deprecation': return 'bg-orange-500/10 text-orange-700 border-orange-500/30';
    default: return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
  }
}

function getImpactIcon(impact: string) {
  switch (impact) {
    case 'major': return <TrendingUp className="w-3 h-3" />;
    case 'minor': return <Zap className="w-3 h-3" />;
    case 'patch': return <GitCommit className="w-3 h-3" />;
    case 'breaking': return <AlertTriangle className="w-3 h-3" />;
    case 'deprecation': return <TrendingDown className="w-3 h-3" />;
    default: return <Minus className="w-3 h-3" />;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export function VersionScores({ versions, averageScore }: VersionScoresProps) {
  if (!versions || versions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          No version data available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Average Score Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground">AI Version Score</div>
            <div className={cn("text-lg font-bold font-mono", getScoreColor(averageScore))}>
              {averageScore}/100
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {versions.length} versions analyzed
        </Badge>
      </div>

      {/* Version List */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Version History
        </h3>
        <AnimatePresence>
          {versions.map((version, index) => (
            <motion.div
              key={version.version}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm">{version.version}</span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] font-mono px-1.5 py-0", getImpactColor(version.changeImpact))}
                    >
                      {getImpactIcon(version.changeImpact)}
                      <span className="ml-1 capitalize">{version.changeImpact}</span>
                    </Badge>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-2">
                    {formatDate(version.releaseDate)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {version.changeSummary}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div className={cn("text-lg font-bold font-mono", getScoreColor(version.aiVersionScore))}>
                    {version.aiVersionScore}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">score</div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
