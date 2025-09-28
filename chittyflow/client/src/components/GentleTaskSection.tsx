import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sprout, Plus, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

export function GentleTaskSection() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [energyLevel, setEnergyLevel] = useState("medium");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDialogOpen(false);
      setTitle("");
      setDescription("");
      setEnergyLevel("medium");
      toast({
        title: "Task added! 🌱",
        description: "I'll keep this here for when you're ready.",
      });
    },
    onError: () => {
      toast({
        title: "Couldn't add task",
        description: "That's okay, you can try again when you're ready.",
        variant: "destructive",
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/wins"] });
      toast({
        title: "Amazing! 🎉",
        description: "You completed a task! That's worth celebrating.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    createTaskMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      energyLevel,
    });
  };

  const getEnergyColor = (level: string) => {
    switch (level) {
      case 'high': return 'sage';
      case 'low': return 'warmBlue';
      default: return 'coral';
    }
  };

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'high': return 'High energy';
      case 'low': return 'Low energy ok';
      default: return 'Medium energy';
    }
  };

  const getEnergyTime = (level: string) => {
    switch (level) {
      case 'high': return 'Perfect for deep focus';
      case 'low': return 'Great for gentle progress';
      default: return 'Good for steady work';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-charcoal flex items-center">
          <Sprout className="text-sage mr-3 w-5 h-5" />
          Gentle Focus
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-sage hover:text-sage/80">
              <Plus className="w-4 h-4 mr-1" />
              Add when ready
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-sage">
                <Sprout className="w-5 h-5 mr-2" />
                Add a Gentle Task
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="What would you like to accomplish?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-sage/20 focus:border-sage"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Any details? (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-sage/20 focus:border-sage resize-none"
                  rows={3}
                />
              </div>
              <div>
                <Select value={energyLevel} onValueChange={setEnergyLevel}>
                  <SelectTrigger className="border-sage/20 focus:border-sage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low energy (that's perfectly fine!)</SelectItem>
                    <SelectItem value="medium">Medium energy (steady progress)</SelectItem>
                    <SelectItem value="high">High energy (ready to dive deep)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button 
                  type="submit" 
                  disabled={!title.trim() || createTaskMutation.isPending}
                  className="bg-sage hover:bg-sage/90 flex-1"
                >
                  {createTaskMutation.isPending ? "Adding..." : "Add Task"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-sage/20"
                >
                  Maybe later
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sprout className="text-sage w-8 h-8" />
            </div>
            <p className="text-charcoal/60 mb-2">No tasks yet - and that's perfectly okay!</p>
            <p className="text-sm text-charcoal/50">
              Add something when you feel ready. There's no pressure here.
            </p>
          </div>
        ) : (
          tasks.map((task: Task) => {
            const color = getEnergyColor(task.energyLevel || 'medium');
            
            return (
              <div 
                key={task.id}
                className="group flex items-center p-4 bg-gray-50/50 rounded-xl hover:bg-sage/5 transition-colors"
              >
                <button
                  onClick={() => completeTaskMutation.mutate(task.id)}
                  disabled={completeTaskMutation.isPending}
                  className="w-6 h-6 border-2 border-gray-300 rounded-full mr-4 group-hover:border-sage transition-colors flex items-center justify-center hover:bg-sage/10"
                >
                  {completeTaskMutation.isPending ? (
                    <div className="w-3 h-3 border border-sage border-t-transparent rounded-full animate-spin" />
                  ) : null}
                </button>
                <div className="flex-1">
                  <p className="font-medium text-charcoal">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-charcoal/60">{task.description}</p>
                  )}
                  <p className="text-xs text-charcoal/50 mt-1">{getEnergyTime(task.energyLevel || 'medium')}</p>
                </div>
                <span className={`text-xs text-${color} bg-${color}/10 px-2 py-1 rounded`}>
                  {getEnergyLabel(task.energyLevel || 'medium')}
                </span>
              </div>
            );
          })
        )}
      </div>
      
      <div className="mt-6 flex items-center justify-center">
        <p className="text-sm text-charcoal/60 text-center flex items-center">
          <Heart className="text-coral mr-2 w-4 h-4" />
          I believe in your timing. Everything will get done when it needs to.
        </p>
      </div>
    </div>
  );
}
