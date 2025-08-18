import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Bot, 
  Users, 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  Zap,
  Target,
  ArrowRight,
  Calendar,
  User,
  Sparkles,
  Network
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Task } from "@shared/schema";

interface UniversalPMBoardProps {
  project: Project;
}

interface TaskWithAgents extends Task {
  assignedAgents?: string[];
  agentActivity?: Array<{
    agentName: string;
    action: string;
    timestamp: string;
  }>;
}

export default function UniversalPMBoard({ project }: UniversalPMBoardProps) {
  const [newTaskContent, setNewTaskContent] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<"low" | "medium" | "high">("medium");
  const [activeAgents, setActiveAgents] = useState<number>(0);
  const queryClient = useQueryClient();

  // Fetch all tasks for this project's universal board
  const { data: tasks = [], isLoading } = useQuery<TaskWithAgents[]>({
    queryKey: ['/api/projects', project.id, 'board'],
    refetchInterval: 5000, // Real-time updates
  });

  // Fetch active agents working on this project
  const { data: projectAgents = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', project.id, 'agents'],
    refetchInterval: 10000,
  });

  // Create task mutation (replaces todowrite for ALL agents)
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { 
      title: string; 
      priority: string; 
      projectId: string;
      source: 'human' | 'agent' | 'mcp';
      agentName?: string;
    }) => {
      return apiRequest('/api/mcp/universal-todowrite', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'board'] });
      setNewTaskContent("");
    },
  });

  // Update task status
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, agentName }: { 
      taskId: string; 
      status: string; 
      agentName?: string;
    }) => {
      return apiRequest(`/api/mcp/universal-todowrite/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, agentName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'board'] });
    },
  });

  const handleCreateTask = () => {
    if (!newTaskContent.trim()) return;
    
    createTaskMutation.mutate({
      title: newTaskContent,
      priority: selectedPriority,
      projectId: project.id,
      source: 'human'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in_progress": return "bg-blue-500";
      case "blocked": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-400 bg-red-500/20";
      case "medium": return "border-yellow-400 bg-yellow-500/20";
      case "low": return "border-blue-400 bg-blue-500/20";
      default: return "border-gray-400 bg-gray-500/20";
    }
  };

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
    blocked: tasks.filter(t => t.status === 'blocked')
  };

  useEffect(() => {
    setActiveAgents(projectAgents.length);
  }, [projectAgents]);

  return (
    <div className="space-y-6">
      {/* Universal Board Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-cosmic flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-white/60">Universal PM Board - All Agents Connected</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 glass-card px-4 py-2 rounded-xl">
              <Network className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm font-medium">{activeAgents} Active Agents</span>
            </div>
            
            <div className="flex items-center space-x-2 glass-card px-4 py-2 rounded-xl">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-white text-sm font-medium">MCP Protocol</span>
            </div>
            
            <div className="status-active">TodoWrite Replaced</div>
          </div>
        </div>

        {/* Task Creation (Universal Interface) */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-white/80 text-sm mb-2">
            <Sparkles className="w-4 h-4" />
            <span>This replaces todowrite for ALL agents - they all use this same board</span>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <textarea
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                placeholder="Add task to universal board... (e.g., Fix authentication bug - all agents see this)"
                className="glass-input w-full px-4 py-3 resize-none h-20"
                data-testid="universal-task-input"
              />
            </div>
            
            <div className="flex flex-col lg:w-64 space-y-2">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as "low" | "medium" | "high")}
                className="glass-input px-3 py-2 text-sm"
                data-testid="priority-select"
              >
                <option value="low" className="bg-gray-800">Low Priority</option>
                <option value="medium" className="bg-gray-800">Medium Priority</option>
                <option value="high" className="bg-gray-800">High Priority</option>
              </select>
              
              <button
                onClick={handleCreateTask}
                disabled={!newTaskContent.trim() || createTaskMutation.isPending}
                className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
                data-testid="create-universal-task"
              >
                {createTaskMutation.isPending ? (
                  <div className="animate-pulse">Adding to Board...</div>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Universal Board</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <div key={status} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white capitalize flex items-center space-x-2">
                {status === 'pending' && <Clock className="w-5 h-5 text-gray-400" />}
                {status === 'in_progress' && <Zap className="w-5 h-5 text-blue-400" />}
                {status === 'completed' && <CheckSquare className="w-5 h-5 text-green-400" />}
                {status === 'blocked' && <AlertCircle className="w-5 h-5 text-red-400" />}
                <span>{status.replace('_', ' ')}</span>
              </h3>
              <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold text-white">
                {statusTasks.length}
              </div>
            </div>

            <div className="space-y-3">
              {statusTasks.map((task) => (
                <div key={task.id} className={`glass-card p-4 border-l-4 ${getPriorityColor(task.priority)}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="text-white font-medium text-sm leading-tight">{task.title}</h4>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)} flex-shrink-0 mt-1`}></div>
                    </div>

                    {task.description && (
                      <p className="text-white/60 text-xs">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full font-medium ${
                          task.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                          task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {task.priority}
                        </span>
                        
                        {task.assignedAgent && (
                          <div className="flex items-center space-x-1 bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                            <Bot className="w-3 h-3" />
                            <span>{task.assignedAgent}</span>
                          </div>
                        )}
                      </div>
                      
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskMutation.mutate({ 
                          taskId: task.id, 
                          status: e.target.value,
                          agentName: 'Human User'
                        })}
                        className="glass-input px-2 py-1 text-xs bg-white/10"
                        data-testid={`task-status-${task.id}`}
                      >
                        <option value="pending" className="bg-gray-800">Pending</option>
                        <option value="in_progress" className="bg-gray-800">In Progress</option>
                        <option value="completed" className="bg-gray-800">Completed</option>
                        <option value="blocked" className="bg-gray-800">Blocked</option>
                      </select>
                    </div>

                    {/* Agent Activity Feed */}
                    {task.agentActivity && task.agentActivity.length > 0 && (
                      <div className="border-t border-white/10 pt-2 space-y-1">
                        <div className="flex items-center space-x-1 text-white/60 text-xs">
                          <Bot className="w-3 h-3" />
                          <span>Agent Activity</span>
                        </div>
                        {task.agentActivity.slice(0, 2).map((activity, index) => (
                          <div key={index} className="text-xs text-white/50 flex items-center justify-between">
                            <span>{activity.agentName}: {activity.action}</span>
                            <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {statusTasks.length === 0 && (
                <div className="glass-card p-6 text-center border-2 border-dashed border-white/20">
                  <div className="text-white/40 text-sm">
                    {status === 'pending' && 'No pending tasks'}
                    {status === 'in_progress' && 'Nothing in progress'}
                    {status === 'completed' && 'No completed tasks'}
                    {status === 'blocked' && 'No blocked tasks'}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Universal Board Stats */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{tasks.length}</div>
            <div className="text-white/60 text-sm">Total Tasks</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{tasksByStatus.completed.length}</div>
            <div className="text-white/60 text-sm">Completed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{activeAgents}</div>
            <div className="text-white/60 text-sm">Active Agents</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {tasks.length > 0 ? Math.round((tasksByStatus.completed.length / tasks.length) * 100) : 0}%
            </div>
            <div className="text-white/60 text-sm">Completion Rate</div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <div className="text-white/60 text-sm flex items-center justify-center space-x-2">
            <Network className="w-4 h-4" />
            <span>This universal board replaces todowrite for all agents across all channels</span>
          </div>
        </div>
      </div>
    </div>
  );
}