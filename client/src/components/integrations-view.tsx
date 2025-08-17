import { useQuery } from "@tanstack/react-query";
import type { Integration } from "@shared/schema";

interface BeaconStatus {
  success: boolean;
  status?: {
    appId: string;
    appName: string;
    platform: string;
    disabled: boolean;
    endpoint: string;
    uptime: number;
  };
  message: string;
}

export default function IntegrationsView() {
  // Fetch integrations
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch beacon status
  const { data: beaconStatus, isLoading: beaconLoading } = useQuery<BeaconStatus>({
    queryKey: ['/api/beacon/status'],
    refetchInterval: 60000, // Refetch every minute
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  if (integrationsLoading || beaconLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ChittyBeacon Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ChittyBeacon Tracking</h3>
        
        {beaconStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Status</span>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                beaconStatus.success ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
              }`}>
                {beaconStatus.success ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            {beaconStatus.status && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">App ID</span>
                    <p className="font-mono text-sm text-gray-900">{beaconStatus.status.appId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Platform</span>
                    <p className="text-sm text-gray-900 capitalize">{beaconStatus.status.platform}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Uptime</span>
                    <p className="text-sm text-gray-900">{formatUptime(beaconStatus.status.uptime)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Endpoint</span>
                    <p className="text-sm text-gray-900 font-mono">{beaconStatus.status.endpoint}</p>
                  </div>
                </div>
              </>
            )}
            
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{beaconStatus.message}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">Unable to load beacon status</p>
          </div>
        )}
      </div>

      {/* External Integrations */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">External Services</h3>
        
        {integrations.length > 0 ? (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div key={integration.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900 capitalize">{integration.name}</h4>
                    <span className="text-sm text-gray-500">({integration.type})</span>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(integration.status)}`}>
                    {integration.status}
                  </span>
                </div>
                
                {integration.lastSync && (
                  <div className="text-sm text-gray-500">
                    Last sync: {new Date(integration.lastSync).toLocaleString()}
                  </div>
                )}
                
                {integration.errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {integration.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No external integrations configured</p>
          </div>
        )}
      </div>

      {/* Integration Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="button-sync-chittyid"
          >
            Sync ChittyID
          </button>
          <button 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            data-testid="button-sync-registry"
          >
            Sync Registry
          </button>
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            data-testid="button-test-beacon"
          >
            Test Beacon
          </button>
          <button 
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            data-testid="button-refresh-integrations"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
}