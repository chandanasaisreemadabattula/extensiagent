import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRightLeft, 
  Plus, 
  TrendingUp, 
  Shield, 
  Star, 
  Download,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Recommendation {
  extensionId: string;
  extensionName: string;
  publisher: string;
  trustScore: number;
  recommendationType: 'alternative' | 'complementary' | 'trending' | 'must_have' | 'security_upgrade';
  reason: string;
  confidenceScore: number;
  basedOn: string[];
  downloads: number;
  rating: number;
}

interface RecommendationsProps {
  recommendations: Recommendation[];
}

function getTypeConfig(type: string) {
  switch (type) {
    case 'alternative':
      return {
        icon: ArrowRightLeft,
        color: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
        label: 'Alternative',
        description: 'Better option than current extension'
      };
    case 'complementary':
      return {
        icon: Plus,
        color: 'bg-green-500/10 text-green-700 border-green-500/30',
        label: 'Complementary',
        description: 'Works well with your setup'
      };
    case 'trending':
      return {
        icon: TrendingUp,
        color: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
        label: 'Trending',
        description: 'Popular in your category'
      };
    case 'must_have':
      return {
        icon: Star,
        color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
        label: 'Must Have',
        description: 'Essential for your workflow'
      };
    case 'security_upgrade':
      return {
        icon: Shield,
        color: 'bg-red-500/10 text-red-700 border-red-500/30',
        label: 'Security Upgrade',
        description: 'Higher security profile'
      };
    default:
      return {
        icon: Star,
        color: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
        label: 'Recommended',
        description: 'Suggested for you'
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          No recommendations available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10">
            <Star className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground">Personalized</div>
            <div className="text-lg font-bold font-mono text-purple-700">
              {recommendations.length} Recommendations
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          Based on your setup
        </Badge>
      </div>

      {/* Recommendations List */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Suggested Extensions
        </h3>
        <AnimatePresence>
          {recommendations.map((rec, index) => {
            const typeConfig = getTypeConfig(rec.recommendationType);
            const TypeIcon = typeConfig.icon;
            
            return (
              <motion.div
                key={rec.extensionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full",
                    typeConfig.color.split(' ')[0]
                  )}>
                    <TypeIcon className={cn("w-4 h-4", typeConfig.color.split(' ')[1])} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm truncate">
                        {rec.extensionName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] font-mono px-1.5 py-0", typeConfig.color)}
                      >
                        {typeConfig.label}
                      </Badge>
                    </div>
                    
                    <div className="text-[10px] font-mono text-muted-foreground mb-2">
                      {rec.publisher}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {rec.reason}
                    </p>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {formatNumber(rec.downloads)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {rec.rating.toFixed(1)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {rec.confidenceScore}% confidence
                      </div>
                    </div>
                  </div>
                  
                  {/* Trust Score */}
                  <div className="flex flex-col items-end">
                    <div className={cn("text-lg font-bold font-mono", getScoreColor(rec.trustScore))}>
                      {rec.trustScore}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">trust</div>
                  </div>
                </div>
                
                {/* Based On */}
                {rec.basedOn && rec.basedOn.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Based on: {rec.basedOn.join(', ')}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
