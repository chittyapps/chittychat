/**
 * ChittyID Resilience & Failure Injection Tests
 * Tests retry logic, circuit breaker behavior, and failure scenarios
 *
 * This file measures ACTUAL recovery rates and failure handling,
 * not theoretical estimates.
 */

import { describe, test, expect, beforeEach } from "@jest/globals";
import { writeFileSync } from "fs";
import { join } from "path";
import {
  generateChittyID,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  setResilienceEnabled,
} from "../src/lib/chittyid-service.js";
import {
  withRetry,
  RETRY_CONFIG,
  CircuitBreaker,
} from "../src/lib/chittyid-resilience.js";

// Test results storage
const resilienceResults = {
  timestamp: new Date().toISOString(),
  measurements: {},
};

// Helper: Simulate transient errors
class ErrorSimulator {
  constructor(errorType, failureRate = 0.5) {
    this.errorType = errorType;
    this.failureRate = failureRate;
    this.attemptCount = 0;
  }

  async execute(fn) {
    this.attemptCount++;
    if (Math.random() < this.failureRate) {
      const error = new Error(`Simulated ${this.errorType} error`);
      error.code = this.errorType;
      throw error;
    }
    return await fn();
  }
}

// Helper: Count retry attempts
function createRetryCounter() {
  const counter = { attempts: 0, successes: 0, failures: 0 };

  const wrappedFn = async (fn) => {
    counter.attempts++;
    try {
      const result = await fn();
      counter.successes++;
      return result;
    } catch (error) {
      counter.failures++;
      throw error;
    }
  };

  return { counter, wrappedFn };
}

describe("ChittyID Resilience Tests", () => {
  beforeEach(() => {
    resetCircuitBreaker();
    setResilienceEnabled(true);
  });

  describe("Retry Logic", () => {
    test("should retry on transient ETIMEDOUT errors", async () => {
      let attemptCount = 0;

      const unreliableFn = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error("Connection timeout");
          error.code = "ETIMEDOUT";
          throw error;
        }
        return "success";
      };

      const startTime = Date.now();
      const result = await withRetry(unreliableFn);
      const duration = Date.now() - startTime;

      resilienceResults.measurements.retryOnTimeout = {
        description: "Retry behavior on ETIMEDOUT errors",
        totalAttempts: attemptCount,
        successAfterAttempts: attemptCount,
        durationMs: duration,
        result,
      };

      console.log("\n📊 Retry on ETIMEDOUT:");
      console.log(`   Attempts: ${attemptCount}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Result: ${result}`);

      expect(result).toBe("success");
      expect(attemptCount).toBe(3);
      expect(duration).toBeGreaterThan(100); // Should have delay
    });

    test("should retry on ECONNREFUSED errors", async () => {
      let attemptCount = 0;

      const unreliableFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          const error = new Error("Connection refused");
          error.code = "ECONNREFUSED";
          throw error;
        }
        return "success";
      };

      const result = await withRetry(unreliableFn);

      resilienceResults.measurements.retryOnConnRefused = {
        description: "Retry behavior on ECONNREFUSED errors",
        totalAttempts: attemptCount,
        successAfterAttempts: attemptCount,
        result,
      };

      console.log("\n📊 Retry on ECONNREFUSED:");
      console.log(`   Attempts: ${attemptCount}`);
      console.log(`   Result: ${result}`);

      expect(result).toBe("success");
      expect(attemptCount).toBe(2);
    });

    test("should not retry on non-retryable errors", async () => {
      let attemptCount = 0;

      const permanentErrorFn = async () => {
        attemptCount++;
        const error = new Error("Invalid request");
        error.code = "INVALID_REQUEST";
        throw error;
      };

      await expect(withRetry(permanentErrorFn)).rejects.toThrow(
        "Invalid request",
      );

      resilienceResults.measurements.noRetryOnPermanentError = {
        description: "No retry on non-retryable errors",
        totalAttempts: attemptCount,
        errorType: "INVALID_REQUEST",
      };

      console.log("\n📊 No Retry on Permanent Error:");
      console.log(`   Attempts: ${attemptCount}`);

      expect(attemptCount).toBe(1); // Should not retry
    });

    test("should respect max retry attempts", async () => {
      let attemptCount = 0;

      const alwaysFailFn = async () => {
        attemptCount++;
        const error = new Error("Always fails");
        error.code = "ETIMEDOUT";
        throw error;
      };

      await expect(withRetry(alwaysFailFn)).rejects.toThrow("Always fails");

      resilienceResults.measurements.maxRetryAttempts = {
        description: "Respects max retry attempts",
        totalAttempts: attemptCount,
        maxAttempts: RETRY_CONFIG.maxAttempts,
      };

      console.log("\n📊 Max Retry Attempts:");
      console.log(`   Attempts: ${attemptCount}`);
      console.log(`   Max Allowed: ${RETRY_CONFIG.maxAttempts}`);

      expect(attemptCount).toBe(RETRY_CONFIG.maxAttempts);
    });

    test("measure actual retry success rate", async () => {
      const trials = 100;
      let successes = 0;
      let totalAttempts = 0;

      for (let i = 0; i < trials; i++) {
        let attemptCount = 0;

        const intermittentFn = async () => {
          attemptCount++;
          // 50% chance of transient error
          if (Math.random() < 0.5 && attemptCount === 1) {
            const error = new Error("Transient error");
            error.code = "ETIMEDOUT";
            throw error;
          }
          return "success";
        };

        try {
          await withRetry(intermittentFn);
          successes++;
        } catch (error) {
          // Failed after all retries
        }

        totalAttempts += attemptCount;
      }

      const successRate = (successes / trials) * 100;
      const avgAttempts = totalAttempts / trials;

      resilienceResults.measurements.retrySuccessRate = {
        description: "Measured retry success rate with 50% transient failures",
        trials,
        successes,
        failures: trials - successes,
        successRate: `${successRate.toFixed(2)}%`,
        avgAttemptsPerRequest: avgAttempts.toFixed(2),
      };

      console.log("\n📊 Retry Success Rate (100 trials):");
      console.log(`   Successes: ${successes}/${trials}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Attempts: ${avgAttempts.toFixed(2)}`);

      expect(successRate).toBeGreaterThan(90); // Should recover from most transient errors
    }, 30000);
  });

  describe("Circuit Breaker Behavior", () => {
    test("should open circuit after threshold failures", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        monitorWindow: 10000,
      });

      let failureCount = 0;

      const alwaysFailFn = async () => {
        failureCount++;
        throw new Error("Service down");
      };

      // Trigger failures until circuit opens
      for (let i = 0; i < 5; i++) {
        try {
          await cb.execute(alwaysFailFn);
        } catch (error) {
          // Expected
        }
      }

      const state = cb.getState();

      resilienceResults.measurements.circuitBreakerOpen = {
        description: "Circuit breaker opens after threshold failures",
        failureThreshold: 5,
        actualFailures: failureCount,
        state: state.state,
        failures: state.failures,
      };

      console.log("\n📊 Circuit Breaker Opens:");
      console.log(`   Threshold: 5`);
      console.log(`   Failures: ${failureCount}`);
      console.log(`   State: ${state.state}`);

      expect(state.state).toBe("OPEN");
      expect(failureCount).toBe(5);
    });

    test("should fail fast when circuit is open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000,
      });

      // Open the circuit
      const failFn = async () => {
        throw new Error("Service down");
      };

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      // Now test fail-fast behavior
      const startTime = Date.now();
      try {
        await cb.execute(failFn);
      } catch (error) {
        const duration = Date.now() - startTime;

        resilienceResults.measurements.circuitBreakerFailFast = {
          description: "Circuit breaker fails fast when OPEN",
          state: "OPEN",
          failFastLatencyMs: duration,
          errorMessage: error.message,
        };

        console.log("\n📊 Circuit Breaker Fail Fast:");
        console.log(`   State: OPEN`);
        console.log(`   Latency: ${duration}ms`);

        expect(duration).toBeLessThan(50); // Should fail immediately
        expect(error.message).toContain("circuit breaker is OPEN");
      }
    });

    test("should transition to HALF_OPEN after reset timeout", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000, // 1 second
      });

      // Open the circuit
      const failFn = async () => {
        throw new Error("Service down");
      };

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      expect(cb.getState().state).toBe("OPEN");

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next attempt should transition to HALF_OPEN
      const successFn = async () => "success";

      try {
        await cb.execute(successFn);
      } catch (error) {
        // May still fail if in HALF_OPEN
      }

      const state = cb.getState();

      resilienceResults.measurements.circuitBreakerHalfOpen = {
        description: "Circuit breaker transitions to HALF_OPEN",
        initialState: "OPEN",
        afterTimeout: state.state,
        resetTimeoutMs: 1000,
      };

      console.log("\n📊 Circuit Breaker HALF_OPEN:");
      console.log(`   Initial: OPEN`);
      console.log(`   After Timeout: ${state.state}`);

      // Should be CLOSED (success) or HALF_OPEN (trying)
      expect(["CLOSED", "HALF_OPEN"]).toContain(state.state);
    }, 5000);

    test("should close circuit after successful recovery", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenAttempts: 3,
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => {
            throw new Error("Service down");
          });
        } catch (error) {
          // Expected
        }
      }

      expect(cb.getState().state).toBe("OPEN");

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Successful requests should close circuit
      const successFn = async () => "success";

      for (let i = 0; i < 3; i++) {
        await cb.execute(successFn);
      }

      const state = cb.getState();

      resilienceResults.measurements.circuitBreakerRecovery = {
        description: "Circuit breaker closes after successful recovery",
        initialState: "OPEN",
        afterRecovery: state.state,
        successfulAttempts: 3,
      };

      console.log("\n📊 Circuit Breaker Recovery:");
      console.log(`   Initial: OPEN`);
      console.log(`   After Recovery: ${state.state}`);
      console.log(`   Successful Attempts: 3`);

      expect(state.state).toBe("CLOSED");
    }, 5000);

    test("measure mean time to recovery (MTTR)", async () => {
      const trials = 10;
      const recoveryTimes = [];

      for (let trial = 0; trial < trials; trial++) {
        const cb = new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 500,
          halfOpenAttempts: 2,
        });

        // Open circuit
        for (let i = 0; i < 3; i++) {
          try {
            await cb.execute(async () => {
              throw new Error("Down");
            });
          } catch (e) {}
        }

        const failureTime = Date.now();

        // Wait for reset + recovery
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Recover
        for (let i = 0; i < 2; i++) {
          await cb.execute(async () => "ok");
        }

        const recoveryTime = Date.now() - failureTime;
        recoveryTimes.push(recoveryTime);
      }

      const avgRecovery =
        recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
      const minRecovery = Math.min(...recoveryTimes);
      const maxRecovery = Math.max(...recoveryTimes);

      resilienceResults.measurements.mttr = {
        description: "Mean Time To Recovery (MTTR)",
        trials,
        avgRecoveryMs: avgRecovery.toFixed(2),
        minRecoveryMs: minRecovery,
        maxRecoveryMs: maxRecovery,
        allRecoveryTimes: recoveryTimes,
      };

      console.log("\n📊 Mean Time To Recovery:");
      console.log(`   Trials: ${trials}`);
      console.log(`   Avg: ${avgRecovery.toFixed(2)}ms`);
      console.log(`   Min: ${minRecovery}ms`);
      console.log(`   Max: ${maxRecovery}ms`);

      expect(avgRecovery).toBeLessThan(2000);
    }, 15000);
  });

  describe("Combined Resilience (Retry + Circuit Breaker)", () => {
    test("measure recovery rate with combined resilience", async () => {
      const trials = 50;
      let successes = 0;
      let retriedSuccesses = 0;
      let totalAttempts = 0;

      for (let i = 0; i < trials; i++) {
        resetCircuitBreaker();
        let attemptCount = 0;

        const intermittentFn = async () => {
          attemptCount++;
          // 40% chance of transient error on first attempt
          if (attemptCount === 1 && Math.random() < 0.4) {
            const error = new Error("Transient");
            error.code = "ETIMEDOUT";
            throw error;
          }
          return "success";
        };

        try {
          const result = await withRetry(intermittentFn);
          successes++;
          if (attemptCount > 1) {
            retriedSuccesses++;
          }
          totalAttempts += attemptCount;
        } catch (error) {
          totalAttempts += attemptCount;
        }
      }

      const successRate = (successes / trials) * 100;
      const retrySuccessRate =
        retriedSuccesses > 0
          ? (retriedSuccesses / (trials - successes + retriedSuccesses)) * 100
          : 0;
      const avgAttempts = totalAttempts / trials;

      resilienceResults.measurements.combinedResilienceRecovery = {
        description:
          "Recovery rate with retry + circuit breaker (40% transient failures)",
        trials,
        successes,
        failures: trials - successes,
        retriedSuccesses,
        successRate: `${successRate.toFixed(2)}%`,
        retryRecoveryRate: `${retrySuccessRate.toFixed(2)}%`,
        avgAttemptsPerRequest: avgAttempts.toFixed(2),
      };

      console.log("\n📊 Combined Resilience Recovery:");
      console.log(`   Trials: ${trials}`);
      console.log(`   Successes: ${successes}/${trials}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Retry Recovery Rate: ${retrySuccessRate.toFixed(2)}%`);
      console.log(`   Avg Attempts: ${avgAttempts.toFixed(2)}`);

      expect(successRate).toBeGreaterThan(90);
    }, 30000);
  });

  describe("Export Results", () => {
    test("save resilience test results to JSON", () => {
      const outputPath = join(process.cwd(), "test", "resilience-results.json");
      writeFileSync(outputPath, JSON.stringify(resilienceResults, null, 2));

      console.log(`\n✅ Resilience results saved to: ${outputPath}\n`);

      expect(resilienceResults.measurements).toBeDefined();
    });
  });
});
