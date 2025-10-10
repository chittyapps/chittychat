/**
 * TodoOrchestrator Stub for Workers Build
 * Real implementation available in todo-orchestrator.js.node (Node.js only)
 */
export class TodoOrchestrator {
  constructor() {
    throw new Error('TodoOrchestrator requires Node.js runtime. Use cross-session-sync Node.js server.');
  }
}

export function handleTodoOrchestration() {
  return new Response(
    JSON.stringify({ error: 'Todo orchestration only available via Node.js server' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}
