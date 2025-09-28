import { Tunnel } from "@shared/schema";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface TunnelTableProps {
  tunnels: Tunnel[];
  isLoading: boolean;
}

export function TunnelTable({ tunnels, isLoading }: TunnelTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Service provider icons mapping
  const serviceIcons = {
    cloudflare: <i className="fas fa-cloud text-primary"></i>,
    "google-cloud": <i className="fab fa-google text-primary"></i>,
    github: <i className="fab fa-github text-primary"></i>,
    custom: <i className="fas fa-network-wired text-primary"></i>,
  };
  
  // Toggle tunnel status
  const toggleTunnelMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const res = await apiRequest("PATCH", `/api/tunnels/${id}`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tunnels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Tunnel updated",
        description: "Status changed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating tunnel",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip)
      .then(() => {
        toast({
          title: "Copied to clipboard!",
          description: `IP address copied`,
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Please copy manually",
          variant: "destructive",
        });
      });
  };
  
  // Render loading skeletons
  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <div className="flex space-x-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Empty state
  if (tunnels.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">No connections yet</p>
        <p className="text-xs text-slate-400 mb-4">Set up your first secure connection to start using static IPs</p>
        <Button className="bg-secondary text-white">
          <i className="fas fa-plus mr-2"></i>
          Create Connection
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      {tunnels.map((tunnel) => (
        <div key={tunnel.id} className="mb-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium">{tunnel.name}</div>
            <StatusBadge 
              status={tunnel.status === "active" ? "active" : "inactive"} 
              size="sm" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-slate-500">
            <div className="flex items-center">
              <span>IP:</span>
              <span className="font-mono ml-1 truncate">{tunnel.staticIp}</span>
              <button 
                className="ml-1 text-slate-400" 
                aria-label="Copy IP"
                onClick={() => handleCopyIp(tunnel.staticIp)}
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
            <div className="flex items-center justify-end">
              {serviceIcons[tunnel.serviceProvider as keyof typeof serviceIcons]}
              <span className="ml-1">
                {tunnel.serviceProvider.charAt(0).toUpperCase() + tunnel.serviceProvider.slice(1).replace("-", " ")}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-500 truncate max-w-[60%]">
              {tunnel.targetApi}
            </div>
            <div className="flex space-x-2">
              <button 
                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300" 
                aria-label="Edit"
              >
                <i className="fas fa-edit"></i>
              </button>
              <button 
                className={`p-1.5 rounded-full ${
                  tunnel.status === "active" 
                    ? "bg-error/10 hover:bg-error/20 text-error" 
                    : "bg-success/10 hover:bg-success/20 text-success"
                }`}
                aria-label={tunnel.status === "active" ? "Stop" : "Start"}
                onClick={() => toggleTunnelMutation.mutate({ id: tunnel.id, status: tunnel.status })}
                disabled={toggleTunnelMutation.isPending}
              >
                <i className={`fas ${tunnel.status === "active" ? "fa-stop" : "fa-play"}`}></i>
              </button>
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-4 flex justify-center">
        <Button className="bg-primary hover:bg-primary/80 text-white rounded-full px-4 py-2 text-sm">
          <i className="fas fa-plus mr-2"></i>
          Add Tunnel
        </Button>
      </div>
    </div>
  );
}
