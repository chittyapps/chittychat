import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  isGlobalMode: boolean;
  onToggleGlobalMode: (global: boolean) => void;
  dashboardStats?: any;
}

export default function Sidebar({ 
  selectedProjectId, 
  onSelectProject, 
  isGlobalMode, 
  onToggleGlobalMode,
  dashboardStats 
}: SidebarProps) {
  // Fetch projects
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch integrations
  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ['/api/integrations'],
  });

  const handleToggleMode = () => {
    onToggleGlobalMode(!isGlobalMode);
  };

  const getProjectIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'backend development':
      case 'api development':
        return 'fas fa-code';
      case 'frontend development':
        return 'fas fa-laptop-code';
      case 'database':
        return 'fas fa-database';
      case 'authentication':
        return 'fas fa-shield-alt';
      case 'integration':
        return 'fas fa-plug';
      default:
        return 'fas fa-project-diagram';
    }
  };

  const getProjectColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'backend development':
      case 'api development':
        return 'bg-blue-100 text-blue-600';
      case 'frontend development':
        return 'bg-purple-100 text-purple-600';
      case 'database':
        return 'bg-green-100 text-green-600';
      case 'authentication':
        return 'bg-red-100 text-red-600';
      case 'integration':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-400';
      case 'in_progress':
        return 'bg-yellow-400';
      case 'completed':
        return 'bg-blue-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getIntegrationStatus = (name: string) => {
    const integration = integrations.find((i: any) => i.name === name);
    return integration?.status || 'inactive';
  };

  const getIntegrationStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
            <i className="fas fa-rocket text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ChittyPM</h1>
            <p className="text-sm text-gray-500">AI Project Manager</p>
          </div>
        </div>

        {/* Project Mode Toggle */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Project Mode</span>
            <button
              onClick={handleToggleMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                isGlobalMode ? 'bg-primary-500' : 'bg-gray-300'
              }`}
              data-testid="button-toggle-mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isGlobalMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1" data-testid="text-mode-description">
            {isGlobalMode ? 'Global tracking across all agents' : 'Local project tracking only'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-100">
        <Button
          className="w-full bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center space-x-2"
          data-testid="button-new-project"
        >
          <i className="fas fa-plus"></i>
          <span>New Project</span>
        </Button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Projects</h3>
          <div className="space-y-2">
            {projects.map((project: any) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedProjectId === project.id
                    ? 'bg-primary-50 border-primary-200'
                    : 'hover:bg-gray-50 border-gray-100'
                }`}
                data-testid={`project-${project.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getProjectColor(project.category)}`}>
                      <i className={`${getProjectIcon(project.category)} text-sm`}></i>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900" data-testid={`text-project-name-${project.id}`}>
                        {project.name}
                      </h4>
                      <p className="text-xs text-gray-500" data-testid={`text-project-tasks-${project.id}`}>
                        {project.stats?.totalTasks || 0} tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} 
                      title={project.status}
                    ></div>
                    <span className="text-xs text-gray-400" data-testid={`text-project-progress-${project.id}`}>
                      {project.progress || 0}%
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No projects yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first project to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Integration Status */}
        <div className="p-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">System Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  getIntegrationStatus('chittyid') === 'active' ? 'bg-green-400' : 
                  getIntegrationStatus('chittyid') === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`}></div>
                <span className="text-gray-600">ChittyID</span>
              </div>
              <span className={`font-medium ${getIntegrationStatusColor(getIntegrationStatus('chittyid'))}`}>
                {getIntegrationStatus('chittyid') === 'active' ? 'Connected' :
                 getIntegrationStatus('chittyid') === 'error' ? 'Error' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  getIntegrationStatus('registry') === 'active' ? 'bg-green-400' : 
                  getIntegrationStatus('registry') === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`}></div>
                <span className="text-gray-600">Registry.chitty.cc</span>
              </div>
              <span className={`font-medium ${getIntegrationStatusColor(getIntegrationStatus('registry'))}`}>
                {getIntegrationStatus('registry') === 'active' ? 'Synced' :
                 getIntegrationStatus('registry') === 'error' ? 'Error' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-600">MCP Agents</span>
              </div>
              <span className="text-yellow-600 font-medium" data-testid="text-mcp-agents">
                {dashboardStats?.activeAgents || 0} Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
