/**
 * ChittyID Resilience Layer
 * Provides retry logic, circuit breaker, and fault tolerance for ChittyID operations
 */

/**
 * Retry configuration for ChittyID operations
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNRESET",
    "EPIPE",
    "fetch failed",
    "network error",
  ],
};

/**
 * Execute a function with retry and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} - Result from function
 */
export async function withRetry(fn, config = RETRY_CONFIG) {
  let lastError;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = config.retryableErrors.some(
        (code) =>
          error.code === code ||
          error.message?.toLowerCase().includes(code.toLowerCase()),
      );

      // Don't retry if not retryable or if last attempt
      if (!isRetryable || attempt === config.maxAttempts) {
        throw error;
      }

      // Log retry attempt
      console.warn(
        `ChittyID request failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms...`,
        {
          error: error.message,
          attempt,
          retryableError: isRetryable,
        },
      );

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Circuit Breaker for ChittyID service
 * Prevents cascading failures when service is down
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitorWindow = options.monitorWindow || 10000; // 10 seconds
    this.halfOpenAttempts = options.halfOpenAttempts || 3;

    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  /**
   * Execute a function through the circuit breaker
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} - Result from function
   */
  async execute(fn) {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN") {
      const timeSinceFailure = Date.now() - this.lastFailureTime;

      if (timeSinceFailure >= this.resetTimeout) {
        this.transitionTo("HALF_OPEN");
        console.info(
          "ChittyID circuit breaker: Attempting recovery (HALF_OPEN state)",
        );
      } else {
        const error = new Error(
          `ChittyID service circuit breaker is OPEN - service unavailable. ` +
            `Will retry in ${Math.ceil((this.resetTimeout - timeSinceFailure) / 1000)}s`,
        );
        error.circuitBreakerState = this.state;
        throw error;
      }
    }

    try {
      const result = await fn();

      // Success handling
      if (this.state === "HALF_OPEN") {
        this.halfOpenSuccesses++;

        // Close circuit if enough successes
        if (this.halfOpenSuccesses >= this.halfOpenAttempts) {
          this.close();
        }
      }

      return result;
    } catch (error) {
      this.recordFailure();

      // Reset half-open counter on failure
      if (this.state === "HALF_OPEN") {
        this.halfOpenSuccesses = 0;
      }

      throw error;
    }
  }

  /**
   * Record a failure
   */
  recordFailure() {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    // Remove failures outside monitor window
    this.failures = this.failures.filter(
      (time) => now - time < this.monitorWindow,
    );

    // Open circuit if threshold exceeded
    if (
      this.failures.length >= this.failureThreshold &&
      this.state !== "OPEN"
    ) {
      this.open();
    }
  }

  /**
   * Open the circuit breaker
   */
  open() {
    this.transitionTo("OPEN");
    console.error(
      `ChittyID circuit breaker OPENED - ${this.failures.length} failures in ${this.monitorWindow}ms`,
      {
        failureThreshold: this.failureThreshold,
        failures: this.failures.length,
        resetTimeout: `${this.resetTimeout}ms`,
      },
    );
  }

  /**
   * Close the circuit breaker
   */
  close() {
    this.transitionTo("CLOSED");
    this.failures = [];
    this.halfOpenSuccesses = 0;
    console.info("ChittyID circuit breaker CLOSED - service recovered", {
      uptime: `${Date.now() - this.lastStateChange}ms`,
    });
  }

  /**
   * Transition to a new state
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (oldState !== newState) {
      console.info(`ChittyID circuit breaker: ${oldState} → ${newState}`);
    }
  }

  /**
   * Get current circuit breaker state
   * @returns {Object} - Circuit breaker status
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures.length,
      lastFailure: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      uptimeMs: Date.now() - this.lastStateChange,
      halfOpenSuccesses: this.halfOpenSuccesses,
      config: {
        failureThreshold: this.failureThreshold,
        resetTimeout: this.resetTimeout,
        monitorWindow: this.monitorWindow,
      },
    };
  }

  /**
   * Reset the circuit breaker manually
   */
  reset() {
    this.close();
    console.info("ChittyID circuit breaker manually reset");
  }
}

// Shared circuit breaker instance
let sharedCircuitBreaker;

/**
 * Get or create shared circuit breaker instance
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker} - Shared circuit breaker
 */
export function getCircuitBreaker(options = {}) {
  if (!sharedCircuitBreaker) {
    sharedCircuitBreaker = new CircuitBreaker(options);
  }
  return sharedCircuitBreaker;
}

/**
 * Execute a function with both retry logic and circuit breaker
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options for retry and circuit breaker
 * @returns {Promise<any>} - Result from function
 */
export async function withResilience(fn, options = {}) {
  const { retryConfig, circuitBreakerConfig } = options;
  const circuitBreaker = getCircuitBreaker(circuitBreakerConfig);

  return circuitBreaker.execute(async () => {
    return withRetry(fn, retryConfig);
  });
}
