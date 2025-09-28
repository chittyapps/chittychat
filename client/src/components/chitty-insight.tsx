import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Activity, 
  Zap,
  Target,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface InsightData {
  projectPerformance: {
    averageCompletionTime: number;
    successRate: number;
    bottlenecks: string[];
  };
  agentAnalytics: {
    mostActiveAgents: Array<{
      name: string;
      tasksCompleted: number;
      efficiency: number;
    }>;
    collaborationScore: number;
  };
  workflowInsights: {
    peakHours: string[];
    commonCategories: Array<{
      category: string;
      count: number;
    }>;
    recommendations: string[];
  };
  systemHealth: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    integrationStatus: Array<{
      name: string;
      status: "healthy" | "warning" | "error";
      lastSync: string;
    }>;
  };
}

export default function ChittyInsight() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch insight data from ChittyBeacon and other sources
  const { data: insights, isLoading } = useQuery<InsightData>({
    queryKey: ['/api/insights/analytics'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Mock data for demonstration since we don't have the endpoint yet
  const mockInsights: InsightData = {
    projectPerformance: {
      averageCompletionTime: 4.2,
      successRate: 87.5,
      bottlenecks: ["Agent Allocation", "Task Prioritization", "Cross-project Dependencies"]
    },
    agentAnalytics: {
      mostActiveAgents: [
        { name: "TodoWrite Agent", tasksCompleted: 234, efficiency: 92 },
        { name: "Registry Sync Agent", tasksCompleted: 156, efficiency: 88 },
        { name: "ChittyID Agent", tasksCompleted: 89, efficiency: 78 }
      ],
      collaborationScore: 84
    },
    workflowInsights: {
      peakHours: ["9:00-11:00", "14:00-16:00", "20:00-22:00"],
      commonCategories: [
        { category: "Integration Testing", count: 45 },
        { category: "MCP Testing", count: 32 },
        { category: "Automation", count: 28 },
        { category: "Testing", count: 23 }
      ],
      recommendations: [
        "Consider automated task prioritization during peak hours",
        "Optimize agent allocation for Integration Testing projects",
        "Implement pre-emptive conflict resolution for MCP tasks"
      ]
    },
    systemHealth: {
      uptime: 99.8,
      responseTime: 145,
      errorRate: 0.3,
      integrationStatus: [
        { name: "ChittyBeacon", status: "healthy", lastSync: "2 minutes ago" },
        { name: "registry.chitty.cc", status: "healthy", lastSync: "5 minutes ago" },
        { name: "ChittyID", status: "warning", lastSync: "2 hours ago" }
      ]
    }
  };

  const currentData = insights || mockInsights;

  const tabs = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "agents", label: "Agents", icon: Users },
    { id: "workflows", label: "Workflows", icon: Activity },
    { id: "system", label: "System", icon: Zap }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">ChittyInsight</h1>
            <p className="text-white/60">Advanced Analytics & Intelligence Dashboard</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Metrics */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Key Performance Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Project Success Rate</span>
                <span className="text-green-400 font-bold">{currentData.projectPerformance.successRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80">Avg. Completion Time</span>
                <span className="text-blue-400 font-bold">{currentData.projectPerformance.averageCompletionTime} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80">Agent Collaboration Score</span>
                <span className="text-purple-400 font-bold">{currentData.agentAnalytics.collaborationScore}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80">System Uptime</span>
                <span className="text-green-400 font-bold">{currentData.systemHealth.uptime}%</span>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Integration Health
            </h3>
            <div className="space-y-3">
              {currentData.systemHealth.integrationStatus.map((integration, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(integration.status)}
                    <span className="text-white font-medium">{integration.name}</span>
                  </div>
                  <span className="text-white/60 text-sm">{integration.lastSync}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* Performance Charts */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Performance Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-400/20">
                <div className="text-2xl font-bold text-green-400">{currentData.projectPerformance.successRate}%</div>
                <div className="text-white/60">Success Rate</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-400/20">
                <div className="text-2xl font-bold text-blue-400">{currentData.systemHealth.responseTime}ms</div>
                <div className="text-white/60">Avg Response Time</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-400/20">
                <div className="text-2xl font-bold text-purple-400">{currentData.systemHealth.errorRate}%</div>
                <div className="text-white/60">Error Rate</div>
              </div>
            </div>
          </div>

          {/* Bottlenecks */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Identified Bottlenecks</h3>
            <div className="space-y-2">
              {currentData.projectPerformance.bottlenecks.map((bottleneck, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-400/20">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-white">{bottleneck}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "agents" && (
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Agent Analytics
          </h3>
          <div className="space-y-4">
            {currentData.agentAnalytics.mostActiveAgents.map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div>
                  <div className="text-white font-medium">{agent.name}</div>
                  <div className="text-white/60 text-sm">{agent.tasksCompleted} tasks completed</div>
                </div>
                <div className="text-right">
                  <div className="text-blue-400 font-bold">{agent.efficiency}%</div>
                  <div className="text-white/60 text-sm">efficiency</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "workflows" && (
        <div className="space-y-6">
          {/* Peak Hours */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Peak Activity Hours</h3>
            <div className="flex flex-wrap gap-2">
              {currentData.workflowInsights.peakHours.map((hour, index) => (
                <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                  {hour}
                </span>
              ))}
            </div>
          </div>

          {/* Common Categories */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Popular Project Categories</h3>
            <div className="space-y-3">
              {currentData.workflowInsights.commonCategories.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-white">{category.category}</span>
                  <span className="text-blue-400 font-bold">{category.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              AI Recommendations
            </h3>
            <div className="space-y-3">
              {currentData.workflowInsights.recommendations.map((recommendation, index) => (
                <div key={index} className="p-4 rounded-lg bg-purple-500/10 border border-purple-400/20">
                  <p className="text-white">{recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            System Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-3">System Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/80">Uptime</span>
                  <span className="text-green-400">{currentData.systemHealth.uptime}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Response Time</span>
                  <span className="text-blue-400">{currentData.systemHealth.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/80">Error Rate</span>
                  <span className="text-red-400">{currentData.systemHealth.errorRate}%</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Integration Status</h4>
              <div className="space-y-2">
                {currentData.systemHealth.integrationStatus.map((integration, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {getStatusIcon(integration.status)}
                    <span className="text-white">{integration.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}