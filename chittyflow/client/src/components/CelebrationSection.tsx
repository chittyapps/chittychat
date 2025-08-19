import { useQuery } from "@tanstack/react-query";
import { Trophy, Check } from "lucide-react";

export function CelebrationSection() {
  const { data: winsData, isLoading } = useQuery({
    queryKey: ["/api/analytics/wins"],
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const celebrations = winsData?.celebrations || [];
  const completedTasks = winsData?.tasks || [];
  const streak = winsData?.streak || 0;

  const allWins = [
    ...celebrations.map((c: any) => ({
      ...c,
      icon: c.type === 'auto_handled' ? 'auto' : 'celebration'
    })),
    ...completedTasks.map((t: any) => ({
      title: `Completed: ${t.title}`,
      description: "You powered through this task!",
      type: 'task_completed',
      icon: 'task'
    }))
  ].slice(0, 5);

  const getWinColor = (type: string) => {
    switch (type) {
      case 'auto_handled': return 'mint';
      case 'task_completed': return 'sage';
      case 'streak': return 'warmBlue';
      default: return 'coral';
    }
  };

  const getWinBadge = (type: string) => {
    switch (type) {
      case 'auto_handled': return 'Auto-handled';
      case 'task_completed': return 'You did this!';
      case 'streak': return 'Streak!';
      default: return 'Win!';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-charcoal flex items-center">
          <Trophy className="text-coral mr-3 w-5 h-5" />
          Today's Wins
        </h2>
        <span className="text-sm text-charcoal/60 bg-coral/10 px-3 py-1 rounded-full">
          Building momentum
        </span>
      </div>
      
      <div className="space-y-4">
        {allWins.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-sage w-8 h-8" />
            </div>
            <p className="text-charcoal/60 mb-2">Your wins will appear here!</p>
            <p className="text-sm text-charcoal/50">
              Complete a task or let me handle something for you to see your first celebration.
            </p>
          </div>
        ) : (
          allWins.map((win: any, index: number) => {
            const color = getWinColor(win.type);
            const badge = getWinBadge(win.type);
            
            return (
              <div key={index} className={`flex items-center p-4 bg-${color}/5 rounded-xl border-l-4 border-${color}`}>
                <div className={`w-8 h-8 bg-${color}/20 rounded-full flex items-center justify-center mr-4`}>
                  <Check className={`text-${color} w-4 h-4`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-charcoal">{win.title}</p>
                  <p className="text-sm text-charcoal/60">{win.description}</p>
                </div>
                <span className={`text-xs text-${color} bg-${color}/10 px-2 py-1 rounded`}>
                  {badge}
                </span>
              </div>
            );
          })
        )}
      </div>
      
      {streak > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-coral/10 to-sage/10 rounded-xl">
          <p className="text-sm text-charcoal font-medium">
            🎉 Fantastic progress today! You're building incredible momentum. 
            {streak > 3 && ` ${streak} days of consistent progress!`}
          </p>
        </div>
      )}
    </div>
  );
}
