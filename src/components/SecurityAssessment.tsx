import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle, 
  XCircle,
  FileWarning,
  Network,
  Terminal,
  Folder,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SecurityAssessment {
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

interface SecurityAssessmentProps {
  assessment: SecurityAssessment | null;
}

function getRiskLevelConfig(level: string) {
  switch (level) {
    case 'low':
      return {
        icon: CheckCircle,
        color: 'bg-green-500/10 text-green-700 border-green-500/30',
        label: 'Low Risk',
        description: 'Safe to use'
      };
    case 'medium':
      return {
        icon: AlertTriangle,
        color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
        label: 'Medium Risk',
        description: 'Use with caution'
      };
    case 'high':
      return {
        icon: AlertOctagon,
        color: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
        label: 'High Risk',
        description: 'Consider alternatives'
      };
    case 'critical':
      return {
        icon: XCircle,
        color: 'bg-red-500/10 text-red-700 border-red-500/30',
        label: 'Critical Risk',
        description: 'Do not use'
      };
    default:
      return {
        icon: Shield,
        color: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
        label: 'Unknown',
        description: 'Assessment pending'
      };
  }
}

function getPermissionIcon(type: string) {
  switch (type) {
    case 'filesystem': return <Folder className="w-3 h-3" />;
    case 'network': return <Network className="w-3 h-3" />;
    case 'terminal': return <Terminal className="w-3 h-3" />;
    case 'workspace': return <FileWarning className="w-3 h-3" />;
    default: return <Lock className="w-3 h-3" />;
  }
}

function getPermissionLevelColor(level: string): string {
  switch (level) {
    case 'none': return 'text-green-600';
    case 'read-only': return 'text-blue-600';
    case 'restricted': return 'text-yellow-600';
    case 'full': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

export function SecurityAssessment({ assessment }: SecurityAssessmentProps) {
  if (!assessment) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          No security assessment available
        </p>
      </div>
    );
  }

  const riskConfig = getRiskLevelConfig(assessment.riskLevel);
  const RiskIcon = riskConfig.icon;

  return (
    <div className="space-y-4">
      {/* Risk Level Header */}
      <div className={cn(
        "p-3 rounded-lg border",
        riskConfig.color.replace('text-', 'bg-').replace('/10', '/5')
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              riskConfig.color.split(' ')[0]
            )}>
              <RiskIcon className={cn("w-4 h-4", riskConfig.color.split(' ')[1])} />
            </div>
            <div>
              <div className="text-xs font-mono text-muted-foreground">Security Risk</div>
              <div className={cn("text-lg font-bold font-mono", riskConfig.color.split(' ')[1])}>
                {riskConfig.label}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono">{assessment.riskScore}</div>
            <div className="text-[10px] font-mono text-muted-foreground">risk score</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {riskConfig.description}
        </p>
      </div>

      {/* Publisher Trust */}
      <div className="p-3 border border-border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Publisher Trust
          </span>
          <span className="font-mono font-bold">{assessment.publisherTrustScore}/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all",
              assessment.publisherTrustScore >= 80 ? "bg-green-500" :
              assessment.publisherTrustScore >= 60 ? "bg-blue-500" :
              assessment.publisherTrustScore >= 40 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${assessment.publisherTrustScore}%` }}
          />
        </div>
      </div>

      {/* Permissions Analysis */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Permissions Analysis
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(assessment.permissionsAnalysis).map(([type, data]) => (
            <div key={type} className="p-2 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                {getPermissionIcon(type)}
                <span className="text-[10px] font-mono capitalize">{type}</span>
              </div>
              <div className={cn("text-xs font-mono font-medium", getPermissionLevelColor(data.level))}>
                {data.level}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                Risk: {data.risk}/100
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Malware Indicators */}
      {assessment.malwareIndicators.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono text-red-600 uppercase tracking-wider flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" />
            Malware Indicators
          </h3>
          <div className="space-y-1">
            {assessment.malwareIndicators.map((indicator, i) => (
              <div key={i} className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                {indicator}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspicious Patterns */}
      {assessment.suspiciousPatterns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono text-yellow-600 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Suspicious Patterns
          </h3>
          <div className="space-y-1">
            {assessment.suspiciousPatterns.map((pattern, i) => (
              <div key={i} className="p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                {pattern}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Recommendations
        </h3>
        <div className="space-y-1">
          {assessment.recommendations.map((rec, i) => (
            <div key={i} className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {rec}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
