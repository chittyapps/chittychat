/**
 * ChittyID Fixer MCP Tool
 * Automatically replaces local ID generation with ChittyID service calls
 *
 * MCP Tool: fix-local-id-generation
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

interface FixResult {
  file: string;
  line: number;
  oldPattern: string;
  newPattern: string;
  severity: "CRITICAL" | "HIGH";
}

interface FixReport {
  filesScanned: number;
  filesModified: number;
  violationsFixed: number;
  results: FixResult[];
}

/**
 * Patterns that violate ChittyOS "SERVICE OR FAIL" policy
 */
const VIOLATION_PATTERNS = [
  // Math.random() based generation
  {
    regex:
      /private\s+generateId\(\):\s*string\s*\{\s*return\s+Math\.random\(\)\.toString\(36\)[^}]+\}/gs,
    severity: "CRITICAL" as const,
    description: "Math.random() local ID generation",
  },
  {
    regex:
      /function\s+generateId\(\):\s*string\s*\{\s*return\s+Math\.random\(\)\.toString\(36\)[^}]+\}/gs,
    severity: "CRITICAL" as const,
    description: "Math.random() local ID generation (function)",
  },
  // UUID/nanoid imports
  {
    regex: /import\s+\{\s*v4\s+as\s+uuidv4\s*\}\s+from\s+['"]uuid['"]/g,
    severity: "HIGH" as const,
    description: "UUID import (should use ChittyID service)",
  },
  {
    regex: /import\s+\{\s*nanoid\s*\}\s+from\s+['"]nanoid['"]/g,
    severity: "HIGH" as const,
    description: "nanoid import (should use ChittyID service)",
  },
];

/**
 * Replacement template for generateId() methods
 */
const REPLACEMENT_TEMPLATE = `private async generateId(): Promise<string> {
    // FIXED: Replaced local generation with ChittyID service call
    // Complies with ChittyOS "SERVICE OR FAIL" principle
    const { generateChittyID } = await import('../lib/chittyid-service.js');
    return await generateChittyID('INFO', { source: 'mcp-protocol', auto: true });
  }`;

const FUNCTION_REPLACEMENT_TEMPLATE = `async function generateId(): Promise<string> {
  // FIXED: Replaced local generation with ChittyID service call
  // Complies with ChittyOS "SERVICE OR FAIL" principle
  const { generateChittyID } = await import('../lib/chittyid-service.js');
  return await generateChittyID('INFO', { source: 'auto-generated', auto: true });
}`;

/**
 * Fix local ID generation in a single file
 */
export function fixFileIdGeneration(filePath: string): FixResult[] {
  const results: FixResult[] = [];
  let content = readFileSync(filePath, "utf-8");
  let modified = false;

  // Fix private method patterns
  const privateMethodMatches = content.match(VIOLATION_PATTERNS[0].regex);
  if (privateMethodMatches) {
    privateMethodMatches.forEach((match) => {
      const lineNumber = content
        .substring(0, content.indexOf(match))
        .split("\n").length;

      results.push({
        file: filePath,
        line: lineNumber,
        oldPattern: match.substring(0, 100) + "...",
        newPattern: REPLACEMENT_TEMPLATE.substring(0, 100) + "...",
        severity: "CRITICAL",
      });

      content = content.replace(match, REPLACEMENT_TEMPLATE);
      modified = true;
    });
  }

  // Fix function patterns
  const functionMatches = content.match(VIOLATION_PATTERNS[1].regex);
  if (functionMatches) {
    functionMatches.forEach((match) => {
      const lineNumber = content
        .substring(0, content.indexOf(match))
        .split("\n").length;

      results.push({
        file: filePath,
        line: lineNumber,
        oldPattern: match.substring(0, 100) + "...",
        newPattern: FUNCTION_REPLACEMENT_TEMPLATE.substring(0, 100) + "...",
        severity: "CRITICAL",
      });

      content = content.replace(match, FUNCTION_REPLACEMENT_TEMPLATE);
      modified = true;
    });
  }

  // Update all generateId() calls to be async
  if (modified) {
    // Find all places where generateId() is called and make them await
    content = content.replace(
      /(?<!await\s)this\.generateId\(\)/g,
      "await this.generateId()",
    );
    content = content.replace(
      /(?<!await\s)generateId\(\)/g,
      "await generateId()",
    );

    writeFileSync(filePath, content, "utf-8");
  }

  return results;
}

/**
 * Fix local ID generation across multiple files
 */
export async function fixLocalIdGeneration(
  pattern: string = "**/*.{ts,js,tsx,jsx}",
  exclude: string[] = [
    "node_modules/**",
    "dist/**",
    ".git/**",
    "test/**",
    "tests/**",
  ],
): Promise<FixReport> {
  const files = await glob(pattern, { ignore: exclude });

  const report: FixReport = {
    filesScanned: files.length,
    filesModified: 0,
    violationsFixed: 0,
    results: [],
  };

  for (const file of files) {
    try {
      const fileResults = fixFileIdGeneration(file);

      if (fileResults.length > 0) {
        report.filesModified++;
        report.violationsFixed += fileResults.length;
        report.results.push(...fileResults);
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return report;
}

/**
 * MCP Tool Handler
 */
export async function handleFixLocalIdGeneration(params: {
  pattern?: string;
  exclude?: string[];
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  report: FixReport;
  message: string;
}> {
  const { pattern = "**/*.{ts,js,tsx,jsx}", exclude, dryRun = false } = params;

  if (dryRun) {
    return {
      success: true,
      report: {
        filesScanned: 0,
        filesModified: 0,
        violationsFixed: 0,
        results: [],
      },
      message: "Dry run mode - no changes made",
    };
  }

  const report = await fixLocalIdGeneration(pattern, exclude);

  return {
    success: true,
    report,
    message: `Fixed ${report.violationsFixed} violations across ${report.filesModified} files`,
  };
}

/**
 * CLI Entry Point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const pattern = process.argv[2] || "**/*.{ts,js,tsx,jsx}";

  fixLocalIdGeneration(pattern)
    .then((report) => {
      console.log("\n🔧 ChittyID Local Generation Fixer\n");
      console.log(`Files scanned: ${report.filesScanned}`);
      console.log(`Files modified: ${report.filesModified}`);
      console.log(`Violations fixed: ${report.violationsFixed}\n`);

      if (report.results.length > 0) {
        console.log("📋 Changes made:\n");
        report.results.forEach((result, i) => {
          console.log(`${i + 1}. ${result.file}:${result.line}`);
          console.log(`   Severity: ${result.severity}`);
          console.log(`   Old: ${result.oldPattern}`);
          console.log(`   New: ${result.newPattern}\n`);
        });
      }

      console.log(
        "✅ All local ID generation replaced with ChittyID service calls",
      );
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}
