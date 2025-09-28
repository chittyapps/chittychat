import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface TaskListProps {
  projectId: string;
}

export default function TaskList({ projectId }: TaskListProps) {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const { toast } = useToast();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    enabled: !!projectId,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: any }) => {
      return await apiRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    const updates = {
      status: completed ? 'completed' : 'pending',
    };
    
    updateTaskMutation.mutate({ taskId, updates });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    if (diffDays === -1) return 'Due Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    
    return date.toLocaleDateString();
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter((task: any) => {
      if (filter === "all") return true;
      if (filter === "completed") return task.status === "completed";
      if (filter === "pending") return task.status !== "completed";
      return true;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        case "dueDate":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "created":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              data-testid="select-filter"
            >
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              data-testid="select-sort"
            >
              <option value="created">Sort by Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="dueDate">Sort by Due Date</option>
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {filteredTasks.map((task: any) => (
          <div 
            key={task.id} 
            className="p-6 hover:bg-gray-50 transition-colors"
            data-testid={`task-${task.id}`}
          >
            <div className="flex items-start space-x-4">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={(checked) => handleTaskToggle(task.id, !!checked)}
                className="mt-1"
                data-testid={`checkbox-task-${task.id}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 
                    className={`text-sm font-medium text-gray-900 ${
                      task.status === 'completed' ? 'line-through' : ''
                    }`}
                    data-testid={`text-task-title-${task.id}`}
                  >
                    {task.title}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.status === 'completed' 
                        ? getStatusColor('completed')
                        : getPriorityColor(task.priority)
                    }`}>
                      {task.status === 'completed' ? 'Completed' : task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)}
                    </span>
                    <button className="text-gray-400 hover:text-gray-600" data-testid={`button-task-menu-${task.id}`}>
                      <i className="fas fa-ellipsis-h"></i>
                    </button>
                  </div>
                </div>
                
                {task.description && (
                  <p className="text-sm text-gray-500 mt-1" data-testid={`text-task-description-${task.id}`}>
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                  {task.assignedAgent && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-robot"></i>
                      <span data-testid={`text-task-assignee-${task.id}`}>{task.assignedAgent}</span>
                    </div>
                  )}
                  
                  {task.dueDate && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-calendar"></i>
                      <span 
                        className={formatDueDate(task.dueDate)?.includes('overdue') ? 'text-red-600' : ''}
                        data-testid={`text-task-due-date-${task.id}`}
                      >
                        {formatDueDate(task.dueDate)}
                      </span>
                    </div>
                  )}
                  
                  {task.category && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-tag"></i>
                      <span data-testid={`text-task-category-${task.id}`}>{task.category}</span>
                    </div>
                  )}
                  
                  {task.status === 'completed' && task.completedAt && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-check-circle text-green-500"></i>
                      <span>
                        Completed {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-gray-500">
              {filter === "all" 
                ? "No tasks found" 
                : `No ${filter} tasks found`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
