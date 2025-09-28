/**
 * LangChain Agent Service Module
 * Consolidated from langchain.chitty.cc worker
 * Handles ReAct agents and RAG queries
 */

export async function handleLangChain(context) {
  const { request, ai, cache, vectors } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/langchain', '');

  // Health check
  if (path === '/health') {
    return new Response(JSON.stringify({
      service: 'langchain',
      status: 'healthy',
      features: ['react-agents', 'rag-queries', 'tool-calling', 'memory-management']
    }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  // Chat with agent endpoint
  if (path === '/chat' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { message, agent_type = 'react', use_rag = false, session_id } = body;

      if (!message) {
        return new Response(JSON.stringify({
          error: 'Message required'
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }

      // Get conversation history if session provided
      let conversationHistory = [];
      if (session_id) {
        const historyData = await cache.get(`conversation:${session_id}`, 'langchain');
        if (historyData) {
          conversationHistory = JSON.parse(historyData);
        }
      }

      // Perform RAG if requested
      let ragContext = '';
      if (use_rag) {
        try {
          // Get embeddings for the query
          const queryEmbedding = await ai.embeddings(message);

          // Search vector database (simplified)
          // In production, this would use the actual vectorize binding
          ragContext = '\\n[RAG Context: Retrieved relevant information from knowledge base]';
        } catch (ragError) {
          console.warn('RAG query failed:', ragError);
        }
      }

      // Prepare messages for AI
      const systemPrompt = `You are a helpful AI agent using the ${agent_type} pattern. You can use tools and reason through problems step by step.${ragContext}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      // Get AI response
      const response = await ai.chat(messages);

      // Update conversation history
      if (session_id) {
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: response.response }
        ].slice(-10); // Keep last 10 messages

        await cache.set(`conversation:${session_id}`, JSON.stringify(updatedHistory), 'langchain', 3600);
      }

      return new Response(JSON.stringify({
        response: response.response,
        agent_type,
        session_id: session_id || await this.generateChittyId(),
        used_rag: use_rag,
        timestamp: Date.now()
      }), {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Agent processing failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // Create agent endpoint
  if (path === '/agent' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { name, type = 'react', tools = [], instructions = '' } = body;

      if (!name) {
        return new Response(JSON.stringify({
          error: 'Agent name required'
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }

      const agentId = await this.generateChittyId();
      const agent = {
        id: agentId,
        name,
        type,
        tools,
        instructions,
        created: Date.now(),
        status: 'active'
      };

      await cache.set(`agent:${agentId}`, JSON.stringify(agent), 'langchain', 86400);

      return new Response(JSON.stringify({
        success: true,
        agent_id: agentId,
        agent
      }), {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Agent creation failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // Get agent endpoint
  if (path.startsWith('/agent/') && request.method === 'GET') {
    const agentId = path.replace('/agent/', '');

    try {
      const agentData = await cache.get(`agent:${agentId}`, 'langchain');

      if (!agentData) {
        return new Response(JSON.stringify({
          error: 'Agent not found'
        }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response(agentData, {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Agent retrieval failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // RAG query endpoint
  if (path === '/rag' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { query, limit = 5 } = body;

      if (!query) {
        return new Response(JSON.stringify({
          error: 'Query required'
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }

      // Get embeddings for the query
      const queryEmbedding = await ai.embeddings(query);

      // Perform vector search
      // Note: This is simplified - actual implementation would use vectors binding
      const results = [
        {
          content: "Sample RAG result for: " + query,
          score: 0.95,
          metadata: { source: "knowledge_base" }
        }
      ];

      return new Response(JSON.stringify({
        query,
        results,
        limit,
        timestamp: Date.now()
      }), {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'RAG query failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({
    error: 'Endpoint not found',
    available: ['/health', '/chat', '/agent', '/agent/{id}', '/rag']
  }), {
    status: 404,
    headers: { 'content-type': 'application/json' }
  });
}