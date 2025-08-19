import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  recentActivities: any[];
}

export default function SimpleDashboard() {
  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading ChittyPM...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="glass-card p-6 mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">ChittyPM Dashboard</h1>
        <p className="text-white/60">Universal Project Management System</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Projects</h3>
          <p className="text-3xl font-bold text-blue-400">{stats?.totalProjects || 0}</p>
        </div>
        
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Active Projects</h3>
          <p className="text-3xl font-bold text-green-400">{stats?.activeProjects || 0}</p>
        </div>
        
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Active Agents</h3>
          <p className="text-3xl font-bold text-purple-400">{stats?.activeAgents || 0}</p>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="glass-card p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activities</h2>
        {stats?.recentActivities && stats.recentActivities.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivities.map((activity, index) => (
              <div key={activity.id || index} className="border-l-2 border-blue-400 pl-4">
                <p className="text-white">{activity.description}</p>
                <p className="text-white/50 text-sm">
                  {new Date(activity.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60">No recent activities</p>
        )}
      </div>
    </div>
  );
}