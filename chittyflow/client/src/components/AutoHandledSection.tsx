import { useQuery } from "@tanstack/react-query";
import { Sparkles, Mail, Calendar, FileText, Brain } from "lucide-react";

export function AutoHandledSection() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/auto-activities"],
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'calendar': return Calendar;
      case 'document': return FileText;
      case 'context_switching': return Brain;
      default: return Sparkles;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'email': return 'warmBlue';
      case 'calendar': return 'mint';
      case 'document': return 'coral';
      case 'context_switching': return 'sage';
      default: return 'warmBlue';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Running smoothly';
      case 'completed': return 'Complete';
      case 'paused': return 'Paused';
      default: return 'Active';
    }
  };

  // Default activities if none exist
  const defaultActivities = [
    {
      type: 'email',
      title: 'Email Management',
      description: 'Sorting, responding to routine emails, flagging important ones',
      status: 'active'
    },
    {
      type: 'calendar',
      title: 'Calendar Optimization',
      description: 'Managing meeting prep, sending reminders, updating attendees',
      status: 'active'
    },
    {
      type: 'document',
      title: 'Document Organization',
      description: 'Filing, naming, and organizing your files automatically',
      status: 'active'
    },
    {
      type: 'context_switching',
      title: 'Context Switching',
      description: 'Saving your place when you switch tasks, gentle re-entry',
      status: 'active'
    }
  ];

  const displayActivities = activities.length > 0 ? activities : defaultActivities;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-charcoal flex items-center">
          <Sparkles className="text-warmBlue mr-3 w-5 h-5" />
          I've Got This Covered
        </h2>
        <span className="text-sm text-warmBlue bg-warmBlue/10 px-3 py-1 rounded-full">
          Auto-pilot engaged
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayActivities.map((activity: any, index: number) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);
          const statusLabel = getStatusLabel(activity.status);
          
          return (
            <div key={activity.id || index} className={`p-4 bg-${color}/5 rounded-xl border border-${color}/10`}>
              <div className="flex items-center mb-2">
                <Icon className={`text-${color} mr-2 w-5 h-5`} />
                <span className="font-medium text-charcoal">{activity.title}</span>
              </div>
              <p className="text-sm text-charcoal/60 mb-2">{activity.description}</p>
              <span className={`text-xs text-${color} bg-${color}/10 px-2 py-1 rounded`}>
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-gradient-to-r from-sage/5 to-mint/5 rounded-xl border border-sage/10">
        <p className="text-sm text-charcoal text-center">
          ✨ While you focus on what matters most, I'm quietly handling the routine stuff in the background.
        </p>
      </div>
    </div>
  );
}
