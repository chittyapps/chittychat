import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { D1Database, DurableObjectNamespace, R2Bucket, KVNamespace } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  WEBSOCKET_HANDLER: DurableObjectNamespace
  MCP_SERVER: DurableObjectNamespace
  STORAGE: R2Bucket
  CACHE: KVNamespace
  TASK_QUEUE: Queue
  CHITTYID_API_KEY: string
  REGISTRY_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS
app.use('/*', cors())

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    platform: 'cloudflare-workers',
    timestamp: new Date().toISOString()
  })
})

// Projects API
app.get('/api/projects', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM projects ORDER BY created_at DESC'
  ).all()
  return c.json(results)
})

app.post('/api/projects', async (c) => {
  const body = await c.req.json()
  const id = crypto.randomUUID()
  
  await c.env.DB.prepare(
    'INSERT INTO projects (id, name, description, is_global, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.description, body.isGlobal || false, new Date().toISOString()).run()
  
  // Queue background sync
  await c.env.TASK_QUEUE.send({
    type: 'sync_chittyid',
    projectId: id
  })
  
  return c.json({ id, ...body })
})

// Tasks API
app.get('/api/tasks', async (c) => {
  const projectId = c.req.query('projectId')
  let query = 'SELECT * FROM tasks'
  const params = []
  
  if (projectId) {
    query += ' WHERE project_id = ?'
    params.push(projectId)
  }
  
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

app.post('/api/tasks', async (c) => {
  const body = await c.req.json()
  const id = crypto.randomUUID()
  
  await c.env.DB.prepare(
    'INSERT INTO tasks (id, project_id, title, description, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    body.projectId,
    body.title,
    body.description,
    body.status || 'pending',
    body.priority || 'medium',
    new Date().toISOString()
  ).run()
  
  return c.json({ id, ...body })
})

// WebSocket endpoint for real-time updates
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 })
  }

  const id = c.env.WEBSOCKET_HANDLER.idFromName('global')
  const stub = c.env.WEBSOCKET_HANDLER.get(id)
  return stub.fetch(c.req.raw)
})

// MCP Protocol endpoint
app.all('/mcp', async (c) => {
  const id = c.env.MCP_SERVER.idFromName('global')
  const stub = c.env.MCP_SERVER.get(id)
  return stub.fetch(c.req.raw)
})

// Static site serving (SPA)
app.get('/*', async (c) => {
  const path = c.req.path === '/' ? '/index.html' : c.req.path
  const asset = await c.env.STORAGE.get(`client${path}`)
  
  if (asset) {
    const headers = new Headers()
    headers.set('content-type', getContentType(path))
    return new Response(asset.body, { headers })
  }
  
  // Fallback to index.html for SPA routing
  const index = await c.env.STORAGE.get('client/index.html')
  if (index) {
    return new Response(index.body, {
      headers: { 'content-type': 'text/html' }
    })
  }
  
  return c.text('Not Found', 404)
})

function getContentType(path: string): string {
  const ext = path.split('.').pop()
  const types: Record<string, string> = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    svg: 'image/svg+xml',
  }
  return types[ext || ''] || 'application/octet-stream'
}

// Durable Object for WebSocket handling
export class WebSocketHandler {
  state: DurableObjectState
  connections: Map<string, WebSocket> = new Map()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)
    
    const connectionId = crypto.randomUUID()
    this.connections.set(connectionId, server)
    
    server.accept()
    
    server.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data as string)
      
      // Broadcast to all connections
      for (const [id, ws] of this.connections) {
        if (id !== connectionId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message))
        }
      }
    })
    
    server.addEventListener('close', () => {
      this.connections.delete(connectionId)
    })
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }
}

// Durable Object for MCP Server
export class MCPServer {
  state: DurableObjectState
  agents: Map<string, any> = new Map()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const webSocketPair = new WebSocketPair()
      const [client, server] = Object.values(webSocketPair)
      
      server.accept()
      
      server.addEventListener('message', async (event) => {
        const message = JSON.parse(event.data as string)
        
        if (message.method === 'agent_register') {
          this.agents.set(message.params.sessionId, {
            name: message.params.name,
            capabilities: message.params.capabilities,
            connected: true
          })
          
          server.send(JSON.stringify({
            id: message.id,
            result: { success: true }
          }))
        }
        
        // Handle other MCP methods...
      })
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }
    
    // Handle regular HTTP MCP requests
    const body = await request.json()
    return Response.json({ 
      success: true, 
      method: body.method 
    })
  }
}

// Queue handler for background jobs
export async function queue(
  batch: MessageBatch,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const data = message.body as any
    
    if (data.type === 'sync_chittyid') {
      // Sync with ChittyID
      await fetch('https://api.chittyid.com/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CHITTYID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectId: data.projectId })
      })
    }
    
    message.ack()
  }
}

export default app