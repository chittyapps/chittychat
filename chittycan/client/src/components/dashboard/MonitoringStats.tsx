import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface MonitoringStatsProps {
  stats: any;
  isLoading: boolean;
}

export function MonitoringStats({ stats, isLoading }: MonitoringStatsProps) {
  // Format GB values for display
  const formatGB = (value: number) => {
    return `${value} GB`;
  };
  
  // Calculate percentage for the progress bar
  const calcPercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };
  
  // Default values for bandwidth usage
  const bandwidthUsed = stats?.bandwidth?.total || 0;
  const bandwidthTotal = 100; // Total allocated bandwidth in GB
  const bandwidthPercentage = calcPercentage(bandwidthUsed, bandwidthTotal);
  const incomingGB = stats?.bandwidth?.incoming || 0;
  const outgoingGB = stats?.bandwidth?.outgoing || 0;
  
  // Stats for monitoring
  const uptime = stats?.uptime || 0;
  
  return (
    <div className="mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Data Usage</h2>
          <span className="text-xs text-slate-500">{bandwidthPercentage}% used</span>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ) : (
          <>
            <Progress value={bandwidthPercentage} className="h-2 bg-slate-200 dark:bg-slate-600 mb-3" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{bandwidthUsed} GB <span className="text-xs text-slate-500">used</span></span>
              <span className="text-xs text-slate-500">{bandwidthTotal} GB limit</span>
            </div>
          </>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3">
          <p className="text-xs text-slate-500 mb-1">Incoming</p>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <p className="text-sm font-medium">{formatGB(incomingGB)}</p>
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3">
          <p className="text-xs text-slate-500 mb-1">Outgoing</p>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <p className="text-sm font-medium">{formatGB(outgoingGB)}</p>
          )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Health</h2>
          <span className="text-xs bg-success/10 text-success rounded-full px-2 py-0.5">
            {uptime}% uptime
          </span>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 dark:bg-slate-700 rounded p-2">
              <p className="text-xs text-slate-500">Response Time</p>
              <p className="text-sm font-medium">42ms</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded p-2">
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-sm font-medium">24 connections</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
