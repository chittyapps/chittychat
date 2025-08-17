import { useState, useEffect } from "react";
import { Plus, Zap, CheckCircle, Clock, AlertTriangle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { mcpClient, todowrite, type TodoWriteResponse } from "@/lib/mcp-client";

interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  tags: string[];
  createdAt: string;
  autoAssigned?: {
    project?: string;
    priority: string;
    tags: string[];
  };
  recommendations?: Array<{
    type: string;
    name: string;
    reason: string;
  }>;
}

export default function TodoWriteReplacement() {
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mcpConnected, setMcpConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check MCP connection status
    const checkConnection = () => {
      const connected = mcpClient && typeof mcpClient.connect === 'function';
      setMcpConnected(connected);
    };

    checkConnection();
    loadTodos();

    // Periodic connection check
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTodos = async () => {
    try {
      setIsLoading(true);
      const response = await mcpClient.listTodos({ limit: 20 });
      setTodos(response.tasks);
    } catch (error) {
      console.error('Error loading todos:', error);
      toast({
        title: "Connection Error",
        description: "Could not load todos. MCP server may be unavailable.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTodoWrite = async () => {
    if (!content.trim()) {
      toast({
        title: "Content Required",
        description: "Please enter todo content before creating.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreating(true);
      
      // Use the todowrite replacement function
      const response: TodoWriteResponse = await todowrite(content, {
        project: project || undefined,
        priority
      });

      // Add the new todo to the list
      const newTodo: TodoItem = {
        ...response.task,
        autoAssigned: response.autoAssigned,
        recommendations: response.recommendations
      };
      
      setTodos(prev => [newTodo, ...prev]);
      
      // Clear form
      setContent("");
      setProject("");
      setPriority('medium');
      
      toast({
        title: "Todo Created Successfully!",
        description: response.message,
        variant: "default"
      });

      // Show auto-assignment details
      if (response.autoAssigned) {
        const details = [];
        if (response.autoAssigned.project) details.push(`Project: ${response.autoAssigned.project}`);
        if (response.autoAssigned.tags?.length) details.push(`Tags: ${response.autoAssigned.tags.join(', ')}`);
        if (response.autoAssigned.priority) details.push(`Priority: ${response.autoAssigned.priority}`);
        
        if (details.length > 0) {
          toast({
            title: "Smart Assignment Applied",
            description: details.join(' • '),
            variant: "default"
          });
        }
      }

    } catch (error) {
      console.error('Error creating todo:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create todo",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusUpdate = async (todoId: string, newStatus: string) => {
    try {
      await mcpClient.updateTodo(todoId, { 
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined
      });
      
      setTodos(prev => prev.map(todo => 
        todo.id === todoId 
          ? { ...todo, status: newStatus }
          : todo
      ));
      
      toast({
        title: "Status Updated",
        description: `Todo marked as ${newStatus}`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not update todo status",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'blocked': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 mobile-padding">
      {/* Header */}
      <div className="glass rounded-2xl p-6 bg-gradient-primary text-white">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-white/20 rounded-lg animate-float">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold">TodoWrite Replacement</h2>
            <p className="text-white/80">
              MCP-powered task management with smart auto-categorization
            </p>
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${mcpConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-sm text-white/80">
            MCP Server: {mcpConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Todo Creation Form */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Todo</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Todo Content
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what needs to be done... (e.g., 'Fix urgent bug in authentication system')"
              className="min-h-[100px]"
              data-testid="textarea-todo-content"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project (Optional)
              </label>
              <Input
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="Project name (auto-assigned if empty)"
                data-testid="input-project"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleTodoWrite}
            disabled={isCreating || !content.trim() || !mcpConnected}
            className="w-full bg-gradient-primary hover:opacity-90 text-white"
            data-testid="button-create-todo"
          >
            {isCreating ? (
              <>
                <div className="spinner mr-2"></div>
                Creating Todo...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Todo with Smart Assignment
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Todo List */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Todos</h3>
          <Button
            onClick={loadTodos}
            variant="outline"
            size="sm"
            disabled={isLoading}
            data-testid="button-refresh-todos"
          >
            {isLoading ? <div className="spinner"></div> : "Refresh"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="spinner mx-auto mb-2"></div>
            <p className="text-gray-500">Loading todos...</p>
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No todos yet. Create your first one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <div key={todo.id} className="bg-white rounded-lg p-4 border border-gray-100 card-hover">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{todo.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{todo.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={getPriorityColor(todo.priority)}>
                        {todo.priority}
                      </Badge>
                      <Badge variant="outline">
                        {todo.category}
                      </Badge>
                      {todo.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Auto-assignment details */}
                    {todo.autoAssigned && (
                      <div className="text-xs text-gray-500 mb-2">
                        <Star className="w-3 h-3 inline mr-1" />
                        Smart Assignment: {todo.autoAssigned.tags.join(', ')}
                      </div>
                    )}

                    {/* Recommendations */}
                    {todo.recommendations && todo.recommendations.length > 0 && (
                      <div className="text-xs text-blue-600">
                        💡 Recommended: {todo.recommendations[0].name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(todo.status)}
                      <span className="text-sm text-gray-600 capitalize">{todo.status}</span>
                    </div>
                    
                    <Select
                      value={todo.status}
                      onValueChange={(value) => handleStatusUpdate(todo.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">Todo</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}