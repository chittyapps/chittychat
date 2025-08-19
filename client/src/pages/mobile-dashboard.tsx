import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Brain, 
  BarChart3, 
  Home, 
  Activity, 
  Menu, 
  X,
  ChevronRight
} from "lucide-react";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  recentActivities: any[];
}

export default function MobileDashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  const navigation = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "insights", label: "Insights", icon: Brain },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Activity }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-white">ChittyPM</h1>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)}>
          <div 
            className="absolute right-0 top-[57px] w-64 h-full bg-gray-900/95 backdrop-blur-lg border-l border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="p-4">
              {navigation.map((nav) => (
                <button
                  key={nav.id}
                  onClick={() => {
                    setActiveView(nav.id);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg mb-2 transition-all ${
                    activeView === nav.id
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <nav.icon className="w-5 h-5" />
                    <span>{nav.label}</span>
                  </div>
                  {activeView === nav.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Content */}
      <div className="p-4 pb-20">
        {activeView === "overview" && (
          <div className="space-y-4">
            {/* Stats Cards - Mobile Optimized */}
            <div className="space-y-3">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Total Projects</p>
                    <p className="text-2xl font-bold text-blue-400">{stats?.totalProjects || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Active Projects</p>
                    <p className="text-2xl font-bold text-green-400">{stats?.activeProjects || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Active Agents</p>
                    <p className="text-2xl font-bold text-purple-400">{stats?.activeAgents || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities - Mobile Optimized */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Recent Activities</h2>
              {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivities.slice(0, 5).map((activity, index) => (
                    <div key={activity.id || index} className="border-l-2 border-blue-400 pl-3">
                      <p className="text-white text-sm">{activity.description}</p>
                      <p className="text-white/40 text-xs mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 text-sm">No recent activities</p>
              )}
            </div>
          </div>
        )}

        {activeView === "insights" && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-3">ChittyInsight</h2>
            <p className="text-white/60 text-sm">Advanced analytics on mobile coming soon...</p>
          </div>
        )}

        {activeView === "analytics" && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-3">Analytics</h2>
            <p className="text-white/60 text-sm">Analytics features optimized for mobile coming soon...</p>
          </div>
        )}

        {activeView === "activity" && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-3">Activity Feed</h2>
            {stats?.recentActivities && stats.recentActivities.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivities.map((activity, index) => (
                  <div key={activity.id || index} className="bg-gray-700/30 rounded-lg p-3">
                    <p className="text-white text-sm">{activity.description}</p>
                    <p className="text-white/40 text-xs mt-2">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No recent activities</p>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-white/10">
        <div className="grid grid-cols-4 p-2">
          {navigation.map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveView(nav.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                activeView === nav.id
                  ? 'text-blue-400'
                  : 'text-white/50'
              }`}
            >
              <nav.icon className="w-5 h-5" />
              <span className="text-xs">{nav.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}