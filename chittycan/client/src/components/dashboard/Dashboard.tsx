import { Tunnel } from "@shared/schema";
import { TunnelTable } from "./TunnelTable";
import { MonitoringStats } from "./MonitoringStats";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardProps {
  tunnels: Tunnel[];
  stats: any;
  isLoading: boolean;
}

export function Dashboard({ tunnels, stats, isLoading }: DashboardProps) {
  const activeTunnelsCount = stats?.activeTunnels || 0;
  
  return (
    <div className="space-y-6">
      {/* Dashboard Status Section */}
      <div className="mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Your Connections</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Static IPs for your apps</p>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5"></span>
                  {activeTunnelsCount} Active
                </span>
              )}
            </div>
          </div>
          
          <TunnelTable tunnels={tunnels} isLoading={isLoading} />
        </div>
      </div>
      
      {/* Usage & Monitoring */}
      <MonitoringStats stats={stats} isLoading={isLoading} />
    </div>
  );
}
