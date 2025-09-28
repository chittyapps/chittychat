/**
 * GitHub Webhook Handler for Todo Sync
 * Processes todo commits from chittychat-data repo
 * Syncs to Neon, vectorizes for search, triggers AI processing
 */

export class GitHubTodoWebhook {
  constructor(env) {
    this.env = env;
    this.neonUrl = env.NEON_DATABASE_URL;
    this.vectorizeIndex = env.vectorize?.index;
    this.ai = env.AI;
  }

  async handleWebhook(request) {
    const signature = request.headers.get('X-Hub-Signature-256');
    const event = request.headers.get('X-GitHub-Event');

    // Verify webhook signature
    if (!await this.verifySignature(request, signature)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await request.json();

    switch (event) {
      case 'push':
        return await this.handlePush(payload);
      case 'pull_request':
        return await this.handlePR(payload);
      case 'issues':
        return await this.handleIssue(payload);
      default:
        return new Response('Event not handled', { status: 200 });
    }
  }

  async handlePush(payload) {
    // Check if push contains todo files
    const todoFiles = payload.commits
      .flatMap(c => [...c.added, ...c.modified])
      .filter(f => f.startsWith('todos/'));

    if (todoFiles.length === 0) {
      return new Response('No todo files', { status: 200 });
    }

    // Process each todo file
    for (const file of todoFiles) {
      const content = await this.fetchFileContent(payload.repository, file);
      const todo = JSON.parse(content);

      // Store in Neon
      await this.syncToNeon(todo);

      // Vectorize for search
      if (this.vectorizeIndex) {
        await this.vectorizeTodo(todo);
      }

      // Trigger AI analysis
      if (this.ai) {
        await this.analyzeWithAI(todo);
      }
    }

    // Update ChittyChat overlay
    await this.updateChittyChatOverlay(todoFiles);

    return new Response('Todos synced', { status: 200 });
  }

  async handlePR(payload) {
    // Handle todo merge conflicts
    if (payload.action === 'opened' || payload.action === 'synchronize') {
      const conflicts = await this.detectTodoConflicts(payload.pull_request);

      if (conflicts.length > 0) {
        await this.commentOnPR(payload.pull_request, conflicts);
        await this.suggestResolution(conflicts);
      }
    }

    return new Response('PR processed', { status: 200 });
  }

  async syncToNeon(todo) {
    const { Client } = await import('@neondatabase/serverless');
    const client = new Client(this.neonUrl);

    await client.connect();

    // Upsert todo with Git-like versioning
    await client.query(`
      INSERT INTO claude_todos (
        id, session_id, content, status,
        git_branch, git_commit, chitty_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        git_commit = EXCLUDED.git_commit,
        updated_at = NOW()
    `, [
      todo.id,
      todo.session_id,
      JSON.stringify(todo.content),
      todo.status,
      todo.git_branch || 'main',
      todo.git_commit,
      todo.chitty_id || `CT-TODO-${Date.now()}`,
      new Date(todo.created_at),
      new Date()
    ]);

    await client.end();
  }

  async vectorizeTodo(todo) {
    // Create embedding for semantic search
    const text = `${todo.content.map(t => t.content).join(' ')}`;
    const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });

    // Store in Vectorize
    await this.vectorizeIndex.upsert([{
      id: todo.id,
      values: embedding.data[0],
      metadata: {
        session_id: todo.session_id,
        status: todo.status,
        chitty_id: todo.chitty_id
      }
    }]);
  }

  async analyzeWithAI(todo) {
    // Use AI to analyze todo patterns and suggest optimizations
    const prompt = `Analyze this todo list for patterns and suggest optimizations:
    ${JSON.stringify(todo.content, null, 2)}`;

    const analysis = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
      prompt,
      max_tokens: 500
    });

    // Store analysis
    await this.env.SYNC_CACHE.put(
      `analysis:${todo.id}`,
      JSON.stringify(analysis)
    );
  }

  async detectTodoConflicts(pr) {
    // Git-like conflict detection for todos
    const base = await this.fetchBranchTodos(pr.base.ref);
    const head = await this.fetchBranchTodos(pr.head.ref);

    const conflicts = [];
    for (const [id, baseTodo] of base.entries()) {
      const headTodo = head.get(id);
      if (headTodo && baseTodo.content !== headTodo.content) {
        conflicts.push({
          id,
          base: baseTodo,
          head: headTodo,
          type: 'content_conflict'
        });
      }
    }

    return conflicts;
  }

  async suggestResolution(conflicts) {
    // AI-powered conflict resolution
    for (const conflict of conflicts) {
      const suggestion = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: `Suggest how to merge these conflicting todos:
        Base: ${JSON.stringify(conflict.base)}
        Head: ${JSON.stringify(conflict.head)}`,
        max_tokens: 200
      });

      conflict.suggestion = suggestion;
    }

    return conflicts;
  }

  async verifySignature(request, signature) {
    // Verify GitHub webhook signature
    const secret = this.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return false;

    const body = await request.text();
    const hmac = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signed = await crypto.subtle.sign(
      'HMAC',
      hmac,
      new TextEncoder().encode(body)
    );

    const expected = `sha256=${Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;

    return signature === expected;
  }
}

// Export for CloudFlare Worker
export default {
  async fetch(request, env) {
    const webhook = new GitHubTodoWebhook(env);
    return webhook.handleWebhook(request);
  }
};