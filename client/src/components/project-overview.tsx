import { useQuery } from "@tanstack/react-query";

interface ProjectOverviewProps {
  project: any;
  activeAgents: any[];
}

export default function ProjectOverview({ project, activeAgents }: ProjectOverviewProps) {
  // Fetch project stats
  const { data: projectStats } = useQuery({
    queryKey: ['/api/projects', project.id, 'stats'],
    enabled: !!project.id,
  });

  // Fetch integrations to show status
  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ['/api/integrations'],
  });

  const stats = projectStats || project.stats || {};

  const getIntegrationStatus = (name: string) => {
    const integration = integrations.find((i: any) => i.name === name);
    return integration?.status || 'inactive';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Progress Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="card-progress">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
          <i className="fas fa-chart-line text-primary-500"></i>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Completed</span>
            <span className="font-medium" data-testid="text-task-completion">
              {stats.completedTasks || 0}/{stats.totalTasks || 0} tasks
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${stats.progress || 0}%` }}
              data-testid="progress-bar"
            />
          </div>
          <div className="text-xs text-gray-500">
            Updated {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : 'recently'} by AI Agent
          </div>
        </div>
      </div>

      {/* AI Activity Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="card-ai-activity">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI Activity</h3>
          <i className="fas fa-robot text-green-500"></i>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Agents</span>
            <span className="font-medium text-green-600" data-testid="text-active-agents">
              {activeAgents.length} Connected
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Last Action</span>
            <span className="font-medium">Task Updated</span>
          </div>
          <div className="text-xs text-gray-500">
            {activeAgents.map(agent => agent.name).join(' • ') || 'No agents connected'}
          </div>
        </div>
      </div>

      {/* Integration Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="card-integrations">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
          <i className="fas fa-plug text-blue-500"></i>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">ChittyID</span>
            <span className={`font-medium ${
              getIntegrationStatus('chittyid') === 'active' ? 'text-green-600' :
              getIntegrationStatus('chittyid') === 'error' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {getIntegrationStatus('chittyid') === 'active' ? 'Synced' :
               getIntegrationStatus('chittyid') === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Registry</span>
            <span className={`font-medium ${
              getIntegrationStatus('registry') === 'active' ? 'text-green-600' :
              getIntegrationStatus('registry') === 'error' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {getIntegrationStatus('registry') === 'active' ? 'Connected' :
               getIntegrationStatus('registry') === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {integrations.every((i: any) => i.status === 'active') 
              ? 'All systems operational' 
              : 'Some integrations need attention'}
          </div>
        </div>
      </div>
    </div>
  );
}
