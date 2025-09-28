/**
 * ChittyChat AI Coordinator with Neon AI Integration
 * Leverages pg_search, branching, and Neon Auth for advanced AI agent management
 */

import { neon } from '@neondatabase/serverless';
import { Pool } from '@neondatabase/serverless';
import { CloudflareAIService } from './cloudflare-ai-service.js';

export class NeonAICoordinator {
  constructor(config) {
    this.mainDB = neon(config.DATABASE_URL);
    this.reportingDB = neon(config.REPORTING_DATABASE_URL);
    this.neonAPI = config.NEON_API_KEY;
    this.projectId = config.NEON_PROJECT_ID;
    this.embeddingService = getEmbeddingService({
      OPENAI_API_KEY: config.OPENAI_API_KEY
    });
  }

  /**
   * Setup AI-enhanced database with pg_search extension
   */
  async setupAIDatabase() {
    await this.mainDB`
      -- Enable AI extensions
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE EXTENSION IF NOT EXISTS pg_search;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      -- AI Agent Management Schema
      CREATE SCHEMA IF NOT EXISTS ai_agents;

      -- Agent Registry with AI capabilities
      CREATE TABLE IF NOT EXISTS ai_agents.registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        branch_id TEXT,
        connection_string TEXT,
        capabilities JSONB DEFAULT '{}',
        embedding vector(1536),
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- AI Session Coordination
      CREATE TABLE IF NOT EXISTS ai_agents.sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES ai_agents.registry(id),
        session_data JSONB,
        context_embedding vector(1536),
        similarity_threshold DECIMAL DEFAULT 0.8,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Topic Analysis with Vector Search
      CREATE TABLE IF NOT EXISTS ai_agents.topic_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID,
        topic_text TEXT,
        topic_vector vector(1536),
        keywords TEXT[],
        confidence_score DECIMAL,
        related_sessions UUID[],
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Create vector similarity indexes
      CREATE INDEX IF NOT EXISTS idx_agent_embedding
        ON ai_agents.registry USING ivfflat (embedding vector_cosine_ops);

      CREATE INDEX IF NOT EXISTS idx_context_embedding
        ON ai_agents.sessions USING ivfflat (context_embedding vector_cosine_ops);

      CREATE INDEX IF NOT EXISTS idx_topic_vector
        ON ai_agents.topic_analysis USING ivfflat (topic_vector vector_cosine_ops);

      -- Full-text search indexes
      CREATE INDEX IF NOT EXISTS idx_agent_capabilities_gin
        ON ai_agents.registry USING gin(capabilities);

      CREATE INDEX IF NOT EXISTS idx_topic_keywords_gin
        ON ai_agents.topic_analysis USING gin(keywords);
    `;
  }

  /**
   * Create AI agent with dedicated database branch
   */
  async createAIAgent(agentConfig) {
    const { name, type, capabilities, initialContext } = agentConfig;

    // 1. Create database branch for agent isolation
    const branchResponse = await this.createAgentBranch(name, type);

    // 2. Generate capability embedding
    const capabilityEmbedding = await this.generateEmbedding(
      JSON.stringify(capabilities) + ' ' + type
    );

    // 3. Register agent in main database
    const [agent] = await this.mainDB`
      INSERT INTO ai_agents.registry (
        name, type, branch_id, connection_string,
        capabilities, embedding
      ) VALUES (
        ${name}, ${type}, ${branchResponse.id}, ${branchResponse.connection_string},
        ${JSON.stringify(capabilities)}, ${capabilityEmbedding}
      ) RETURNING *
    `;

    // 4. Setup agent-specific schema in branch
    await this.setupAgentSchema(branchResponse.connection_string, agent.id);

    // 5. Initialize context if provided
    if (initialContext) {
      await this.createAgentSession(agent.id, initialContext);
    }

    return {
      agentId: agent.id,
      branchId: branchResponse.id,
      connectionString: branchResponse.connection_string,
      capabilities: agent.capabilities,
      ready: true
    };
  }

  /**
   * Create database branch for agent isolation
   */
  async createAgentBranch(name, type) {
    const branchName = `agent_${type}_${Date.now()}`;

    const response = await fetch(`https://console.neon.tech/api/v2/projects/${this.projectId}/branches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.neonAPI}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: {
          name: branchName,
          parent_id: 'main'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create branch: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Setup agent-specific schema in branch database
   */
  async setupAgentSchema(connectionString, agentId) {
    const agentDB = neon(connectionString);

    await agentDB`
      -- Agent-specific tables in branch
      CREATE SCHEMA IF NOT EXISTS agent_workspace;

      -- Agent memory with vector search
      CREATE TABLE agent_workspace.memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID DEFAULT '${agentId}',
        memory_type TEXT,
        content TEXT,
        embedding vector(1536),
        importance_score DECIMAL DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Agent tasks and coordination
      CREATE TABLE agent_workspace.tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID DEFAULT '${agentId}',
        task_description TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      -- Agent learning and adaptation
      CREATE TABLE agent_workspace.learnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID DEFAULT '${agentId}',
        learning_type TEXT,
        pattern_data JSONB,
        confidence_score DECIMAL,
        reinforcement_count INTEGER DEFAULT 1,
        last_reinforced TIMESTAMP DEFAULT NOW()
      );

      -- Vector indexes for agent workspace
      CREATE INDEX idx_memory_embedding
        ON agent_workspace.memory USING ivfflat (embedding vector_cosine_ops);
    `;
  }

  /**
   * Find similar agents based on capabilities
   */
  async findSimilarAgents(capabilityQuery, limit = 5) {
    const queryEmbedding = await this.generateEmbedding(capabilityQuery);

    return await this.mainDB`
      SELECT
        id, name, type, capabilities,
        1 - (embedding <=> ${queryEmbedding}) as similarity_score
      FROM ai_agents.registry
      WHERE status = 'active'
      ORDER BY embedding <=> ${queryEmbedding}
      LIMIT ${limit}
    `;
  }

  /**
   * Create AI session with context understanding
   */
  async createAgentSession(agentId, contextData) {
    const contextEmbedding = await this.generateEmbedding(
      JSON.stringify(contextData)
    );

    const [session] = await this.mainDB`
      INSERT INTO ai_agents.sessions (
        agent_id, session_data, context_embedding
      ) VALUES (
        ${agentId}, ${JSON.stringify(contextData)}, ${contextEmbedding}
      ) RETURNING *
    `;

    // Find related sessions based on context similarity
    const relatedSessions = await this.findRelatedSessions(session.id, contextEmbedding);

    return { session, relatedSessions };
  }

  /**
   * Find related sessions using vector similarity
   */
  async findRelatedSessions(currentSessionId, contextEmbedding, threshold = 0.8) {
    return await this.mainDB`
      SELECT
        s.id, s.agent_id, s.session_data,
        1 - (s.context_embedding <=> ${contextEmbedding}) as similarity_score
      FROM ai_agents.sessions s
      WHERE s.id != ${currentSessionId}
        AND 1 - (s.context_embedding <=> ${contextEmbedding}) > ${threshold}
      ORDER BY s.context_embedding <=> ${contextEmbedding}
      LIMIT 10
    `;
  }

  /**
   * Enhanced topic sync with AI analysis
   */
  async performAITopicSync(sessionId, topicText) {
    // Generate topic embedding
    const topicEmbedding = await this.generateEmbedding(topicText);

    // Extract keywords using AI
    const keywords = await this.extractKeywords(topicText);

    // Find similar topics
    const similarTopics = await this.mainDB`
      SELECT
        id, session_id, topic_text, keywords,
        1 - (topic_vector <=> ${topicEmbedding}) as similarity_score
      FROM ai_agents.topic_analysis
      WHERE 1 - (topic_vector <=> ${topicEmbedding}) > 0.7
      ORDER BY topic_vector <=> ${topicEmbedding}
      LIMIT 5
    `;

    // Store topic analysis
    const [topicAnalysis] = await this.mainDB`
      INSERT INTO ai_agents.topic_analysis (
        session_id, topic_text, topic_vector, keywords,
        confidence_score, related_sessions
      ) VALUES (
        ${sessionId}, ${topicText}, ${topicEmbedding}, ${keywords},
        0.9, ${similarTopics.map(t => t.session_id)}
      ) RETURNING *
    `;

    return {
      topicAnalysis,
      similarTopics,
      coordinationSuggestions: await this.generateCoordinationSuggestions(similarTopics)
    };
  }

  /**
   * Cross-agent coordination based on AI analysis
   */
  async coordinateAgents(taskDescription, maxAgents = 3) {
    // Find best agents for the task
    const suitableAgents = await this.findSimilarAgents(taskDescription, maxAgents);

    // Create coordination branch for multi-agent work
    const coordBranch = await this.createCoordinationBranch(suitableAgents);

    // Setup shared workspace
    await this.setupSharedWorkspace(coordBranch.connection_string, suitableAgents);

    return {
      coordinationId: coordBranch.id,
      selectedAgents: suitableAgents,
      sharedWorkspace: coordBranch.connection_string,
      taskSummary: await this.generateTaskSummary(taskDescription, suitableAgents)
    };
  }

  /**
   * Create coordination branch for multi-agent collaboration
   */
  async createCoordinationBranch(agents) {
    const coordName = `coordination_${Date.now()}`;

    const response = await fetch(`https://console.neon.tech/api/v2/projects/${this.projectId}/branches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.neonAPI}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: {
          name: coordName,
          parent_id: 'main'
        }
      })
    });

    return await response.json();
  }

  /**
   * Setup shared workspace for agent coordination
   */
  async setupSharedWorkspace(connectionString, agents) {
    const coordDB = neon(connectionString);

    await coordDB`
      CREATE SCHEMA IF NOT EXISTS coordination;

      -- Shared task queue
      CREATE TABLE coordination.shared_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_description TEXT,
        assigned_agent_id UUID,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        dependencies UUID[],
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Inter-agent communication
      CREATE TABLE coordination.agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_agent_id UUID,
        to_agent_id UUID,
        message_type TEXT,
        content JSONB,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Coordination metrics
      CREATE TABLE coordination.performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID,
        metric_type TEXT,
        metric_value DECIMAL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `;

    // Grant access to all participating agents
    for (const agent of agents) {
      await coordDB`
        INSERT INTO coordination.shared_tasks (task_description, assigned_agent_id)
        VALUES ('Initialize coordination workspace', ${agent.id})
      `;
    }
  }

  /**
   * Generate embedding using real AI service
   */
  async generateEmbedding(text) {
    return await this.embeddingService.generateEmbedding(text);
  }

  /**
   * Extract keywords using AI analysis
   */
  async extractKeywords(text) {
    return await this.embeddingService.extractSemanticKeywords(text, 10);
  }

  /**
   * Generate coordination suggestions based on similar topics
   */
  async generateCoordinationSuggestions(similarTopics) {
    return similarTopics.map(topic => ({
      sessionId: topic.session_id,
      suggestion: `Consider coordinating with session ${topic.session_id} on "${topic.topic_text}"`,
      confidence: topic.similarity_score
    }));
  }

  /**
   * Generate task summary for multi-agent coordination
   */
  async generateTaskSummary(taskDescription, agents) {
    return {
      task: taskDescription,
      agentCount: agents.length,
      estimatedComplexity: 'medium',
      suggestedApproach: 'parallel_processing',
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        relevance: a.similarity_score
      }))
    };
  }

  /**
   * Cleanup unused agent branches
   */
  async cleanupInactiveAgents(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    const inactiveAgents = await this.mainDB`
      SELECT id, branch_id, name
      FROM ai_agents.registry
      WHERE updated_at < NOW() - INTERVAL '${maxAge} milliseconds'
        AND status = 'inactive'
    `;

    for (const agent of inactiveAgents) {
      // Delete branch via API
      await fetch(`https://console.neon.tech/api/v2/projects/${this.projectId}/branches/${agent.branch_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.neonAPI}`
        }
      });

      // Remove from registry
      await this.mainDB`
        DELETE FROM ai_agents.registry WHERE id = ${agent.id}
      `;
    }

    return inactiveAgents.length;
  }

  /**
   * Get AI coordinator health and metrics
   */
  async getCoordinatorHealth() {
    const [stats] = await this.mainDB`
      SELECT
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE status = 'active') as active_agents,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_agents
      FROM ai_agents.registry
    `;

    const [sessionStats] = await this.mainDB`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(DISTINCT agent_id) as agents_with_sessions
      FROM ai_agents.sessions
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    return {
      agents: stats,
      sessions: sessionStats,
      timestamp: new Date(),
      status: 'healthy'
    };
  }
}

export default NeonAICoordinator;