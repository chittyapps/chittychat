import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, Clock, Zap, Sparkles, Bot, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Task {
  id: string;
  content: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  createdAt: string;
  recommendations?: {
    agents: Array<{
      name: string;
      score: number;
      reasoning: string;
    }>;
  };
}

export default function TodoWriteReplacement() {
  const [newTaskContent, setNewTaskContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [selectedPriority, setSelectedPriority] = useState<"low" | "medium" | "high">("medium");
  const queryClient = useQueryClient();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['/api/mcp/todowrite/list'],
    refetchInterval: 10000,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { content: string; category: string; priority: string }) => {
      return apiRequest('/api/mcp/todowrite/create', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/todowrite/list'] });
      setNewTaskContent("");
    },
  });

  // Update task status mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest(`/api/mcp/todowrite/update/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp/todowrite/list'] });
    },
  });

  const handleCreateTask = () => {
    if (!newTaskContent.trim()) return;
    
    createTaskMutation.mutate({
      content: newTaskContent,
      category: selectedCategory,
      priority: selectedPriority,
    });
  };

  const handleUpdateStatus = (taskId: string, status: string) => {
    updateTaskMutation.mutate({ taskId, status });
  };

  const categories = [
    { id: "general", label: "General", color: "bg-gradient-cosmic" },
    { id: "bug-fix", label: "Bug Fix", color: "bg-gradient-sunset" },
    { id: "feature", label: "Feature", color: "bg-gradient-ocean" },
    { id: "security", label: "Security", color: "bg-gradient-aurora" },
    { id: "documentation", label: "Documentation", color: "bg-gradient-cosmic" },
  ];

  const priorityColors = {
    low: "bg-blue-500",
    medium: "bg-yellow-500", 
    high: "bg-red-500"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-cosmic flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">TodoWrite Replacement</h2>
            <p className="text-white/60">Powered by MCP Protocol & registry.chitty.cc</p>
          </div>
          <div className="ml-auto">
            <div className="status-active">Claude Function Replaced</div>
          </div>
        </div>

        {/* Task Creation */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <textarea
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                placeholder="Describe your task... (e.g., Fix authentication bug in login system)"
                className="glass-input w-full px-4 py-3 resize-none h-20"
                data-testid="task-input"
              />
            </div>
            <div className="flex flex-col space-y-2 md:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="glass-input px-3 py-2 text-sm"
                data-testid="category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-gray-800">
                    {cat.label}
                  </option>
                ))}
              </select>
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
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white/60 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI agents will be recommended based on task analysis</span>
            </div>
            <button
              onClick={handleCreateTask}
              disabled={!newTaskContent.trim() || createTaskMutation.isPending}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="create-task-btn"
            >
              {createTaskMutation.isPending ? (
                <div className="animate-pulse">Creating...</div>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Task</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Your Tasks</h3>
          <div className="flex items-center space-x-2 text-white/60 text-sm">
            <CheckSquare className="w-4 h-4" />
            <span>{tasks.filter(t => t.status === 'completed').length} / {tasks.length} completed</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-4">
                <div className="animate-pulse space-y-2">
                  <div className="skeleton h-4 w-3/4"></div>
                  <div className="skeleton h-3 w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <CheckSquare className="w-12 h-12 text-white/40 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">No tasks yet</h4>
            <p className="text-white/60">Create your first task to get started with AI-powered recommendations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="glass-card p-4 group hover:bg-white/15 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-white font-medium">{task.content}</h4>
                      <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`}></div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-white/60">
                      <span className="capitalize">{task.category.replace('-', ' ')}</span>
                      <span className="capitalize">{task.priority} priority</span>
                      <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                      className="glass-input px-3 py-1 text-xs"
                      data-testid={`status-select-${task.id}`}
                    >
                      <option value="pending" className="bg-gray-800">Pending</option>
                      <option value="in-progress" className="bg-gray-800">In Progress</option>
                      <option value="completed" className="bg-gray-800">Completed</option>
                    </select>
                    
                    <div className={`status-${task.status}`}>
                      {task.status.replace('-', ' ')}
                    </div>
                  </div>
                </div>

                {/* AI Recommendations */}
                {task.recommendations && task.recommendations.agents.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center space-x-2 mb-3">
                      <Bot className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">Recommended Agents</span>
                      <div className="status-active text-xs">registry.chitty.cc</div>
                    </div>
                    <div className="space-y-2">
                      {task.recommendations.agents.slice(0, 2).map((agent, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-ocean flex items-center justify-center">
                              <Bot className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-sm text-white">{agent.name}</span>
                            <span className="text-xs text-yellow-400">★ {agent.score}</span>
                          </div>
                          <button className="btn-secondary text-xs px-3 py-1 flex items-center space-x-1">
                            <span>Connect</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Protocol Status */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-cosmic flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">MCP Protocol Status</p>
              <p className="text-white/60 text-sm">Connected to registry.chitty.cc</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}