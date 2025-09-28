/**
 * Programmable Hooks for AI Native Functions
 *
 * This system attaches to Claude/GPT's native functions and makes them
 * programmable by intercepting, extending, and chaining their operations.
 */

import { EventEmitter } from 'events';

// Hook Types that attach to AI native functions
type HookType =
  | 'before_read'
  | 'after_read'
  | 'before_write'
  | 'after_write'
  | 'before_bash'
  | 'after_bash'
  | 'before_search'
  | 'after_search'
  | 'before_task'
  | 'after_task'
  | 'before_todo'
  | 'after_todo'
  | 'before_git'
  | 'after_git'
  | 'before_api_call'
  | 'after_api_call';

interface HookContext {
  sessionId: string;
  timestamp: number;
  function: string;
  args: any[];
  result?: any;
  error?: Error;
  metadata: Record<string, any>;
}

interface HookHandler {
  id: string;
  type: HookType;
  priority: number;
  condition?: (context: HookContext) => boolean;
  handler: (context: HookContext) => Promise<HookContext | void>;
}

/**
 * Core hook system that attaches to AI functions
 */
export class AIFunctionHooks extends EventEmitter {
  private hooks: Map<HookType, HookHandler[]> = new Map();
  private interceptors: Map<string, Function> = new Map();
  private sessionId: string;
  private coordinationFile: string = '.ai-coordination/hooks.json';

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.loadHooks();
    this.attachToAIFunctions();
  }

  /**
   * Register a programmable hook
   */
  registerHook(hook: HookHandler): void {
    const hooks = this.hooks.get(hook.type) || [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hook.type, hooks);
    this.persistHooks();
  }

  /**
   * Attach interceptors to AI native functions
   */
  private attachToAIFunctions(): void {
    // Intercept file operations
    this.interceptFunction('fs.readFile', async (original: Function, ...args: any[]) => {
      const context = await this.runHooks('before_read', { args });
      const result = await original(...(context?.args || args));
      await this.runHooks('after_read', { args, result });
      return result;
    });

    this.interceptFunction('fs.writeFile', async (original: Function, ...args: any[]) => {
      const context = await this.runHooks('before_write', { args });
      const result = await original(...(context?.args || args));
      await this.runHooks('after_write', { args, result });
      this.notifyCoordination('file_written', { path: args[0], content: args[1] });
      return result;
    });

    // Intercept bash commands
    this.interceptFunction('exec', async (original: Function, ...args: any[]) => {
      const context = await this.runHooks('before_bash', { args });
      const result = await original(...(context?.args || args));
      await this.runHooks('after_bash', { args, result });
      this.notifyCoordination('command_executed', { command: args[0], result });
      return result;
    });

    // Intercept git operations
    this.interceptGitCommands();

    // Intercept TODO operations
    this.interceptTodoOperations();
  }

  /**
   * Programmable git command interceptor
   */
  private interceptGitCommands(): void {
    const gitCommands = ['commit', 'push', 'pull', 'merge', 'checkout'];

    gitCommands.forEach(cmd => {
      this.registerHook({
        id: `git-${cmd}-coordinator`,
        type: 'before_bash',
        priority: 10,
        condition: (ctx) => ctx.args[0]?.includes(`git ${cmd}`),
        handler: async (ctx) => {
          await this.runHooks('before_git', {
            ...ctx,
            metadata: { gitCommand: cmd }
          });

          // Auto-add coordination tag to commits
          if (cmd === 'commit' && ctx.args[0]) {
            ctx.args[0] = ctx.args[0].replace(
              'git commit -m "',
              `git commit -m "[SESSION-${this.sessionId}] `
            );
          }

          // Create worktree for session isolation
          if (cmd === 'checkout' && ctx.args[0]?.includes('-b')) {
            const branch = ctx.args[0].match(/-b\s+(\S+)/)?.[1];
            if (branch && !branch.startsWith('session-')) {
              ctx.args[0] = ctx.args[0].replace(branch, `session-${this.sessionId}-${branch}`);
            }
          }

          return ctx;
        }
      });
    });
  }

  /**
   * Programmable TODO list interceptor
   */
  private interceptTodoOperations(): void {
    this.registerHook({
      id: 'todo-sync',
      type: 'after_todo',
      priority: 5,
      handler: async (ctx) => {
        // Sync TODO updates to coordination file
        await this.syncTodoToCoordination(ctx.result);

        // Notify other sessions
        this.emit('todo_updated', {
          sessionId: this.sessionId,
          todos: ctx.result
        });

        // Check for task conflicts
        await this.checkTaskConflicts(ctx.result);
      }
    });
  }

  /**
   * Chain multiple AI operations programmatically
   */
  async chainOperations(operations: Array<{
    function: string;
    args: any[];
    transform?: (result: any) => any;
  }>): Promise<any[]> {
    const results: any[] = [];

    for (const op of operations) {
      const prevResult = results[results.length - 1];
      const args = op.transform && prevResult
        ? op.transform(prevResult)
        : op.args;

      const result = await this.executeAIFunction(op.function, args);
      results.push(result);
    }

    return results;
  }

  /**
   * Create programmable workflows
   */
  async createWorkflow(name: string, steps: Array<{
    condition?: () => boolean;
    action: () => Promise<any>;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  }>): Promise<void> {
    this.registerHook({
      id: `workflow-${name}`,
      type: 'after_bash',
      priority: 20,
      handler: async (ctx) => {
        for (const step of steps) {
          if (step.condition && !step.condition()) {
            continue;
          }

          try {
            const result = await step.action();
            step.onSuccess?.(result);
          } catch (error) {
            step.onError?.(error as Error);
          }
        }
      }
    });
  }

  /**
   * Coordination-aware file locking
   */
  async acquireFileLock(filepath: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.registerHook({
        id: `file-lock-${filepath}`,
        type: 'before_write',
        priority: 1,
        condition: (ctx) => ctx.args[0] === filepath,
        handler: async (ctx) => {
          const lockFile = `${filepath}.lock`;
          const lockContent = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            operation: 'write'
          };

          try {
            // Try to create lock file atomically
            await this.executeAIFunction('fs.writeFile', [
              lockFile,
              JSON.stringify(lockContent),
              { flag: 'wx' }
            ]);
            resolve(true);
          } catch (error) {
            // Lock already exists
            const existingLock = await this.executeAIFunction('fs.readFile', [lockFile]);
            const lock = JSON.parse(existingLock);

            // Check if lock is stale (>30 seconds old)
            if (Date.now() - lock.timestamp > 30000) {
              await this.executeAIFunction('fs.unlink', [lockFile]);
              return this.acquireFileLock(filepath);
            }

            resolve(false);
          }
        }
      });
    });
  }

  /**
   * Event-driven coordination between sessions
   */
  private async notifyCoordination(event: string, data: any): Promise<void> {
    const notification = {
      sessionId: this.sessionId,
      event,
      data,
      timestamp: Date.now()
    };

    // Append to event log
    const eventLog = '.ai-coordination/events.jsonl';
    await this.executeAIFunction('fs.appendFile', [
      eventLog,
      JSON.stringify(notification) + '\n'
    ]);

    // Trigger webhooks if configured
    if (process.env.COORDINATION_WEBHOOK) {
      await fetch(process.env.COORDINATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
    }
  }

  /**
   * Smart task distribution based on AI capabilities
   */
  async distributeTask(task: {
    id: string;
    type: 'code' | 'research' | 'writing' | 'analysis';
    complexity: number;
    requirements: string[];
  }): Promise<string> {
    // Check session capabilities
    const sessions = await this.getActiveSessions();

    const scores = sessions.map(session => {
      let score = 0;

      // Claude is better at code and analysis
      if (session.metadata?.model === 'claude' && ['code', 'analysis'].includes(task.type)) {
        score += 10;
      }

      // GPT is better at creative writing
      if (session.metadata?.model === 'gpt' && task.type === 'writing') {
        score += 10;
      }

      // Consider current load
      score -= session.tasks?.length || 0;

      // Consider session uptime (prefer stable sessions)
      const uptime = Date.now() - session.startTime;
      score += Math.min(uptime / 60000, 10); // Max 10 points for 10+ minutes uptime

      return { session, score };
    });

    // Assign to best session
    scores.sort((a, b) => b.score - a.score);
    const bestSession = scores[0].session;

    await this.assignTaskToSession(task.id, bestSession.id);
    return bestSession.id;
  }

  /**
   * Create a programmable middleware pipeline
   */
  createMiddleware(): {
    use: (fn: (ctx: HookContext, next: () => Promise<void>) => Promise<void>) => void;
    execute: (ctx: HookContext) => Promise<void>;
  } {
    const middleware: Array<(ctx: HookContext, next: () => Promise<void>) => Promise<void>> = [];

    return {
      use: (fn) => middleware.push(fn),
      execute: async (ctx) => {
        let index = 0;

        const next = async (): Promise<void> => {
          if (index < middleware.length) {
            const fn = middleware[index++];
            await fn(ctx, next);
          }
        };

        await next();
      }
    };
  }

  /**
   * Attach custom behaviors to specific file patterns
   */
  watchPattern(pattern: RegExp, handler: (filepath: string, content: any) => void): void {
    this.registerHook({
      id: `watch-${pattern.source}`,
      type: 'after_write',
      priority: 15,
      condition: (ctx) => pattern.test(ctx.args[0]),
      handler: async (ctx) => {
        handler(ctx.args[0], ctx.args[1]);
      }
    });
  }

  /**
   * Create AI function pipelines
   */
  pipeline(...functions: Array<{
    name: string;
    transform?: (input: any) => any;
  }>): (input: any) => Promise<any> {
    return async (input: any) => {
      let result = input;

      for (const fn of functions) {
        if (fn.transform) {
          result = fn.transform(result);
        }

        result = await this.executeAIFunction(fn.name, [result]);
      }

      return result;
    };
  }

  /**
   * Helper methods
   */
  private async runHooks(type: HookType, context: Partial<HookContext>): Promise<HookContext | void> {
    const hooks = this.hooks.get(type) || [];
    let ctx: HookContext = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      function: type,
      args: [],
      metadata: {},
      ...context
    };

    for (const hook of hooks) {
      if (!hook.condition || hook.condition(ctx)) {
        const result = await hook.handler(ctx);
        if (result) {
          ctx = result;
        }
      }
    }

    return ctx;
  }

  private interceptFunction(name: string, interceptor: Function): void {
    this.interceptors.set(name, interceptor);
  }

  private async executeAIFunction(name: string, args: any[]): Promise<any> {
    // This would connect to the actual AI function execution
    // For now, it's a placeholder that would be implemented
    // based on the specific AI platform (Claude, GPT, etc.)
    console.log(`Executing AI function: ${name}`, args);
    return null;
  }

  private async loadHooks(): Promise<void> {
    // Load hooks from coordination file
    try {
      const data = await this.executeAIFunction('fs.readFile', [this.coordinationFile]);
      const hooks = JSON.parse(data);
      hooks.forEach((hook: HookHandler) => this.registerHook(hook));
    } catch (error) {
      // No hooks file yet
    }
  }

  private async persistHooks(): Promise<void> {
    const allHooks: HookHandler[] = [];
    this.hooks.forEach(hooks => allHooks.push(...hooks));

    await this.executeAIFunction('fs.writeFile', [
      this.coordinationFile,
      JSON.stringify(allHooks, null, 2)
    ]);
  }

  private async syncTodoToCoordination(todos: any[]): Promise<void> {
    await this.executeAIFunction('fs.writeFile', [
      `.ai-coordination/todos-${this.sessionId}.json`,
      JSON.stringify(todos, null, 2)
    ]);
  }

  private async checkTaskConflicts(todos: any[]): Promise<void> {
    const otherTodos = await this.getOtherSessionTodos();
    const conflicts = todos.filter(todo =>
      otherTodos.some(other =>
        other.id === todo.id && other.status === 'in_progress'
      )
    );

    if (conflicts.length > 0) {
      this.emit('task_conflict', conflicts);
    }
  }

  private async getActiveSessions(): Promise<any[]> {
    // Implementation would read session files
    return [];
  }

  private async assignTaskToSession(taskId: string, sessionId: string): Promise<void> {
    // Implementation would update task assignment
  }

  private async getOtherSessionTodos(): Promise<any[]> {
    // Implementation would read other session TODO files
    return [];
  }
}

// Export factory function for easy setup
export function attachHooksToAI(sessionId: string): AIFunctionHooks {
  return new AIFunctionHooks(sessionId);
}