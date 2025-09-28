import { useQuery } from "@tanstack/react-query";

interface ActivityFeedProps {
  projectId?: string;
  limit?: number;
  title?: string;
}

export default function ActivityFeed({ projectId, limit = 10, title = "Recent Activity" }: ActivityFeedProps) {
  // Fetch activities
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/activities', { projectId, limit }],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_completed':
        return { icon: 'fas fa-check', color: 'bg-green-100 text-green-600' };
      case 'task_created':
        return { icon: 'fas fa-plus', color: 'bg-blue-100 text-blue-600' };
      case 'task_updated':
        return { icon: 'fas fa-edit', color: 'bg-yellow-100 text-yellow-600' };
      case 'project_created':
        return { icon: 'fas fa-folder-plus', color: 'bg-purple-100 text-purple-600' };
      case 'project_organized':
        return { icon: 'fas fa-magic', color: 'bg-purple-100 text-purple-600' };
      case 'chittyid_sync':
      case 'registry_sync':
        return { icon: 'fas fa-sync', color: 'bg-indigo-100 text-indigo-600' };
      case 'data_repair':
        return { icon: 'fas fa-wrench', color: 'bg-orange-100 text-orange-600' };
      case 'agent_connected':
        return { icon: 'fas fa-robot', color: 'bg-green-100 text-green-600' };
      case 'agent_disconnected':
        return { icon: 'fas fa-unlink', color: 'bg-gray-100 text-gray-600' };
      default:
        return { icon: 'fas fa-info-circle', color: 'bg-gray-100 text-gray-600' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const getActivityDescription = (activity: any) => {
    if (activity.description) return activity.description;
    
    // Fallback descriptions for activities without custom descriptions
    switch (activity.type) {
      case 'task_completed':
        return 'Task was completed';
      case 'task_created':
        return 'New task was created';
      case 'task_updated':
        return 'Task was updated';
      case 'project_created':
        return 'New project was created';
      default:
        return 'Activity occurred';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="activity-feed">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {activities.length === 0 ? (
        <div className="text-center py-8">
          <i className="fas fa-history text-gray-300 text-3xl mb-3"></i>
          <p className="text-gray-500">No recent activity</p>
          <p className="text-xs text-gray-400 mt-1">
            Activity will appear here when agents start working on tasks
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity: any) => {
            const { icon, color } = getActivityIcon(activity.type);
            
            return (
              <div 
                key={activity.id} 
                className="flex items-start space-x-3"
                data-testid={`activity-${activity.id}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                  <i className={`${icon} text-sm`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900" data-testid={`text-activity-description-${activity.id}`}>
                    {activity.agentId && (
                      <span className="font-medium">{activity.agent?.name || 'AI Agent'}</span>
                    )}
                    {activity.userId && (
                      <span className="font-medium">{activity.user?.username || 'User'}</span>
                    )}
                    {!activity.agentId && !activity.userId && (
                      <span className="font-medium">System</span>
                    )}
                    {' '}
                    {getActivityDescription(activity)}
                  </p>
                  <p 
                    className="text-xs text-gray-500" 
                    data-testid={`text-activity-timestamp-${activity.id}`}
                  >
                    {formatTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
