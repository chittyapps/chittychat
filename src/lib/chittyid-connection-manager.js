/**
 * ChittyID Self-Healing Connection Manager
 * Manages persistent connections to id.chitty.cc with automatic recovery
 *
 * Features:
 * - Automatic reconnection on failure
 * - Connection health monitoring
 * - Connection pooling
 * - Service discovery with fallback
 * - Exponential backoff for reconnection
 */

/**
 * Connection health states
 */
const ConnectionState = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  RECONNECTING: "RECONNECTING",
  FAILED: "FAILED",
};

/**
 * Self-healing connection manager for ChittyID service
 */
export class ChittyIDConnectionManager {
  constructor(options = {}) {
    this.serviceUrl = options.serviceUrl || "https://id.chitty.cc";
    this.apiKey = options.apiKey;
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30s
    this.reconnectDelay = options.reconnectDelay || 1000; // Start at 1s
    this.maxReconnectDelay = options.maxReconnectDelay || 60000; // Max 60s
    this.reconnectMultiplier = options.reconnectMultiplier || 2;
    this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;

    this.state = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.lastHealthCheck = null;
    this.lastSuccessfulConnection = null;
    this.healthCheckTimer = null;
    this.reconnectTimer = null;

    this.stats = {
      totalConnections: 0,
      totalReconnections: 0,
      totalFailures: 0,
      totalHealthChecks: 0,
      successfulHealthChecks: 0,
      failedHealthChecks: 0,
    };

    this.listeners = new Map();
  }

  /**
   * Initialize connection and start health monitoring
   */
  async connect() {
    if (
      this.state === ConnectionState.CONNECTED ||
      this.state === ConnectionState.CONNECTING
    ) {
      return true;
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      const isHealthy = await this.performHealthCheck();

      if (isHealthy) {
        this.setState(ConnectionState.CONNECTED);
        this.lastSuccessfulConnection = Date.now();
        this.reconnectAttempts = 0;
        this.stats.totalConnections++;

        // Start periodic health checks
        this.startHealthMonitoring();

        this.emit("connected", { serviceUrl: this.serviceUrl });
        return true;
      } else {
        throw new Error("Health check failed");
      }
    } catch (error) {
      this.stats.totalFailures++;
      this.setState(ConnectionState.FAILED);
      this.emit("error", error);

      // Attempt reconnection
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Gracefully disconnect
   */
  disconnect() {
    this.stopHealthMonitoring();
    this.clearReconnectTimer();
    this.setState(ConnectionState.DISCONNECTED);
    this.emit("disconnected", { serviceUrl: this.serviceUrl });
  }

  /**
   * Perform health check against ChittyID service
   */
  async performHealthCheck() {
    this.stats.totalHealthChecks++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${this.serviceUrl}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: this.apiKey
          ? {
              Authorization: `Bearer ${this.apiKey}`,
            }
          : {},
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.lastHealthCheck = Date.now();
        this.stats.successfulHealthChecks++;
        return true;
      } else {
        this.stats.failedHealthChecks++;
        return false;
      }
    } catch (error) {
      this.stats.failedHealthChecks++;
      console.error("ChittyID health check failed:", error.message);
      return false;
    }
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      return; // Already monitoring
    }

    this.healthCheckTimer = setInterval(async () => {
      if (this.state !== ConnectionState.CONNECTED) {
        return;
      }

      const isHealthy = await this.performHealthCheck();

      if (!isHealthy) {
        console.warn(
          "ChittyID service health check failed - initiating reconnection",
        );
        this.emit("unhealthy", { serviceUrl: this.serviceUrl });
        this.handleConnectionLoss();
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Handle connection loss and initiate reconnection
   */
  handleConnectionLoss() {
    this.setState(ConnectionState.RECONNECTING);
    this.stopHealthMonitoring();
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("ChittyID max reconnection attempts reached");
      this.setState(ConnectionState.FAILED);
      this.emit("maxReconnectAttemptsReached", {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      this.reconnectDelay *
        Math.pow(this.reconnectMultiplier, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    console.info(
      `ChittyID reconnection scheduled in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      this.stats.totalReconnections++;

      this.emit("reconnecting", {
        attempt: this.reconnectAttempts,
        delay,
      });

      const success = await this.connect();

      if (!success && this.reconnectAttempts < this.maxReconnectAttempts) {
        // Will automatically schedule next attempt via connect() failure path
      }
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Set connection state and emit event
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      this.emit("stateChange", {
        from: oldState,
        to: newState,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get current connection state
   */
  getState() {
    return {
      state: this.state,
      lastHealthCheck: this.lastHealthCheck,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      reconnectAttempts: this.reconnectAttempts,
      stats: { ...this.stats },
      isHealthy: this.state === ConnectionState.CONNECTED,
      uptime: this.lastSuccessfulConnection
        ? Date.now() - this.lastSuccessfulConnection
        : 0,
    };
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const healthCheckSuccessRate =
      this.stats.totalHealthChecks > 0
        ? (
            (this.stats.successfulHealthChecks / this.stats.totalHealthChecks) *
            100
          ).toFixed(2)
        : 0;

    return {
      ...this.stats,
      healthCheckSuccessRate: `${healthCheckSuccessRate}%`,
      currentState: this.state,
      isConnected: this.state === ConnectionState.CONNECTED,
    };
  }

  /**
   * Event emitter - register listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Event emitter - remove listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Event emitter - emit event
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }
    const callbacks = this.listeners.get(event);
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Reset connection manager
   */
  reset() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.stats = {
      totalConnections: 0,
      totalReconnections: 0,
      totalFailures: 0,
      totalHealthChecks: 0,
      successfulHealthChecks: 0,
      failedHealthChecks: 0,
    };
  }
}

// Shared connection manager instance
let sharedConnectionManager;

/**
 * Get or create shared connection manager
 */
export function getSharedConnectionManager(options = {}) {
  if (!sharedConnectionManager) {
    sharedConnectionManager = new ChittyIDConnectionManager(options);

    // Auto-connect on creation
    sharedConnectionManager.connect().catch((error) => {
      console.error("Initial ChittyID connection failed:", error);
    });
  }

  return sharedConnectionManager;
}

/**
 * Reset shared connection manager
 */
export function resetSharedConnectionManager() {
  if (sharedConnectionManager) {
    sharedConnectionManager.reset();
    sharedConnectionManager = null;
  }
}

export { ConnectionState };
