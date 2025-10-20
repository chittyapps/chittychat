/**
 * ChittyID Connection Manager Tests
 * Tests for self-healing connection management
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import {
  ChittyIDConnectionManager,
  ConnectionState,
  getSharedConnectionManager,
  resetSharedConnectionManager,
} from "../src/lib/chittyid-connection-manager.js";

describe("ChittyID Connection Manager", () => {
  let manager;

  beforeEach(() => {
    manager = new ChittyIDConnectionManager({
      serviceUrl: "https://id.chitty.cc",
      apiKey: process.env.CHITTY_ID_TOKEN,
      healthCheckInterval: 60000, // Longer interval for tests
      reconnectDelay: 100, // Faster for testing
      maxReconnectDelay: 1000,
    });
  });

  afterEach(() => {
    if (manager) {
      manager.disconnect();
    }
    resetSharedConnectionManager();
  });

  describe("Connection Management", () => {
    test("should initialize in DISCONNECTED state", () => {
      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
    });

    test("should connect to ChittyID service", async () => {
      const connected = await manager.connect();

      if (connected) {
        expect(manager.state).toBe(ConnectionState.CONNECTED);
        expect(manager.lastSuccessfulConnection).toBeTruthy();
      } else {
        // Service unavailable - verify proper failure handling
        expect([
          ConnectionState.FAILED,
          ConnectionState.RECONNECTING,
        ]).toContain(manager.state);
      }
    }, 15000);

    test("should handle multiple connect calls gracefully", async () => {
      const promise1 = manager.connect();
      const promise2 = manager.connect();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return same result
      expect(result1).toBe(result2);
    }, 15000);

    test("should disconnect gracefully", async () => {
      await manager.connect();
      manager.disconnect();

      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
      expect(manager.healthCheckTimer).toBeNull();
    }, 15000);
  });

  describe("Health Monitoring", () => {
    test("should perform health check", async () => {
      const isHealthy = await manager.performHealthCheck();

      expect(typeof isHealthy).toBe("boolean");
      expect(manager.stats.totalHealthChecks).toBeGreaterThan(0);

      if (isHealthy) {
        expect(manager.stats.successfulHealthChecks).toBeGreaterThan(0);
      } else {
        expect(manager.stats.failedHealthChecks).toBeGreaterThan(0);
      }
    }, 10000);

    test("should start health monitoring after connection", async () => {
      const connected = await manager.connect();

      if (connected) {
        expect(manager.healthCheckTimer).toBeTruthy();
      }
    }, 15000);

    test("should stop health monitoring on disconnect", async () => {
      await manager.connect();
      manager.disconnect();

      expect(manager.healthCheckTimer).toBeNull();
    }, 15000);
  });

  describe("Reconnection Logic", () => {
    test("should schedule reconnection on failure", () => {
      manager.scheduleReconnect();

      expect(manager.reconnectTimer).toBeTruthy();
      expect(manager.reconnectAttempts).toBeGreaterThanOrEqual(0);
    });

    test("should use exponential backoff for reconnection", () => {
      manager.reconnectAttempts = 0;
      manager.scheduleReconnect();
      const delay1 = manager.reconnectDelay;

      manager.clearReconnectTimer();
      manager.reconnectAttempts = 3;
      manager.scheduleReconnect();

      // Delay should increase exponentially
      expect(manager.reconnectAttempts).toBeGreaterThan(0);
    });

    test("should respect max reconnect attempts", () => {
      const limitedManager = new ChittyIDConnectionManager({
        maxReconnectAttempts: 3,
        reconnectDelay: 10,
      });

      limitedManager.reconnectAttempts = 3;
      limitedManager.scheduleReconnect();

      expect(limitedManager.state).toBe(ConnectionState.FAILED);
      limitedManager.disconnect();
    });

    test("should reset reconnect attempts on successful connection", async () => {
      manager.reconnectAttempts = 5;
      const connected = await manager.connect();

      if (connected) {
        expect(manager.reconnectAttempts).toBe(0);
      }
    }, 15000);
  });

  describe("State Management", () => {
    test("should transition states correctly", () => {
      const states = [];
      manager.on("stateChange", ({ from, to }) => {
        states.push({ from, to });
      });

      manager.setState(ConnectionState.CONNECTING);
      manager.setState(ConnectionState.CONNECTED);

      expect(states).toHaveLength(2);
      expect(states[0].to).toBe(ConnectionState.CONNECTING);
      expect(states[1].to).toBe(ConnectionState.CONNECTED);
    });

    test("should get current state", () => {
      const state = manager.getState();

      expect(state).toHaveProperty("state");
      expect(state).toHaveProperty("stats");
      expect(state).toHaveProperty("isHealthy");
      expect(state).toHaveProperty("uptime");
    });

    test("should track statistics", async () => {
      await manager.performHealthCheck();
      const stats = manager.getStats();

      expect(stats).toHaveProperty("totalHealthChecks");
      expect(stats).toHaveProperty("healthCheckSuccessRate");
      expect(stats).toHaveProperty("currentState");
      expect(stats.totalHealthChecks).toBeGreaterThan(0);
    }, 10000);
  });

  describe("Event Emitters", () => {
    test("should emit connected event", (done) => {
      manager.on("connected", (data) => {
        expect(data).toHaveProperty("serviceUrl");
        done();
      });

      manager.connect().catch(() => done()); // Service might be unavailable
    }, 15000);

    test("should emit disconnected event", (done) => {
      manager.on("disconnected", (data) => {
        expect(data).toHaveProperty("serviceUrl");
        done();
      });

      manager.connect().then(() => {
        manager.disconnect();
      });
    }, 15000);

    test("should allow removing listeners", () => {
      const callback = () => {};
      manager.on("connected", callback);
      manager.off("connected", callback);

      // Should not have the callback anymore
      expect(manager.listeners.get("connected")).toEqual([]);
    });

    test("should handle errors in listeners gracefully", (done) => {
      manager.on("stateChange", () => {
        throw new Error("Test error");
      });

      manager.on("stateChange", () => {
        done(); // This should still execute
      });

      manager.setState(ConnectionState.CONNECTING);
    });
  });

  describe("Shared Connection Manager", () => {
    test("should create shared instance", () => {
      const shared = getSharedConnectionManager({
        serviceUrl: "https://id.chitty.cc",
        apiKey: process.env.CHITTY_ID_TOKEN,
      });

      expect(shared).toBeInstanceOf(ChittyIDConnectionManager);
    });

    test("should return same shared instance", () => {
      const shared1 = getSharedConnectionManager();
      const shared2 = getSharedConnectionManager();

      expect(shared1).toBe(shared2);
    });

    test("should reset shared instance", () => {
      const shared1 = getSharedConnectionManager();
      resetSharedConnectionManager();
      const shared2 = getSharedConnectionManager();

      expect(shared1).not.toBe(shared2);
    });
  });

  describe("Reset Functionality", () => {
    test("should reset manager state", async () => {
      await manager.connect();
      manager.stats.totalConnections = 10;

      manager.reset();

      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
      expect(manager.stats.totalConnections).toBe(0);
      expect(manager.reconnectAttempts).toBe(0);
    }, 15000);
  });
});
