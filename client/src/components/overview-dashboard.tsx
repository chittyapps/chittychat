import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Cpu,
  Database,
  Globe,
  Shield,
  Gauge
} from "lucide-react";

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
  uptime: string;
  lastSync: string;
}

interface WorkloadItem {
  id: string;
  title: string;
  type: 'urgent' | 'normal' | 'low';
  progress: number;
  assignedAgent?: string;
  eta?: string;
  status: 'active' | 'pending' | 'completed' | 'blocked';
}

export default function OverviewDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mock system metrics (would come from real monitoring)
  const systemMetrics: SystemMetrics = {
    cpuUsage: 78,
    memoryUsage: 65,
    activeConnections: 142,
    requestsPerMinute: 1250,
    uptime: "7d 14h 32m",
    lastSync: "2 minutes ago"
  };

  // Mock workload data
  const workloadItems: WorkloadItem[] = [
    {
      id: '1',
      title: 'ETH Registry Sync',
      type: 'urgent',
      progress: 85,
      assignedAgent: 'Registry Bot',
      eta: '5 min',
      status: 'active'
    },
    {
      id: '2', 
      title: 'Reputation Analysis',
      type: 'normal',
      progress: 60,
      assignedAgent: 'Analysis Agent',
      eta: '15 min',
      status: 'active'
    },
    {
      id: '3',
      title: 'Smart Recommendations',
      type: 'normal',
      progress: 100,
      status: 'completed'
    },
    {
      id: '4',
      title: 'Blockchain Verification',
      type: 'urgent',
      progress: 25,
      assignedAgent: 'Verification Bot',
      eta: '30 min',
      status: 'pending'
    }
  ];

  const { data: dashboardStats } = useQuery<{
    totalProjects: number;
    activeProjects: number;
    activeAgents: number;
    recentActivities: any[];
  }>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 10000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'pending': return 'text-yellow-500';
      case 'completed': return 'text-blue-500';
      case 'blocked': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'cpu': return <Cpu className="w-5 h-5" />;
      case 'memory': return <Database className="w-5 h-5" />;
      case 'connections': return <Globe className="w-5 h-5" />;
      case 'requests': return <Activity className="w-5 h-5" />;
      default: return <Gauge className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6 mobile-padding">
      {/* Header with Time and Status */}
      <div className="glass rounded-2xl p-6 bg-gradient-primary text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-bold">System Overview</h1>
            <p className="text-white/80">Real-time monitoring and workload management</p>
          </div>
          <div className="text-right">
            <div className="text-2xl lg:text-3xl font-mono font-bold">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-white/80">
              {currentTime.toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* System Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          className={`glass rounded-xl p-4 card-hover cursor-pointer transition-all ${
            selectedMetric === 'cpu' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setSelectedMetric(selectedMetric === 'cpu' ? null : 'cpu')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <span className={`text-sm ${systemMetrics.cpuUsage > 80 ? 'text-red-500' : 'text-green-500'}`}>
              {systemMetrics.cpuUsage > 80 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{systemMetrics.cpuUsage}%</p>
            <p className="text-sm text-gray-600">CPU Usage</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                systemMetrics.cpuUsage > 80 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${systemMetrics.cpuUsage}%` }}
            ></div>
          </div>
        </div>

        <div 
          className={`glass rounded-xl p-4 card-hover cursor-pointer transition-all ${
            selectedMetric === 'memory' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() => setSelectedMetric(selectedMetric === 'memory' ? null : 'memory')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-green-500">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{systemMetrics.memoryUsage}%</p>
            <p className="text-sm text-gray-600">Memory</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${systemMetrics.memoryUsage}%` }}
            ></div>
          </div>
        </div>

        <div 
          className={`glass rounded-xl p-4 card-hover cursor-pointer transition-all ${
            selectedMetric === 'connections' ? 'ring-2 ring-purple-500' : ''
          }`}
          onClick={() => setSelectedMetric(selectedMetric === 'connections' ? null : 'connections')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-green-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{systemMetrics.activeConnections}</p>
            <p className="text-sm text-gray-600">Connections</p>
          </div>
        </div>

        <div 
          className={`glass rounded-xl p-4 card-hover cursor-pointer transition-all ${
            selectedMetric === 'requests' ? 'ring-2 ring-orange-500' : ''
          }`}
          onClick={() => setSelectedMetric(selectedMetric === 'requests' ? null : 'requests')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-green-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{systemMetrics.requestsPerMinute}</p>
            <p className="text-sm text-gray-600">Req/min</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Workload */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Active Workload</h3>
            <div className="flex items-center space-x-2">
              <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>

          <div className="space-y-4">
            {workloadItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-100 card-hover">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(item.type)}`}>
                      {item.type.toUpperCase()}
                    </div>
                    <h4 className="font-medium text-gray-900">{item.title}</h4>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(item.status)}`}>
                    {item.status === 'active' && <Zap className="w-4 h-4" />}
                    {item.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                    {item.status === 'pending' && <Clock className="w-4 h-4" />}
                    {item.status === 'blocked' && <AlertTriangle className="w-4 h-4" />}
                    <span className="text-sm font-medium capitalize">{item.status}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{item.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        item.progress === 100 ? 'bg-green-500' : 
                        item.type === 'urgent' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                  
                  {(item.assignedAgent || item.eta) && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      {item.assignedAgent && (
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span>{item.assignedAgent}</span>
                        </span>
                      )}
                      {item.eta && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>ETA: {item.eta}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-6">
          {/* Project Stats */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Project Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Projects</span>
                <span className="text-2xl font-bold text-gray-900">{dashboardStats?.totalProjects || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active</span>
                <span className="text-2xl font-bold text-green-600">{dashboardStats?.activeProjects || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">AI Agents</span>
                <span className="text-2xl font-bold text-blue-600">{dashboardStats?.activeAgents || 0}</span>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Uptime</span>
                <span className="font-medium text-green-600">{systemMetrics.uptime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Sync</span>
                <span className="font-medium text-gray-900">{systemMetrics.lastSync}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">All systems operational</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors">
                Sync Registry
              </button>
              <button className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors">
                Refresh Data
              </button>
              <button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition-colors">
                Run Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}