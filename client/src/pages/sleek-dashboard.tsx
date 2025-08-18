import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Home, 
  CheckSquare, 
  Plus, 
  Bot, 
  Sparkles, 
  Activity, 
  Settings,
  Search,
  Bell,
  Menu,
  X,
  ArrowRight,
  Zap,
  Target,
  TrendingUp
} from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import TodoWriteReplacement from "@/components/todowrite-replacement";
import IntegrationsStatus from "@/components/integrations-status";
import type { Project, Agent } from "@shared/schema";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  recentActivities: any[];
}

export default function SleekDashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  useWebSocket();

  // Fetch dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 15000,
  });

  // Fetch active agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['/api/agents/active'],
    refetchInterval: 15000,
  });

  const navigation = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "todowrite", label: "TodoWrite", icon: CheckSquare },
    { id: "projects", label: "Projects", icon: Target },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "recommendations", label: "Smart AI", icon: Sparkles },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "integrations", label: "Integrations", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full glass-card m-4 mr-0">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-cosmic flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ChittyPM</h1>
                <p className="text-xs text-white/60">Registry.chitty.cc</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="close-sidebar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-cosmic text-white shadow-glow' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'icon-glow' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ArrowRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </nav>

          {/* Stats Panel */}
          <div className="p-4 border-t border-white/20">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Active Projects</span>
                <span className="text-lg font-bold text-white">{stats?.activeProjects || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">AI Agents</span>
                <span className="text-lg font-bold text-white">{stats?.activeAgents || 0}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-gradient-ocean h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats?.activeProjects || 0) * 10, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Header */}
        <header className="glass-nav p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="mobile-menu-toggle"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-white capitalize">
                {activeView === "todowrite" ? "TodoWrite Replacement" : activeView}
              </h2>
              {activeView === "todowrite" && (
                <div className="status-active">MCP Protocol</div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
              <input
                type="text"
                placeholder="Search projects, tasks..."
                className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
                data-testid="global-search"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Bell className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </button>

            {/* Settings */}
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Settings className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {activeView === "overview" && <OverviewContent stats={stats} projects={projects} />}
          {activeView === "todowrite" && <TodoWriteContent />}
          {activeView === "projects" && <ProjectsContent projects={projects} />}
          {activeView === "agents" && <AgentsContent agents={agents} />}
          {activeView === "recommendations" && <RecommendationsContent />}
          {activeView === "activity" && <ActivityContent />}
          {activeView === "integrations" && <IntegrationsContent />}
        </main>
      </div>
    </div>
  );
}

// Content Components
function OverviewContent({ stats, projects }: { stats?: DashboardStats; projects: Project[] }) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium">Total Projects</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.totalProjects || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-cosmic flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-green-400 text-sm">
            <TrendingUp className="w-4 h-4 mr-1" />
            +12% from last month
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium">Active Agents</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.activeAgents || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-ocean flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-blue-400 text-sm">
            <Sparkles className="w-4 h-4 mr-1" />
            Registry.chitty.cc connected
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium">TodoWrite Tasks</p>
              <p className="text-3xl font-bold text-white mt-1">247</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-sunset flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-purple-400 text-sm">
            <Zap className="w-4 h-4 mr-1" />
            MCP Protocol Active
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">Recent Projects</h3>
        <div className="space-y-3">
          {projects.slice(0, 5).map((project) => (
            <div key={project.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-cosmic flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">{project.name}</p>
                  <p className="text-white/60 text-sm">{project.description}</p>
                </div>
              </div>
              <div className={`status-${project.status}`}>
                {project.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TodoWriteContent() {
  return (
    <div className="animate-slide-in">
      <TodoWriteReplacement />
    </div>
  );
}

function ProjectsContent({ projects }: { projects: Project[] }) {
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Projects</h3>
        <button className="btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="glass-card p-6 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                {project.name}
              </h4>
              <div className={`status-${project.status}`}>
                {project.status}
              </div>
            </div>
            <p className="text-white/60 text-sm mb-4">{project.description}</p>
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>Updated recently</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsContent({ agents }: { agents: Agent[] }) {
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">AI Agents</h3>
        <div className="status-active">Registry.chitty.cc Connected</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full glass-card p-8 text-center">
            <Bot className="w-12 h-12 text-white/40 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">No Active Agents</h4>
            <p className="text-white/60">Connect with agents from registry.chitty.cc</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="glass-card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-ocean flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">{agent.name}</h4>
                  <p className="text-white/60 text-sm">{agent.type}</p>
                </div>
              </div>
              <div className="space-y-2">
                {agent.capabilities?.slice(0, 3).map((capability, index) => (
                  <span key={index} className="inline-block bg-white/10 text-white/80 px-3 py-1 rounded-full text-xs mr-2">
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecommendationsContent() {
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Smart Recommendations</h3>
        <div className="status-active">AI Powered</div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          <h4 className="text-xl font-semibold text-white">Powered by The Registry</h4>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-cosmic/20 border border-blue-500/30">
            <h5 className="font-semibold text-white mb-2">Security Expert Pro</h5>
            <p className="text-white/70 text-sm mb-3">Perfect for authentication bug fixes with 4.8/5 rating</p>
            <div className="flex items-center justify-between">
              <span className="text-blue-400 text-sm">security-expert.chitty.eth</span>
              <button className="btn-secondary text-xs px-3 py-1">Connect</button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-ocean/20 border border-cyan-500/30">
            <h5 className="font-semibold text-white mb-2">FullStack Developer AI</h5>
            <p className="text-white/70 text-sm mb-3">Complete development solutions with modern frameworks</p>
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 text-sm">fullstack-dev.chitty.eth</span>
              <button className="btn-secondary text-xs px-3 py-1">Connect</button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-sunset/20 border border-purple-500/30">
            <h5 className="font-semibold text-white mb-2">Documentation Master</h5>
            <p className="text-white/70 text-sm mb-3">Technical writing specialist with 4.9/5 rating</p>
            <div className="flex items-center justify-between">
              <span className="text-purple-400 text-sm">docs-master.chitty.eth</span>
              <button className="btn-secondary text-xs px-3 py-1">Connect</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationsContent() {
  return (
    <div className="animate-slide-in">
      <IntegrationsStatus />
    </div>
  );
}

function ActivityContent() {
  return (
    <div className="space-y-6 animate-slide-in">
      <h3 className="text-2xl font-bold text-white">Activity Feed</h3>
      
      <div className="glass-card p-6">
        <div className="space-y-4">
          {[
            { type: "todowrite", message: "Created new task: Fix authentication bug", time: "2 minutes ago" },
            { type: "agent", message: "Security Expert Pro connected via registry.chitty.cc", time: "5 minutes ago" },
            { type: "project", message: "Updated ChittyPM project status", time: "10 minutes ago" },
            { type: "recommendation", message: "AI recommended 3 new agents for current tasks", time: "15 minutes ago" },
          ].map((activity, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-cosmic flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm">{activity.message}</p>
                <p className="text-white/60 text-xs">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}