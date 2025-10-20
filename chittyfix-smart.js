#!/usr/bin/env node

/**
 * ChittyFix Smart - Intelligent Issue Detection and Fixing Tool
 * Smart, context-aware fixes that actually help instead of breaking things
 * Only touches files you're working on, asks before making changes
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

class SmartChittyFix {
  constructor() {
    this.issues = [];
    this.changedFiles = [];
    this.config = this.loadConfig();

    // Colors for output
    this.colors = {
      reset: "\x1b[0m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      cyan: "\x1b[36m",
      bold: "\x1b[1m",
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  log(message, color = "reset") {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), ".chittyfix.json");
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch (e) {
        this.log("Warning: Invalid .chittyfix.json config file", "yellow");
      }
    }
    return {
      // Only fix files that have been changed recently
      onlyChangedFiles: true,
      // Ask before making changes
      interactive: true,
      // Directories to always skip
      skipPatterns: [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        ".wrangler",
        "coverage",
        ".nyc_output",
      ],
      // File extensions to check
      fileExtensions: [".js", ".ts", ".jsx", ".tsx"],
      // What types of issues to look for
      rules: {
        syntaxErrors: true, // Real syntax errors that break builds
        securityIssues: true, // Hardcoded secrets, SQL injection
        buildErrors: true, // Missing deps, config issues
        typeErrors: false, // Skip style issues for now
        performanceIssues: false, // Skip micro-optimizations
      },
    };
  }

  async askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(
        `${this.colors.yellow}${question}${this.colors.reset} `,
        (answer) => {
          resolve(answer.toLowerCase().startsWith("y"));
        },
      );
    });
  }

  getChangedFiles() {
    try {
      // Get files changed in the last commit + unstaged changes
      const staged = execSync("git diff --cached --name-only", {
        encoding: "utf8",
      }).trim();
      const unstaged = execSync("git diff --name-only", {
        encoding: "utf8",
      }).trim();
      const untracked = execSync("git ls-files --others --exclude-standard", {
        encoding: "utf8",
      }).trim();

      const allChanged = [
        ...staged.split("\n").filter((f) => f),
        ...unstaged.split("\n").filter((f) => f),
        ...untracked.split("\n").filter((f) => f),
      ];

      return [...new Set(allChanged)].filter((file) => {
        // Filter by extension and skip patterns
        const ext = path.extname(file);
        if (!this.config.fileExtensions.includes(ext)) return false;

        return !this.config.skipPatterns.some((pattern) =>
          file.includes(pattern),
        );
      });
    } catch (error) {
      this.log("Not in a git repository or no changes found", "yellow");
      return [];
    }
  }

  async diagnoseAndFix() {
    this.log("\n🧠 ChittyFix Smart - Intelligent Issue Detection", "bold");
    this.log("=================================================", "cyan");

    // Only look at files you've actually changed
    if (this.config.onlyChangedFiles) {
      this.changedFiles = this.getChangedFiles();

      if (this.changedFiles.length === 0) {
        this.log("\n✅ No changed files to analyze.", "green");
        this.rl.close();
        return;
      }

      this.log(
        `\n📁 Analyzing ${this.changedFiles.length} changed files:`,
        "blue",
      );
      this.changedFiles.forEach((file) => {
        this.log(`  • ${file}`, "cyan");
      });
    }

    // Run targeted diagnostics
    await this.detectRealIssues();

    if (this.issues.length === 0) {
      this.log("\n✅ No real issues found in your changes!", "green");
      this.rl.close();
      return;
    }

    // Show issues and ask for permission
    this.log(`\n⚠️  Found ${this.issues.length} real issues:`, "yellow");
    this.issues.forEach((issue, i) => {
      this.log(
        `${i + 1}. ${issue.file}:${issue.line || "?"} - ${issue.message}`,
        "red",
      );
      if (issue.detail) {
        this.log(`   ${issue.detail}`, "yellow");
      }
    });

    if (this.config.interactive) {
      const shouldFix = await this.askUser(
        `\nFix these ${this.issues.length} issues? (y/n): `,
      );
      if (!shouldFix) {
        this.log("No changes made.", "yellow");
        this.rl.close();
        return;
      }
    }

    // Apply fixes
    await this.applySmartFixes();
    this.rl.close();
  }

  async detectRealIssues() {
    const filesToCheck = this.config.onlyChangedFiles
      ? this.changedFiles
      : this.getAllRelevantFiles();

    for (const file of filesToCheck) {
      if (!fs.existsSync(file)) continue;

      try {
        const content = fs.readFileSync(file, "utf8");

        // Only check for real problems
        if (this.config.rules.syntaxErrors) {
          await this.detectSyntaxErrors(file, content);
        }

        if (this.config.rules.securityIssues) {
          await this.detectSecurityIssues(file, content);
        }

        if (this.config.rules.buildErrors) {
          await this.detectBuildErrors(file, content);
        }
      } catch (error) {
        this.issues.push({
          file,
          message: `Cannot read file: ${error.message}`,
          severity: "error",
          fixable: false,
        });
      }
    }
  }

  async detectSyntaxErrors(file, content) {
    try {
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed === ""
        ) {
          return;
        }

        // Check for real syntax issues

        // 1. Mismatched quotes (actual syntax error)
        const singleQuotes = (line.match(/'/g) || []).length;
        const doubleQuotes = (line.match(/"/g) || []).length;
        const backticks = (line.match(/`/g) || []).length;

        if (
          singleQuotes % 2 !== 0 ||
          doubleQuotes % 2 !== 0 ||
          backticks % 2 !== 0
        ) {
          this.issues.push({
            file,
            line: lineNum,
            message: "Unmatched quotes detected",
            detail: `Line: ${line.trim()}`,
            severity: "error",
            fixable: false, // Don't auto-fix quote issues
          });
        }

        // 2. Missing semicolon in specific contexts (real error)
        if (
          trimmed.match(/^(return|throw|break|continue)\s+.+[^;]$/) &&
          !trimmed.endsWith("{") &&
          !trimmed.endsWith("}")
        ) {
          this.issues.push({
            file,
            line: lineNum,
            message: "Missing semicolon after statement",
            detail: `Line: ${line.trim()}`,
            severity: "warning",
            fixable: true,
            fix: () => this.fixMissingSemicolon(file, lineNum),
          });
        }

        // 3. Obvious typos in keywords
        const typos = {
          fucntion: "function",
          retrun: "return",
          "consol.log": "console.log",
          lenght: "length",
        };

        Object.entries(typos).forEach(([typo, correct]) => {
          if (line.includes(typo)) {
            this.issues.push({
              file,
              line: lineNum,
              message: `Possible typo: '${typo}' should be '${correct}'`,
              detail: `Line: ${line.trim()}`,
              severity: "error",
              fixable: true,
              fix: () => this.fixTypo(file, lineNum, typo, correct),
            });
          }
        });

        // 4. Unused variables (simple heuristic)
        const unusedVarMatch = line.match(/^(\s*)(const|let|var)\s+(\w+)\s*=/);
        if (unusedVarMatch) {
          const varName = unusedVarMatch[3];
          // Only flag if variable is never used in the entire file
          const regex = new RegExp(`\\b${varName}\\b`, "g");
          const matches = content.match(regex) || [];

          // If it only appears once (the declaration), it's unused
          if (matches.length === 1) {
            this.issues.push({
              file,
              line: lineNum,
              message: `Unused variable: ${varName}`,
              detail: `Line: ${line.trim()}`,
              severity: "warning",
              fixable: true,
              fix: () => this.removeUnusedVariable(file, lineNum),
            });
          }
        }
      });
    } catch (error) {
      this.issues.push({
        file,
        message: `Error analyzing syntax: ${error.message}`,
        severity: "error",
        fixable: false,
      });
    }
  }

  async detectSecurityIssues(file, content) {
    // Look for hardcoded secrets (but be smarter about it)
    const secretPatterns = [
      { pattern: /sk-[a-zA-Z0-9]{20,}/g, type: "OpenAI API key" },
      { pattern: /AKIA[0-9A-Z]{16}/g, type: "AWS Access Key" },
      { pattern: /AIza[0-9A-Za-z\\-_]{35}/g, type: "Google API key" },
    ];

    secretPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip if it's in a comment or test file
        const lines = content.split("\n");
        const lineIndex =
          content.substring(0, match.index).split("\n").length - 1;
        const line = lines[lineIndex];

        if (
          line.includes("//") ||
          line.includes("*") ||
          file.includes("test")
        ) {
          continue;
        }

        this.issues.push({
          file,
          line: lineIndex + 1,
          message: `Hardcoded ${type} detected`,
          detail: `Found: ${match[0].substring(0, 10)}...`,
          severity: "high",
          fixable: true,
          fix: () => this.moveSecretToEnv(file, match[0]),
        });
      }
    });
  }

  async detectBuildErrors(file, content) {
    // Check for missing imports/requires
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      // Look for undefined variables that might be missing imports
      const match = line.match(/^(\s*)(const|let|var)\s+\w+\s*=\s*(\w+)(?!\()/);
      if (match) {
        const varName = match[3];
        // Check if this variable is defined elsewhere in the file
        if (
          !content.includes(`import`) &&
          !content.includes(`require`) &&
          ["React", "useState", "useEffect", "axios", "fetch"].includes(varName)
        ) {
          this.issues.push({
            file,
            line: index + 1,
            message: `Possible missing import for: ${varName}`,
            detail: `Line: ${line.trim()}`,
            severity: "warning",
            fixable: false, // Don't auto-fix imports
          });
        }
      }
    });
  }

  async applySmartFixes() {
    let fixed = 0;
    let failed = 0;

    for (const issue of this.issues) {
      if (!issue.fixable || !issue.fix) {
        this.log(`  ⚠️  Manual fix needed: ${issue.message}`, "yellow");
        continue;
      }

      try {
        this.log(`  🔧 Fixing: ${issue.message}`, "cyan");
        await issue.fix();
        fixed++;
        this.log(`  ✅ Fixed: ${issue.message}`, "green");
      } catch (error) {
        this.log(
          `  ❌ Failed to fix: ${issue.message} - ${error.message}`,
          "red",
        );
        failed++;
      }
    }

    this.log(`\n📊 Results:`, "bold");
    this.log(`  ✅ Fixed: ${fixed}`, "green");
    this.log(`  ❌ Failed: ${failed}`, failed > 0 ? "red" : "reset");
    this.log(`  ⚠️  Manual: ${this.issues.length - fixed - failed}`, "yellow");

    if (fixed > 0) {
      this.log(
        `\n💡 Recommendation: Test your changes to make sure everything still works`,
        "cyan",
      );
    }
  }

  getAllRelevantFiles() {
    const files = [];

    const scan = (dir) => {
      try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          if (
            this.config.skipPatterns.some((pattern) => item.includes(pattern))
          ) {
            continue;
          }

          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            scan(fullPath);
          } else if (
            this.config.fileExtensions.some((ext) => item.endsWith(ext))
          ) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scan(process.cwd());
    return files;
  }

  // Smart fix methods
  fixMissingSemicolon(filePath, lineNum) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines[lineNum - 1] = lines[lineNum - 1].trim() + ";";
    fs.writeFileSync(filePath, lines.join("\n"));
  }

  fixTypo(filePath, lineNum, typo, correct) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines[lineNum - 1] = lines[lineNum - 1].replace(typo, correct);
    fs.writeFileSync(filePath, lines.join("\n"));
  }

  removeUnusedVariable(filePath, lineNum) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.splice(lineNum - 1, 1);
    fs.writeFileSync(filePath, lines.join("\n"));
  }

  moveSecretToEnv(filePath, secret) {
    const content = fs.readFileSync(filePath, "utf8");
    const crypto = require("crypto");
    const envVar = `SECRET_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Replace in file
    const newContent = content.replace(secret, `process.env.${envVar}`);
    fs.writeFileSync(filePath, newContent);

    // Add to .env (create if doesn't exist)
    const envPath = ".env";
    const envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf8")
      : "";

    if (!envContent.includes(envVar)) {
      fs.writeFileSync(
        envPath,
        `${envContent}\n# Moved from ${filePath}\n${envVar}=${secret}\n`,
      );
    }

    this.log(`  📝 Added ${envVar} to .env file`, "blue");
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new SmartChittyFix();

  fixer
    .diagnoseAndFix()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("ChittyFix encountered an error:", error.message);
      process.exit(1);
    });
}

export default SmartChittyFix;
