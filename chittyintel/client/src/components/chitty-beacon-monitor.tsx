import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChittyBeacon } from '@/hooks/use-chitty-beacon';
import { Activity, Database, Gavel, DollarSign, User, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface BeaconMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function ChittyBeaconMonitor({ isVisible, onToggle }: BeaconMonitorProps) {
  const beacon = useChittyBeacon({
    enabled: true,
    endpoint: '/api/beacon/events',
    bufferSize: 100,
    flushInterval: 5000
  });

  const [systemStats, setSystemStats] = useState({
    totalEvents: 0,
    errorRate: 0,
    avgResponseTime: 0,
    activeConnections: 3
  });

  useEffect(() => {
    const stats = {
      totalEvents: beacon.events.length,
      errorRate: (beacon.events.filter(e => e.severity === 'error').length / beacon.events.length * 100) || 0,
      avgResponseTime: Math.random() * 500 + 100, // Simulated
      activeConnections: beacon.isConnected ? 3 : 0
    };
    setSystemStats(stats);
  }, [beacon.events, beacon.isConnected]);

  const getEventIcon = (type: string, severity: string) => {
    if (severity === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (severity === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;

    switch (type) {
      case 'legal': return <Gavel className="h-4 w-4 text-blue-500" />;
      case 'financial': return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'system': return <Database className="h-4 w-4 text-purple-500" />;
      case 'user_action': return <User className="h-4 w-4 text-gray-500" />;
      default: return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'success': return 'default';
      default: return 'outline';
    }
  };

  if (!isVisible) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-900 shadow-lg"
        data-testid="button-toggle-beacon"
      >
        <Activity className="h-4 w-4 mr-2" />
        ChittyBeacon
        {beacon.isConnected && (
          <div className="ml-2 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              ChittyBeacon
              {beacon.isConnected ? (
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              ) : (
                <div className="h-2 w-2 bg-red-500 rounded-full" />
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onToggle} data-testid="button-close-beacon">
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* System Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-gray-500 dark:text-gray-400">Events</div>
              <div className="font-mono text-lg" data-testid="text-total-events">{systemStats.totalEvents}</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500 dark:text-gray-400">Error Rate</div>
              <div className="font-mono text-lg" data-testid="text-error-rate">{systemStats.errorRate.toFixed(1)}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500 dark:text-gray-400">Avg Response</div>
              <div className="font-mono text-lg" data-testid="text-response-time">{systemStats.avgResponseTime.toFixed(0)}ms</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500 dark:text-gray-400">DB Connections</div>
              <div className="font-mono text-lg" data-testid="text-db-connections">{systemStats.activeConnections}/3</div>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Events</div>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {beacon.events.slice(-20).reverse().map((event) => (
                  <div 
                    key={event.id} 
                    className="flex items-start gap-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    data-testid={`event-${event.type}-${event.severity}`}
                  >
                    <div className="mt-0.5">
                      {getEventIcon(event.type, event.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityColor(event.severity)} className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 dark:text-gray-100 break-words">
                        {event.message}
                      </div>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                          {Object.entries(event.metadata).slice(0, 2).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              {key}: {typeof value === 'object' ? JSON.stringify(value).slice(0, 20) : String(value).slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {beacon.events.length === 0 && (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                    No events yet
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => beacon.flushEvents()}
              className="flex-1"
              data-testid="button-flush-events"
            >
              Flush Events
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => beacon.trackUserAction('manual_test')}
              className="flex-1"
              data-testid="button-test-event"
            >
              Test Event
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}