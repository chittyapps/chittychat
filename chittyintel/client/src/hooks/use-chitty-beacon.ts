import { useEffect, useRef, useState } from 'react';

interface BeaconEvent {
  id: string;
  type: 'system' | 'legal' | 'financial' | 'user_action';
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}

interface BeaconConfig {
  enabled: boolean;
  endpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

export function useChittyBeacon(config: BeaconConfig = {
  enabled: true,
  bufferSize: 50,
  flushInterval: 10000
}) {
  // Disable ChittyBeacon in production environments
  const isDevelopment = process.env.NODE_ENV === 'development';
  const effectiveConfig = {
    ...config,
    enabled: config.enabled && isDevelopment
  };
  const [events, setEvents] = useState<BeaconEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventBuffer = useRef<BeaconEvent[]>([]);
  const flushTimer = useRef<NodeJS.Timeout>();

  // Beacon event logger
  const logEvent = (
    type: BeaconEvent['type'],
    message: string,
    severity: BeaconEvent['severity'] = 'info',
    metadata?: Record<string, any>
  ) => {
    if (!effectiveConfig.enabled) return;

    const event: BeaconEvent = {
      id: `beacon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      severity,
      metadata
    };

    // Add to local state
    setEvents(prev => [...prev.slice(-effectiveConfig.bufferSize + 1), event]);
    
    // Add to buffer for transmission
    eventBuffer.current.push(event);

    // Send critical events immediately
    if (severity === 'error') {
      flushEvents();
    }
  };

  // Flush events to server
  const flushEvents = async () => {
    if (eventBuffer.current.length === 0) return;

    try {
      const eventsToSend = [...eventBuffer.current];
      eventBuffer.current = [];

      if (effectiveConfig.endpoint) {
        await fetch(effectiveConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: eventsToSend })
        });
      }

      // Log to console in development
      if (isDevelopment) {
        console.group('🔔 ChittyBeacon Events');
        eventsToSend.forEach(event => {
          const icon = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
          }[event.severity];
          
          console.log(`${icon} [${event.type.toUpperCase()}] ${event.message}`, event.metadata);
        });
        console.groupEnd();
      }

      setIsConnected(true);
    } catch (error) {
      console.error('ChittyBeacon flush failed:', error);
      setIsConnected(false);
    }
  };

  // System health monitoring
  const monitorSystemHealth = () => {
    // Monitor API response times
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;
        
        if (duration > 2000) {
          logEvent('system', `Slow API response: ${args[0]} took ${duration.toFixed(0)}ms`, 'warning', {
            url: args[0],
            duration: duration
          });
        }

        if (!response.ok) {
          logEvent('system', `API error: ${response.status} ${response.statusText}`, 'error', {
            url: args[0],
            status: response.status
          });
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        logEvent('system', `Network error: ${error}`, 'error', {
          url: args[0],
          duration: duration,
          error: error
        });
        throw error;
      }
    };
  };

  // Legal case event tracking
  const trackLegalEvent = (event: string, caseData?: any) => {
    logEvent('legal', `Legal event: ${event}`, 'info', {
      case_number: caseData?.case_number,
      event_type: caseData?.event_type,
      timestamp: new Date().toISOString()
    });
  };

  // Financial transaction tracking
  const trackFinancialEvent = (event: string, amount?: number, currency?: string) => {
    logEvent('financial', `Financial event: ${event}`, 'info', {
      amount,
      currency,
      timestamp: new Date().toISOString()
    });
  };

  // User interaction tracking
  const trackUserAction = (action: string, target?: string) => {
    logEvent('user_action', `User ${action}${target ? ` on ${target}` : ''}`, 'info', {
      action,
      target,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    });
  };

  // Database connection monitoring
  const trackDatabaseStatus = (database: string, status: 'connected' | 'disconnected' | 'error', details?: any) => {
    const severity = status === 'connected' ? 'success' : status === 'error' ? 'error' : 'warning';
    logEvent('system', `Database ${database}: ${status}`, severity, {
      database,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  };

  // POV analysis tracking
  const trackPOVSwitch = (fromPOV: string, toPOV: string) => {
    logEvent('user_action', `POV switched from ${fromPOV} to ${toPOV}`, 'info', {
      from_pov: fromPOV,
      to_pov: toPOV,
      timestamp: new Date().toISOString()
    });
  };

  // Initialize beacon
  useEffect(() => {
    if (!effectiveConfig.enabled) return;

    // Initial system status
    logEvent('system', 'ChittyBeacon initialized', 'success', {
      config: effectiveConfig,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // Setup periodic flush
    flushTimer.current = setInterval(flushEvents, effectiveConfig.flushInterval);

    // Monitor system health
    monitorSystemHealth();

    // Cleanup
    return () => {
      if (flushTimer.current) {
        clearInterval(flushTimer.current);
      }
      flushEvents(); // Final flush
    };
  }, [effectiveConfig.enabled]);

  return {
    events,
    isConnected,
    logEvent,
    trackLegalEvent,
    trackFinancialEvent,
    trackUserAction,
    trackDatabaseStatus,
    trackPOVSwitch,
    flushEvents
  };
}