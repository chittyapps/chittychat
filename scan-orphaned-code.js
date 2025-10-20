#!/usr/bin/env node
/**
 * Orphaned Code Scanner
 * Finds tools/files not wired into ChittyMCP
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const TOOL_DIRS = ["src/tools", "src/registry"];
const INDEX_FILE = "src/index.js";

function findToolFiles(dir, files = []) {
  try {
    for (const file of readdirSync(dir)) {
      const path = join(dir, file);
      if (statSync(path).isDirectory()) {
        findToolFiles(path, files);
      } else if (file.endsWith(".js") || file.endsWith(".ts")) {
        files.push(path);
      }
    }
  } catch (e) {}
  return files;
}

function extractExports(content) {
  const exports = [];
  const exportRegex = /export\s+(?:const|class|function)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content))) {
    exports.push(match[1]);
  }
  return exports;
}

function isImported(indexContent, filePath, exportName) {
  const importPattern = new RegExp(
    `import.*${exportName}.*from.*${filePath.replace(/\\/g, "/")}`,
  );
  return importPattern.test(indexContent);
}

// Scan
const indexContent = readFileSync(INDEX_FILE, "utf-8");
const orphaned = [];

for (const dir of TOOL_DIRS) {
  const toolFiles = findToolFiles(dir);

  for (const file of toolFiles) {
    const content = readFileSync(file, "utf-8");
    const exports = extractExports(content);

    for (const exp of exports) {
      if (!isImported(indexContent, file, exp)) {
        orphaned.push({ file, export: exp, content });
      }
    }
  }
}

// Report
if (orphaned.length === 0) {
  console.log("✅ No orphaned code found");
  process.exit(0);
}

console.log(`🔍 Found ${orphaned.length} orphaned exports:\n`);
orphaned.forEach(({ file, export: exp }) => {
  console.log(`  ${file}:${exp}`);
});

// Generate wiring
console.log("\n📝 Auto-generated import statements:\n");
const imports = [...new Set(orphaned.map((o) => o.file))];
imports.forEach((file) => {
  const exps = orphaned.filter((o) => o.file === file).map((o) => o.export);
  console.log(
    `import { ${exps.join(", ")} } from './${file.replace("src/", "")}';`,
  );
});
