import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QuickAddTaskProps {
  projectId: string;
}

export default function QuickAddTask({ projectId }: QuickAddTaskProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const { toast } = useToast();

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return await apiRequest(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      
      setTitle("");
      setPriority("medium");
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate({
      title: title.trim(),
      priority,
      status: 'pending',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Add Task</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-4">
          <Input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            data-testid="input-task-title"
          />
          
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            type="submit"
            disabled={createTaskMutation.isPending || !title.trim()}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            data-testid="button-add-task"
          >
            {createTaskMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Adding...
              </>
            ) : (
              <>
                <i className="fas fa-plus mr-2"></i>
                Add Task
              </>
            )}
          </Button>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <i className="fas fa-magic text-primary-500"></i>
            <span>AI will auto-categorize and suggest assignments</span>
          </div>
        </div>
      </form>
    </div>
  );
}
