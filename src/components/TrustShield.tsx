import { motion } from "framer-motion";

interface TrustShieldProps {
  score: number; // 0-100
  permissionsScore: number; // 0-100
  communityScore: number; // 0-100
}

const getTrustColor = (score: number) => {
  if (score >= 70) return "hsl(var(--trust-high))";
  if (score >= 40) return "hsl(var(--trust-medium))";
  return "hsl(var(--trust-low))";
};

const getTrustLabel = (score: number) => {
  if (score >= 80) return "TRUSTED";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "CAUTION";
  return "RISKY";
};

export function TrustShield({ score, permissionsScore, communityScore }: TrustShieldProps) {
  const outerRadius = 54;
  const innerRadius = 42;
  const strokeWidth = 6;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const color = getTrustColor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          {/* Outer ring background */}
          <circle cx="60" cy="60" r={outerRadius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
          {/* Outer ring (community) */}
          <motion.circle
            cx="60" cy="60" r={outerRadius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={outerCircumference}
            initial={{ strokeDashoffset: outerCircumference }}
            animate={{ strokeDashoffset: outerCircumference * (1 - communityScore / 100) }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          />
          {/* Inner ring background */}
          <circle cx="60" cy="60" r={innerRadius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
          {/* Inner ring (permissions) */}
          <motion.circle
            cx="60" cy="60" r={innerRadius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={innerCircumference}
            initial={{ strokeDashoffset: innerCircumference }}
            animate={{ strokeDashoffset: innerCircumference * (1 - permissionsScore / 100) }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
          />
        </svg>
        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-mono font-bold"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
            {getTrustLabel(score)}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
        <span>◯ community</span>
        <span>◯ permissions</span>
      </div>
    </div>
  );
}
