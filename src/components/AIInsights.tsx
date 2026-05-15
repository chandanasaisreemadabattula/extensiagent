import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Lightbulb, 
  Target, 
  BarChart3,
  Wrench,
  Users,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Insight {
  extensionId: string;
  extensionName: string;
  insightType: 'trend' | 'prediction' | 'category' | 'maintenance' | 'popularity';
  insightText: string;
  confidenceScore: number;
  supportingData: Record<string, any>;
  generatedAt: string;
}

export interface TrendAnalysis {
  extensionId: string;
  extensionName: string;
  trend: 'rising' | 'stable' | 'declining';
  trendScore: number;
  downloadGrowth: number;
  ratingChange: number;
  updateFrequency: number;
  analysis: string;
}

export interface Prediction {
  extensionId: string;
  extensionName: string;
  predictionType: 'deprecation' | 'growth' | 'stability';
  prediction: string;
  confidence: number;
  factors: string[];
}

interface AIInsightsProps {
  insights: Insight[];
  trendAnalyses: TrendAnalysis[];
  predictions: Prediction[];
}

function getInsightTypeConfig(type: string) {
  switch (type) {
    case 'trend':
      return {
        icon: TrendingUp,
        color: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
        label: 'Trend'
      };
    case 'prediction':
      return {
        icon: Target,
        color: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
        label: 'Prediction'
      };
    case 'category':
      return {
        icon: BarChart3,
        color: 'bg-green-500/10 text-green-700 border-green-500/30',
        label: 'Category'
      };
    case 'maintenance':
      return {
        icon: Wrench,
        color: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
        label: 'Maintenance'
      };
    case 'popularity':
      return {
        icon: Users,
        color: 'bg-pink-500/10 text-pink-700 border-pink-500/30',
        label: 'Popularity'
      };
    default:
      return {
        icon: Lightbulb,
        color: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
        label: 'Insight'
      };
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'rising': return <TrendingUp className="w-4 h-4 text-green-600" />;
    case 'declining': return <TrendingDown className="w-4 h-4 text-red-600" />;
    default: return <Minus className="w-4 h-4 text-gray-600" />;
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'rising': return 'text-green-600';
    case 'declining': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

function getPredictionTypeConfig(type: string) {
  switch (type) {
    case 'deprecation':
      return {
        icon: TrendingDown,
        color: 'bg-red-500/10 text-red-700 border-red-500/30',
        label: 'Deprecation Risk'
      };
    case 'growth':
      return {
        icon: TrendingUp,
        color: 'bg-green-500/10 text-green-700 border-green-500/30',
        label: 'Growth Expected'
      };
    case 'stability':
      return {
        icon: Minus,
        color: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
        label: 'Stable'
      };
    default:
      return {
        icon: Target,
        color: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
        label: 'Prediction'
      };
  }
}

export function AIInsights({ insights, trendAnalyses, predictions }: AIInsightsProps) {
  const hasData = insights.length > 0 || trendAnalyses.length > 0 || predictions.length > 0;

  if (!hasData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          No AI insights available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground">AI Analytics</div>
            <div className="text-lg font-bold font-mono text-amber-700">
              Insights & Predictions
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          Powered by AI
        </Badge>
      </div>

      {/* Trend Analyses */}
      {trendAnalyses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Trend Analysis
          </h3>
          <AnimatePresence>
            {trendAnalyses.map((trend, index) => (
              <motion.div
                key={trend.extensionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTrendIcon(trend.trend)}
                      <span className="font-mono font-bold text-sm truncate">
                        {trend.extensionName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] font-mono px-1.5 py-0", getTrendColor(trend.trend))}
                      >
                        {trend.trend}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {trend.analysis}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                      <div>
                        <div className="text-muted-foreground">Downloads</div>
                        <div className={cn(
                          "font-medium",
                          trend.downloadGrowth > 0 ? "text-green-600" : 
                          trend.downloadGrowth < 0 ? "text-red-600" : "text-gray-600"
                        )}>
                          {trend.downloadGrowth > 0 ? '+' : ''}{trend.downloadGrowth.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rating</div>
                        <div className={cn(
                          "font-medium",
                          trend.ratingChange > 0 ? "text-green-600" : 
                          trend.ratingChange < 0 ? "text-red-600" : "text-gray-600"
                        )}>
                          {trend.ratingChange > 0 ? '+' : ''}{trend.ratingChange.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Updates/mo</div>
                        <div className="font-medium">{trend.updateFrequency.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono">{trend.trendScore}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">trend</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Predictions */}
      {predictions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Target className="w-3 h-3" />
            Predictions
          </h3>
          <AnimatePresence>
            {predictions.map((pred, index) => {
              const typeConfig = getPredictionTypeConfig(pred.predictionType);
              const TypeIcon = typeConfig.icon;
              
              return (
                <motion.div
                  key={`${pred.extensionId}-${pred.predictionType}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full",
                      typeConfig.color.split(' ')[0]
                    )}>
                      <TypeIcon className={cn("w-4 h-4", typeConfig.color.split(' ')[1])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm truncate">
                          {pred.extensionName}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] font-mono px-1.5 py-0", typeConfig.color)}
                        >
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {pred.prediction}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <span>Confidence: {pred.confidence}%</span>
                        {pred.factors.length > 0 && (
                          <span>• {pred.factors.length} factors</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Insights
          </h3>
          <AnimatePresence>
            {insights.map((insight, index) => {
              const typeConfig = getInsightTypeConfig(insight.insightType);
              const TypeIcon = typeConfig.icon;
              
              return (
                <motion.div
                  key={`${insight.extensionId}-${insight.insightType}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full",
                      typeConfig.color.split(' ')[0]
                    )}>
                      <TypeIcon className={cn("w-4 h-4", typeConfig.color.split(' ')[1])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm truncate">
                          {insight.extensionName}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] font-mono px-1.5 py-0", typeConfig.color)}
                        >
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {insight.insightText}
                      </p>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Confidence: {insight.confidenceScore}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
