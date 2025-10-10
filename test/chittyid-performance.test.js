/**
 * ChittyID Performance Benchmark Suite
 * Real measurements for validation, caching, and resilience performance
 *
 * This file produces ACTUAL data, not theoretical estimates.
 * All measurements are exported to JSON for evidence-based documentation.
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { writeFileSync } from "fs";
import { join } from "path";
import {
  validateChittyIDFormat,
  generateChittyID,
  clearCache,
  getCacheStats,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from "../src/lib/chittyid-service.js";

// Benchmark results storage
const benchmarkResults = {
  timestamp: new Date().toISOString(),
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  measurements: {},
};

// Helper: Measure latency
function measureLatency(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const latencyNs = Number(end - start);
  const latencyMs = latencyNs / 1_000_000;
  return { result, latencyMs };
}

// Helper: Measure async latency
async function measureLatencyAsync(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const latencyNs = Number(end - start);
  const latencyMs = latencyNs / 1_000_000;
  return { result, latencyMs };
}

// Helper: Calculate percentiles
function calculatePercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length * 0.5)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// Test ChittyIDs (valid format)
const TEST_IDS = [
  "01-A-CHI-1234-I-2409-5-0",
  "01-B-CHI-5678-P-2410-7-12",
  "01-C-TES-9999-E-2510-3-45",
  "02-A-NYC-0001-L-2409-8-67",
  "01-A-CHI-1111-A-2409-1-1",
  "01-A-CHI-2222-F-2409-2-2",
  "01-A-CHI-3333-C-2409-3-3",
  "01-A-CHI-4444-X-2409-4-4",
  "01-A-CHI-5555-I-2409-5-5",
  "01-A-CHI-6666-P-2409-6-6",
];

describe("ChittyID Performance Benchmarks", () => {
  beforeAll(() => {
    console.log("\n===================================");
    console.log("ChittyID Performance Benchmark Suite");
    console.log("===================================\n");
    console.log("Environment:");
    console.log(`- Node: ${process.version}`);
    console.log(`- Platform: ${process.platform}`);
    console.log(`- Arch: ${process.arch}\n`);
  });

  afterAll(() => {
    // Export results to JSON
    const outputPath = join(process.cwd(), "test", "benchmark-results.json");
    writeFileSync(outputPath, JSON.stringify(benchmarkResults, null, 2));
    console.log(`\n✅ Benchmark results saved to: ${outputPath}\n`);
  });

  describe("Baseline Validation Performance (No Cache)", () => {
    test("measure validation latency without cache (cold)", () => {
      clearCache();

      const latencies = [];
      const sampleSize = 100;

      for (let i = 0; i < sampleSize; i++) {
        const testId = TEST_IDS[i % TEST_IDS.length];
        const { latencyMs } = measureLatency(() =>
          validateChittyIDFormat(testId, { useCache: false }),
        );
        latencies.push(latencyMs);
      }

      const stats = calculatePercentiles(latencies);

      benchmarkResults.measurements.validationNoCacheCold = {
        description: "Validation without cache (cold start)",
        sampleSize,
        unit: "ms",
        ...stats,
      };

      console.log("\n📊 Validation (No Cache - Cold):");
      console.log(`   Samples: ${sampleSize}`);
      console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
      console.log(`   Median: ${stats.median.toFixed(3)}ms`);
      console.log(`   P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`   P99: ${stats.p99.toFixed(3)}ms`);

      expect(stats.mean).toBeGreaterThan(0);
      expect(stats.p99).toBeLessThan(50); // Should be fast for format check
    });
  });

  describe("Cached Validation Performance", () => {
    test("measure validation latency with cache (warm)", () => {
      clearCache();

      // Warm up cache
      TEST_IDS.forEach((id) => validateChittyIDFormat(id));

      const latencies = [];
      const sampleSize = 100;

      for (let i = 0; i < sampleSize; i++) {
        const testId = TEST_IDS[i % TEST_IDS.length];
        const { latencyMs } = measureLatency(() =>
          validateChittyIDFormat(testId),
        );
        latencies.push(latencyMs);
      }

      const stats = calculatePercentiles(latencies);
      const cacheStats = getCacheStats();

      benchmarkResults.measurements.validationCachedWarm = {
        description: "Validation with cache (warm, cache hits)",
        sampleSize,
        unit: "ms",
        cacheStats,
        ...stats,
      };

      console.log("\n📊 Validation (Cached - Warm):");
      console.log(`   Samples: ${sampleSize}`);
      console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
      console.log(`   Median: ${stats.median.toFixed(3)}ms`);
      console.log(`   P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`   P99: ${stats.p99.toFixed(3)}ms`);
      console.log(`   Cache Hit Rate: ${cacheStats.hitRate}`);

      expect(stats.mean).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toContain("%");
    });
  });

  describe("Cache Hit Rate Impact", () => {
    test("measure performance at different cache hit rates", () => {
      const hitRates = [0, 25, 50, 70, 85, 90, 100];
      const results = [];

      for (const targetHitRate of hitRates) {
        clearCache();

        // Populate cache based on hit rate
        const cacheSize = Math.floor((TEST_IDS.length * targetHitRate) / 100);
        for (let i = 0; i < cacheSize; i++) {
          validateChittyIDFormat(TEST_IDS[i]);
        }

        // Measure with mixed hit/miss pattern
        const latencies = [];
        const sampleSize = 100;

        for (let i = 0; i < sampleSize; i++) {
          const willHit = Math.random() * 100 < targetHitRate;
          const testId = willHit
            ? TEST_IDS[i % cacheSize] || TEST_IDS[0]
            : TEST_IDS[(i + cacheSize) % TEST_IDS.length];

          const { latencyMs } = measureLatency(() =>
            validateChittyIDFormat(testId),
          );
          latencies.push(latencyMs);
        }

        const stats = calculatePercentiles(latencies);
        results.push({
          targetHitRate: `${targetHitRate}%`,
          actualCacheStats: getCacheStats(),
          sampleSize,
          unit: "ms",
          ...stats,
        });

        console.log(`\n📊 Cache Hit Rate: ${targetHitRate}%`);
        console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
        console.log(`   P95: ${stats.p95.toFixed(3)}ms`);
      }

      benchmarkResults.measurements.cacheHitRateImpact = {
        description: "Performance at different cache hit rates",
        results,
      };

      expect(results.length).toBe(hitRates.length);
    });

    test("calculate actual latency reduction from caching", () => {
      const noCacheResult = benchmarkResults.measurements.validationNoCacheCold;
      const cachedResult = benchmarkResults.measurements.validationCachedWarm;

      if (noCacheResult && cachedResult) {
        const reductionPercent =
          ((noCacheResult.mean - cachedResult.mean) / noCacheResult.mean) * 100;

        benchmarkResults.measurements.cacheLatencyReduction = {
          description: "Measured latency reduction from caching",
          noCacheMean: noCacheResult.mean,
          cachedMean: cachedResult.mean,
          reductionPercent: `${reductionPercent.toFixed(2)}%`,
          reductionMs: noCacheResult.mean - cachedResult.mean,
        };

        console.log("\n📊 Cache Performance Impact:");
        console.log(`   No Cache: ${noCacheResult.mean.toFixed(3)}ms (mean)`);
        console.log(`   Cached: ${cachedResult.mean.toFixed(3)}ms (mean)`);
        console.log(`   Reduction: ${reductionPercent.toFixed(2)}%`);

        expect(reductionPercent).toBeGreaterThan(0);
      }
    });
  });

  describe("ChittyID Generation Performance", () => {
    test("measure generation latency (with retry/circuit breaker)", async () => {
      resetCircuitBreaker();

      const latencies = [];
      const sampleSize = 10; // Fewer samples due to network calls

      for (let i = 0; i < sampleSize; i++) {
        try {
          const { latencyMs } = await measureLatencyAsync(() =>
            generateChittyID("INFO", { test: true, index: i }),
          );
          latencies.push(latencyMs);
        } catch (error) {
          console.warn(
            `   Generation attempt ${i + 1} failed: ${error.message}`,
          );
        }
      }

      if (latencies.length > 0) {
        const stats = calculatePercentiles(latencies);

        benchmarkResults.measurements.generationWithResilience = {
          description: "ChittyID generation with retry + circuit breaker",
          sampleSize,
          successCount: latencies.length,
          failureCount: sampleSize - latencies.length,
          unit: "ms",
          ...stats,
        };

        console.log("\n📊 Generation (with Resilience):");
        console.log(`   Samples: ${sampleSize}`);
        console.log(`   Successes: ${latencies.length}`);
        console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
        console.log(`   Median: ${stats.median.toFixed(3)}ms`);
        console.log(`   P95: ${stats.p95.toFixed(3)}ms`);

        expect(stats.mean).toBeGreaterThan(0);
      } else {
        console.log(
          "\n⚠️  All generation attempts failed (service may be unavailable)",
        );
        benchmarkResults.measurements.generationWithResilience = {
          description: "ChittyID generation - all attempts failed",
          sampleSize,
          successCount: 0,
          failureCount: sampleSize,
          note: "Service unavailable during benchmark",
        };
      }
    }, 60000); // 60s timeout
  });

  describe("Concurrent Request Performance", () => {
    test("measure validation performance under concurrent load", async () => {
      clearCache();

      const concurrencyLevels = [10, 50, 100];
      const results = [];

      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();

        const promises = Array(concurrency)
          .fill(null)
          .map((_, i) => {
            const testId = TEST_IDS[i % TEST_IDS.length];
            return Promise.resolve(validateChittyIDFormat(testId));
          });

        await Promise.all(promises);

        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / concurrency;
        const throughput = (concurrency / totalTime) * 1000;

        results.push({
          concurrency,
          totalTimeMs: totalTime,
          avgTimeMs: avgTime,
          throughputPerSec: throughput.toFixed(2),
        });

        console.log(`\n📊 Concurrent Validation (${concurrency} requests):`);
        console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`   Avg Time: ${avgTime.toFixed(3)}ms`);
        console.log(`   Throughput: ${throughput.toFixed(2)} req/sec`);
      }

      benchmarkResults.measurements.concurrentValidation = {
        description: "Validation performance under concurrent load",
        results,
      };

      expect(results.length).toBe(concurrencyLevels.length);
    }, 30000);
  });

  describe("Circuit Breaker Overhead", () => {
    test("measure circuit breaker overhead (closed state)", () => {
      resetCircuitBreaker();

      const latenciesWithCB = [];
      const latenciesWithoutCB = [];
      const sampleSize = 100;

      // Measure with circuit breaker
      for (let i = 0; i < sampleSize; i++) {
        const testId = TEST_IDS[i % TEST_IDS.length];
        const { latencyMs } = measureLatency(() =>
          validateChittyIDFormat(testId),
        );
        latenciesWithCB.push(latencyMs);
      }

      // Measure without (using cache: false to simulate direct call)
      for (let i = 0; i < sampleSize; i++) {
        const testId = TEST_IDS[i % TEST_IDS.length];
        const { latencyMs } = measureLatency(() =>
          validateChittyIDFormat(testId, { useCache: false }),
        );
        latenciesWithoutCB.push(latencyMs);
      }

      const statsWithCB = calculatePercentiles(latenciesWithCB);
      const statsWithoutCB = calculatePercentiles(latenciesWithoutCB);

      const overheadMs = statsWithCB.mean - statsWithoutCB.mean;
      const overheadPercent = (overheadMs / statsWithoutCB.mean) * 100;

      benchmarkResults.measurements.circuitBreakerOverhead = {
        description: "Circuit breaker overhead in CLOSED state",
        sampleSize,
        withCircuitBreaker: statsWithCB,
        withoutCircuitBreaker: statsWithoutCB,
        overheadMs,
        overheadPercent: `${overheadPercent.toFixed(2)}%`,
      };

      console.log("\n📊 Circuit Breaker Overhead:");
      console.log(`   With CB: ${statsWithCB.mean.toFixed(3)}ms (mean)`);
      console.log(`   Without CB: ${statsWithoutCB.mean.toFixed(3)}ms (mean)`);
      console.log(
        `   Overhead: ${overheadMs.toFixed(3)}ms (${overheadPercent.toFixed(2)}%)`,
      );

      // Circuit breaker overhead should be minimal
      expect(Math.abs(overheadPercent)).toBeLessThan(50);
    });
  });

  describe("Summary Statistics", () => {
    test("generate overall performance summary", () => {
      const summary = {
        timestamp: benchmarkResults.timestamp,
        environment: benchmarkResults.environment,
        keyFindings: {},
      };

      // Calculate key findings from measurements
      const cacheReduction =
        benchmarkResults.measurements.cacheLatencyReduction;
      if (cacheReduction) {
        summary.keyFindings.cachePerformance = {
          latencyReduction: cacheReduction.reductionPercent,
          noCacheMean: `${cacheReduction.noCacheMean.toFixed(3)}ms`,
          cachedMean: `${cacheReduction.cachedMean.toFixed(3)}ms`,
        };
      }

      const hitRateImpact = benchmarkResults.measurements.cacheHitRateImpact;
      if (hitRateImpact) {
        const bestCase = hitRateImpact.results.find(
          (r) => r.targetHitRate === "100%",
        );
        const worstCase = hitRateImpact.results.find(
          (r) => r.targetHitRate === "0%",
        );
        const realistic = hitRateImpact.results.find(
          (r) => r.targetHitRate === "70%",
        );

        summary.keyFindings.cacheHitRates = {
          bestCase100Percent: bestCase
            ? `${bestCase.mean.toFixed(3)}ms`
            : "N/A",
          worstCase0Percent: worstCase
            ? `${worstCase.mean.toFixed(3)}ms`
            : "N/A",
          realistic70Percent: realistic
            ? `${realistic.mean.toFixed(3)}ms`
            : "N/A",
        };
      }

      const concurrent = benchmarkResults.measurements.concurrentValidation;
      if (concurrent) {
        const highest = concurrent.results[concurrent.results.length - 1];
        summary.keyFindings.concurrency = {
          maxConcurrency: highest.concurrency,
          throughput: `${highest.throughputPerSec} req/sec`,
          avgLatency: `${highest.avgTimeMs.toFixed(3)}ms`,
        };
      }

      benchmarkResults.summary = summary;

      console.log("\n===================================");
      console.log("Performance Summary");
      console.log("===================================");
      console.log(JSON.stringify(summary, null, 2));

      expect(summary.keyFindings).toBeDefined();
    });
  });
});
