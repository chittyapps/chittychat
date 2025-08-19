import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ModernMetricProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: 'purple' | 'blue' | 'cyan' | 'green' | 'amber' | 'red';
  delay?: number;
}

export function ModernMetric({ title, value, icon: Icon, color, delay = 0 }: ModernMetricProps) {
  const colorMap = {
    purple: 'var(--aribia-purple)',
    blue: 'var(--aribia-blue)',
    cyan: 'var(--aribia-cyan)',
    green: 'var(--aribia-green)',
    amber: 'var(--aribia-amber)',
    red: 'var(--aribia-red)'
  };

  return (
    <motion.div
      className="metric-card modern-card rounded-2xl p-6 smooth-hover hover:scale-105"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="flex items-center justify-between mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${colorMap[color]}20` }}
        >
          <Icon size={20} style={{ color: colorMap[color] }} />
        </div>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[color] }}></div>
      </div>
      
      <div>
        <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}