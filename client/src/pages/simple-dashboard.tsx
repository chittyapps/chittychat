import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, BarChart3, Home, Activity } from "lucide-react";
import ChittyInsight from "@/components/chitty-insight";
import HeroOverview from "@/components/hero-overview";
import { useWebSocket } from "@/hooks/use-websocket";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  recentActivities: any[];
}

export default function SimpleDashboard() {
  const [activeView, setActiveView] = useState("overview");

  // Initialize WebSocket connection - temporarily disabled due to server issues
  // useWebSocket();

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading ChittyChat...</div>
      </div>
    );
  }

  const navigation = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "insights", label: "ChittyInsight", icon: Brain },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Activity }
  ];

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="glass-card p-6 mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">ChittyChat Dashboard</h1>
        <p className="text-white/60">The ultimate middleware platform for AI coordination</p>
        
        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          {navigation.map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveView(nav.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeView === nav.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <nav.icon className="w-4 h-4" />
              {nav.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === "overview" && (
        <div className="space-y-8">
          {/* Premium Hero Overview */}
          <HeroOverview />
          
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
      )}

      {activeView === "insights" && (
        <ChittyInsight />
      )}

      {activeView === "analytics" && (
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Analytics Dashboard</h2>
          <p className="text-white/60">Advanced analytics features coming soon...</p>
        </div>
      )}

      {activeView === "activity" && (
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Activity Feed</h2>
          {stats?.recentActivities && stats.recentActivities.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivities.map((activity, index) => (
                <div key={activity.id || index} className="glass-card p-4">
                  <p className="text-white">{activity.description}</p>
                  <p className="text-white/50 text-sm mt-2">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No recent activities</p>
          )}
        </div>
      )}
    </div>
  );
}