import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import ProjectOverview from "@/components/project-overview";
import TaskList from "@/components/task-list";
import ActivityFeed from "@/components/activity-feed";
import QuickAddTask from "@/components/quick-add-task";
import IntegrationsView from "@/components/integrations-view";
import { useWebSocket } from "@/hooks/use-websocket";
import type { Project, Agent } from "@shared/schema";

export default function Dashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isGlobalMode, setIsGlobalMode] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        isGlobalMode={isGlobalMode}
        onToggleGlobalMode={setIsGlobalMode}
        dashboardStats={dashboardStats}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                {selectedProject?.name || "ChittyPM Dashboard"}
              </h2>
              {selectedProject && (
                <span 
                  className={`px-3 py-1 text-sm font-medium rounded-full ${
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

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  data-testid="input-search"
                />
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>

              {/* AI Agent Indicator */}
              <div 
                className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg"
                data-testid="agent-indicator"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">AI Agents Active</span>
                <span className="text-sm font-medium text-gray-900" data-testid="active-agent-count">
                  {activeAgents.length}
                </span>
              </div>
            </div>
          </div>

          {/* Project Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["overview", "tasks", "timeline", "agents-log", "integrations"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 py-2 px-1 text-sm font-medium ${
                    activeTab === tab
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  data-testid={`tab-${tab}`}
                >
                  {tab.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <>
              {/* Project Overview Cards */}
              {selectedProject && (
                <ProjectOverview 
                  project={selectedProject} 
                  activeAgents={activeAgents}
                />
              )}

              {/* Quick Add Task */}
              {selectedProject && (
                <QuickAddTask projectId={selectedProject.id} />
              )}

              {/* Task List */}
              {selectedProject && (
                <TaskList projectId={selectedProject.id} />
              )}

              {/* Recent Activity */}
              <ActivityFeed 
                projectId={selectedProject?.id} 
                limit={10} 
              />
            </>
          )}

          {activeTab === "tasks" && selectedProject && (
            <TaskList projectId={selectedProject.id} />
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
            <IntegrationsView />
          )}
        </main>
      </div>
    </div>
  );
}
