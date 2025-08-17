import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, CheckSquare, Plus, Bot, Clock, Puzzle, Star, Menu, X } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ProjectOverview from "@/components/project-overview";
import TaskList from "@/components/task-list";
import ActivityFeed from "@/components/activity-feed";
import QuickAddTask from "@/components/quick-add-task";
import IntegrationsView from "@/components/integrations-view";
import SmartRecommendations from "@/components/smart-recommendations";
import ReputationLeaderboard from "@/components/reputation-leaderboard";
import OverviewDashboard from "@/components/overview-dashboard";
import TodoWriteReplacement from "@/components/todowrite-replacement";
import { useWebSocket } from "@/hooks/use-websocket";
import type { Project, Agent } from "@shared/schema";

export default function Dashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isGlobalMode, setIsGlobalMode] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // WebSocket connection for real-time updates
  useWebSocket();

  // Fetch dashboard stats
  const { data: dashboardStats } = useQuery<{
    totalProjects: number;
    activeProjects: number;
    activeAgents: number;
    recentActivities: any[];
  }>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch selected project details
  const { data: selectedProject } = useQuery<Project>({
    queryKey: ['/api/projects', selectedProjectId],
    enabled: !!selectedProjectId,
  });

  // Fetch active agents
  const { data: activeAgents = [] } = useQuery<Agent[]>({
    queryKey: ['/api/agents/active'],
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg glass"
        data-testid="mobile-menu-toggle"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar - Mobile Overlay */}
      <div className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className={`absolute left-0 top-0 h-full w-80 max-w-xs transform transition-transform ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <Sidebar
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setIsMobileMenuOpen(false);
            }}
            isGlobalMode={isGlobalMode}
            onToggleGlobalMode={setIsGlobalMode}
            dashboardStats={dashboardStats}
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          isGlobalMode={isGlobalMode}
          onToggleGlobalMode={setIsGlobalMode}
          dashboardStats={dashboardStats}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="glass border-b border-white/20 mobile-padding">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4 ml-16 lg:ml-0">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900" data-testid="page-title">
                {selectedProject?.name || "ChittyPM Dashboard"}
              </h2>
              {selectedProject && (
                <span 
                  className={`px-2 lg:px-3 py-1 text-xs lg:text-sm font-medium rounded-full ${
                    selectedProject.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedProject.status === 'completed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  data-testid="project-status"
                >
                  {selectedProject.status === 'active' ? 'Active' : 
                   selectedProject.status === 'completed' ? 'Completed' : 'Archived'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent glass"
                  data-testid="input-search"
                />
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>

              {/* AI Agent Indicator */}
              <div 
                className="flex items-center justify-center space-x-2 px-3 py-2 glass rounded-lg animate-pulse-glow"
                data-testid="agent-indicator"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse status-indicator online"></div>
                <span className="text-xs lg:text-sm text-gray-600">AI Agents</span>
                <span className="text-xs lg:text-sm font-bold text-gray-900" data-testid="active-agent-count">
                  {activeAgents.length}
                </span>
              </div>
            </div>
          </div>

          {/* Project Tabs - Mobile Scrollable */}
          <div className="mt-4 border-b border-white/20">
            <nav className="-mb-px flex space-x-2 lg:space-x-8 overflow-x-auto custom-scrollbar pb-2">
              {["overview", "todowrite", "tasks", "timeline", "agents-log", "integrations", "recommendations", "reputation"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 border-b-2 py-2 px-3 lg:px-1 text-xs lg:text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "border-primary-500 text-primary-600 bg-primary-50 rounded-t-lg"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-white/50 rounded-t-lg"
                  }`}
                  data-testid={`tab-${tab}`}
                >
                  {tab === 'todowrite' ? 'TodoWrite' :
                   tab === 'recommendations' ? 'Smart Lists' : 
                   tab === 'reputation' ? 'Reputation' :
                   tab.split('-').map(word => 
                     word.charAt(0).toUpperCase() + word.slice(1)
                   ).join(' ')}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-br from-white/50 to-blue-50/50">
          {activeTab === "overview" && (
            <div className="animate-fade-in-up">
              <OverviewDashboard />
            </div>
          )}

          {activeTab === "todowrite" && (
            <div className="animate-fade-in-up">
              <TodoWriteReplacement />
            </div>
          )}

          {activeTab === "tasks" && selectedProject && (
            <div className="animate-fade-in-up mobile-padding">
              <TaskList projectId={selectedProject.id} />
            </div>
          )}

          {activeTab === "agents-log" && (
            <ActivityFeed 
              projectId={selectedProject?.id} 
              limit={50}
              title="Agent Activity Log"
            />
          )}

          {/* Add other tab content as needed */}
          {activeTab === "timeline" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Timeline</h3>
              <p className="text-gray-500">Timeline view coming soon...</p>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="animate-fade-in-up mobile-padding">
              <IntegrationsView />
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className="animate-fade-in-up mobile-padding space-y-6">
              {selectedProject ? (
                <SmartRecommendations 
                  type="project" 
                  targetId={selectedProject.id}
                  title={`Smart Lists for ${selectedProject.name}`}
                />
              ) : (
                <SmartRecommendations 
                  type="user" 
                  targetId="default-user"
                  title="Personal Smart Lists"
                />
              )}
            </div>
          )}

          {activeTab === "reputation" && (
            <div className="animate-fade-in-up mobile-padding">
              <ReputationLeaderboard />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
