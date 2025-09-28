import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Clock, Target } from "lucide-react";

export function InsightCard() {
  const { data: winsData } = useQuery({
    queryKey: ["/api/analytics/wins"],
  });

  const { data: energyData } = useQuery({
    queryKey: ["/api/energy"],
  });

  const streak = winsData?.streak || 0;
  const recentLogs = energyData?.logs || [];
  
  // Simple analysis of energy patterns
  const highEnergyCount = recentLogs.filter((log: any) => log.energyLevel === 'high').length;
  const mediumEnergyCount = recentLogs.filter((log: any) => log.energyLevel === 'medium').length;
  const lowEnergyCount = recentLogs.filter((log: any) => log.energyLevel === 'low').length;
  
  const mostCommonEnergy = highEnergyCount >= mediumEnergyCount && highEnergyCount >= lowEnergyCount 
    ? 'high' 
    : mediumEnergyCount >= lowEnergyCount 
    ? 'medium' 
    : 'low';

  const getEnergyAdvice = (level: string) => {
    switch (level) {
      case 'high':
        return 'You have great focus periods! Try scheduling deep work during your peak times.';
      case 'medium':
        return 'You maintain steady energy well. Perfect for consistent progress on projects.';
      case 'low':
        return 'You honor your need for rest. This self-awareness is a superpower.';
      default:
        return 'Keep tracking your energy - patterns will emerge that help optimize your day.';
    }
  };

  const getStreakMessage = (streak: number) => {
    if (streak === 0) return 'Every journey starts with a single step. You\'re building something amazing.';
    if (streak === 1) return 'You\'re getting started! One day of progress is worth celebrating.';
    if (streak < 7) return `${streak} days of showing up! You\'re building incredible momentum.`;
    return `${streak} days of consistent progress! You\'ve created an amazing habit.`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center">
        <TrendingUp className="text-warmBlue mr-3 w-5 h-5" />
        Pattern Insights
      </h3>
      
      <div className="space-y-4">
        <div className="bg-warmBlue/5 p-4 rounded-xl border border-warmBlue/10">
          <div className="flex items-center mb-2">
            <Clock className="text-warmBlue mr-2 w-4 h-4" />
            <p className="text-sm font-medium text-charcoal">Energy Patterns</p>
          </div>
          <p className="text-xs text-charcoal/60">
            {getEnergyAdvice(mostCommonEnergy)}
          </p>
        </div>
        
        <div className="bg-mint/5 p-4 rounded-xl border border-mint/10">
          <div className="flex items-center mb-2">
            <Target className="text-mint mr-2 w-4 h-4" />
            <p className="text-sm font-medium text-charcoal">Progress Streak</p>
          </div>
          <p className="text-xs text-charcoal/60">
            {getStreakMessage(streak)}
          </p>
        </div>
        
        {recentLogs.length > 0 && (
          <div className="bg-sage/5 p-4 rounded-xl border border-sage/10">
            <p className="text-sm font-medium text-charcoal mb-1">Recent Insight</p>
            <p className="text-xs text-charcoal/60">
              You've been mindful about tracking your energy - this self-awareness will help you work with your natural rhythms.
            </p>
          </div>
        )}
        
        {recentLogs.length === 0 && (
          <div className="bg-coral/5 p-4 rounded-xl border border-coral/10">
            <p className="text-sm font-medium text-charcoal mb-1">Getting Started</p>
            <p className="text-xs text-charcoal/60">
              Try checking in with your energy levels throughout the week. You'll start to notice helpful patterns!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
