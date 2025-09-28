import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Zap, Database, Activity } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: "active" | "error" | "pending";
  config: {
    baseUrl: string;
    hasApiKey: boolean;
  };
  lastSync: string;
  errorMessage?: string;
}

export default function IntegrationsStatus() {
  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <div className="status-active">Connected</div>;
      case "error":
        return <div className="status-pending">Error</div>;
      default:
        return <div className="status-pending">Pending</div>;
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case "registry":
        return <Zap className="w-6 h-6 text-blue-400" />;
      case "chittyid":
        return <Database className="w-6 h-6 text-purple-400" />;
      case "chittybeacon":
        return <Activity className="w-6 h-6 text-green-400" />;
      default:
        return <Zap className="w-6 h-6 text-gray-400" />;
    }
  };

  const getIntegrationDescription = (type: string) => {
    switch (type) {
      case "registry":
        return "registry.chitty.cc - MCP tool discovery and agent management";
      case "chittyid":
        return "ChittyID - Project synchronization and Neon database ingestion";
      case "chittybeacon":
        return "ChittyBeacon - Application monitoring and analytics";
      default:
        return "External service integration";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">System Integrations</h3>
        <div className="flex items-center space-x-2 text-white/60 text-sm">
          <Activity className="w-4 h-4" />
          <span>{integrations.filter(i => i.status === 'active').length} / {integrations.length} active</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4">
              <div className="animate-pulse space-y-2">
                <div className="skeleton h-4 w-1/3"></div>
                <div className="skeleton h-3 w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div key={integration.id} className="glass-card p-4 hover:bg-white/15 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    {getIntegrationIcon(integration.type)}
                  </div>
                  <div>
                    <h4 className="text-white font-semibold capitalize">{integration.name}</h4>
                    <p className="text-white/60 text-sm">{getIntegrationDescription(integration.type)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusIcon(integration.status)}
                  {getStatusBadge(integration.status)}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4 text-white/60">
                  <span>{integration.config.baseUrl}</span>
                  {integration.config.hasApiKey && (
                    <span className="text-green-400">API Key ✓</span>
                  )}
                </div>
                <span className="text-white/40">
                  Last sync: {new Date(integration.lastSync).toLocaleTimeString()}
                </span>
              </div>

              {integration.errorMessage && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-red-300 text-xs">{integration.errorMessage}</p>
                </div>
              )}
            </div>
          ))}

          {/* ChittyBeacon Status (Always Active) */}
          <div className="glass-card p-4 hover:bg-white/15 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">ChittyBeacon</h4>
                  <p className="text-white/60 text-sm">Application monitoring and analytics - Always active</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div className="status-active">Running</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 text-white/60">
                <span>beacon.cloudeto.com</span>
                <span className="text-blue-400">Platform: Replit</span>
                <span className="text-purple-400">MCP Enabled</span>
              </div>
              <span className="text-white/40">
                Heartbeat: Every 5 minutes
              </span>
            </div>

            <div className="mt-3 p-2 rounded-lg bg-green-500/20 border border-green-500/30">
              <p className="text-green-300 text-xs">
                ChittyBeacon automatically tracks application usage, uptime, and system metrics
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}