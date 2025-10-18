#!/usr/bin/env node
// Lightweight check for Claude Code integration without touching real home dirs.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true }).catch(() => {});
}

async function main() {
  // Use a temp base under the repo to avoid monitoring real ~/.claude
  const base = path.join(__dirname, '..', '.tmp-claude');
  process.env.CLAUDE_BASE_PATH = base;

  const projects = path.join(base, 'projects');
  const todos = path.join(base, 'todos');
  const sessions = path.join(base, 'sessions');
  await ensureDir(projects);
  await ensureDir(todos);
  await ensureDir(sessions);

  // Seed minimal files
  const demoProj = path.join(projects, 'demo');
  await ensureDir(demoProj);
  await fs.writeFile(path.join(demoProj, 'README.md'), '# Demo Project\nThis is a test.');
  await fs.writeFile(
    path.join(todos, 'demo-todo.json'),
    JSON.stringify([{ content: 'Test task', completed: false }], null, 2),
  );

  const { ClaudeCodeIntegration } = await import('../src/claude-code-hooks/claude-integration.js');
  const integ = new ClaudeCodeIntegration();
  const started = await integ.start();
  console.log('Started:', started);

  // Short run then stop
  await new Promise((r) => setTimeout(r, 500));
  integ.stop();
  console.log('Stopped.');
}

await main().catch((e) => {
  console.error('Claude integration test failed:', e?.message || e);
  process.exit(1);
});

