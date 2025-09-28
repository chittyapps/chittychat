import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    const connect = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
          
          // Register as client (not an agent)
          ws.send(JSON.stringify({
            type: 'client_register',
            timestamp: new Date().toISOString(),
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket disconnected:", event.code, event.reason);
          wsRef.current = null;
          
          // Disable automatic reconnection for now to stop the spam
          // TODO: Fix WebSocket server implementation
          console.log("WebSocket auto-reconnect disabled due to server issues");
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        // Disable reconnection to prevent spam
        console.log("WebSocket reconnection disabled due to connection failures");
      }
    };

    const handleWebSocketMessage = (message: any) => {
      switch (message.type) {
        case 'project_created':
        case 'project_updated':
          // Invalidate project queries
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          
          toast({
            title: "Project Updated",
            description: `Project "${message.project?.name}" was ${message.type === 'project_created' ? 'created' : 'updated'}`,
          });
          break;

        case 'task_created':
        case 'task_updated':
          // Invalidate task and project queries
          queryClient.invalidateQueries({ queryKey: ['/api/projects', message.task?.projectId, 'tasks'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects', message.task?.projectId] });
          queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
          
          toast({
            title: "Task Updated",
            description: `Task "${message.task?.title}" was ${message.type === 'task_created' ? 'created' : 'updated'}`,
          });
          break;

        case 'agent_connected':
          queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
          queryClient.invalidateQueries({ queryKey: ['/api/agents/active'] });
          
          toast({
            title: "Agent Connected",
            description: `AI Agent "${message.agent?.name}" is now active`,
          });
          break;

        case 'agent_disconnected':
        case 'agent_inactive':
          queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
          queryClient.invalidateQueries({ queryKey: ['/api/agents/active'] });
          
          if (message.type === 'agent_disconnected') {
            toast({
              title: "Agent Disconnected",
              description: "An AI agent has disconnected",
              variant: "destructive",
            });
          }
          break;

        case 'chittyid_sync_completed':
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
          
          toast({
            title: "ChittyID Sync Complete",
            description: `Synced ${message.data?.syncedProjects || 0} projects and ${message.data?.syncedTasks || 0} tasks`,
          });
          break;

        case 'registry_sync_completed':
          queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/mcp/discovery'] });
          
          toast({
            title: "Registry Sync Complete",
            description: `Discovered ${message.data?.syncedTools || 0} tools and MCPs`,
          });
          break;

        case 'error':
          toast({
            title: "WebSocket Error",
            description: message.message || "An unknown error occurred",
            variant: "destructive",
          });
          break;

        default:
          console.log("Unknown WebSocket message type:", message.type);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000); // Normal closure
      }
    };
  }, [toast]);

  // Send message function
  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, message not sent:", message);
    }
  };

  return { sendMessage };
}
