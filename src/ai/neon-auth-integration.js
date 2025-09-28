/**
 * ChittyChat Neon Auth Integration
 * Implements JWT-based authentication with Row-Level Security (RLS)
 */

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export class NeonAuthIntegration {
  constructor(config) {
    this.db = neon(config.DATABASE_URL);
    this.jwtSecret = config.JWT_SECRET || 'chittychat-secret';
    this.neonAuthURL = config.NEON_AUTH_URL;
    this.projectId = config.NEON_PROJECT_ID;
  }

  /**
   * Setup authentication schema with RLS
   */
  async setupAuthSchema() {
    await this.db`
      -- Enable RLS globally
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Authentication schema
      CREATE SCHEMA IF NOT EXISTS auth;

      -- Users table with tenant isolation
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        tenant_id UUID,
        role TEXT DEFAULT 'user',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      );

      -- Tenant management
      CREATE TABLE IF NOT EXISTS auth.tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        tier TEXT DEFAULT 'starter',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- User sessions with JWT tracking
      CREATE TABLE IF NOT EXISTS auth.sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_accessed TIMESTAMP DEFAULT NOW()
      );

      -- Enable RLS on all auth tables
      ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE auth.tenants ENABLE ROW LEVEL SECURITY;
      ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

      -- RLS Policies for users
      CREATE POLICY "Users can view own data" ON auth.users
        FOR SELECT USING (auth.user_id() = id);

      CREATE POLICY "Users can update own data" ON auth.users
        FOR UPDATE USING (auth.user_id() = id);

      -- RLS Policies for tenants
      CREATE POLICY "Users can view own tenant" ON auth.tenants
        FOR SELECT USING (id = auth.tenant_id());

      -- RLS Policies for sessions
      CREATE POLICY "Users can view own sessions" ON auth.sessions
        FOR SELECT USING (user_id = auth.user_id());

      -- Auth helper functions
      CREATE OR REPLACE FUNCTION auth.user_id()
      RETURNS UUID AS $$
        SELECT COALESCE(
          current_setting('jwt.claims.sub', true)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        );
      $$ LANGUAGE SQL STABLE;

      CREATE OR REPLACE FUNCTION auth.tenant_id()
      RETURNS UUID AS $$
        SELECT COALESCE(
          current_setting('jwt.claims.tenant_id', true)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        );
      $$ LANGUAGE SQL STABLE;

      CREATE OR REPLACE FUNCTION auth.user_role()
      RETURNS TEXT AS $$
        SELECT COALESCE(
          current_setting('jwt.claims.role', true),
          'anonymous'
        );
      $$ LANGUAGE SQL STABLE;
    `;
  }

  /**
   * Setup RLS for ChittyChat application tables
   */
  async setupAppRLS() {
    await this.db`
      -- Enable RLS on all ChittyChat tables
      ALTER TABLE IF EXISTS chittychat_projects ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS chittychat_tasks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS ai_agents.registry ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS ai_agents.sessions ENABLE ROW LEVEL SECURITY;

      -- Project access policies
      DROP POLICY IF EXISTS "tenant_projects_policy" ON chittychat_projects;
      CREATE POLICY "tenant_projects_policy" ON chittychat_projects
        FOR ALL TO authenticated
        USING (
          CASE
            WHEN auth.user_role() = 'admin' THEN true
            ELSE tenant_id = auth.tenant_id()
          END
        );

      -- Task access policies
      DROP POLICY IF EXISTS "tenant_tasks_policy" ON chittychat_tasks;
      CREATE POLICY "tenant_tasks_policy" ON chittychat_tasks
        FOR ALL TO authenticated
        USING (
          project_id IN (
            SELECT id FROM chittychat_projects
            WHERE tenant_id = auth.tenant_id()
          )
        );

      -- AI Agent access policies
      DROP POLICY IF EXISTS "tenant_agents_policy" ON ai_agents.registry;
      CREATE POLICY "tenant_agents_policy" ON ai_agents.registry
        FOR ALL TO authenticated
        USING (
          CASE
            WHEN auth.user_role() = 'admin' THEN true
            ELSE capabilities->>'tenant_id' = auth.tenant_id()::text
          END
        );

      -- AI Session access policies
      DROP POLICY IF EXISTS "agent_sessions_policy" ON ai_agents.sessions;
      CREATE POLICY "agent_sessions_policy" ON ai_agents.sessions
        FOR ALL TO authenticated
        USING (
          agent_id IN (
            SELECT id FROM ai_agents.registry
            WHERE capabilities->>'tenant_id' = auth.tenant_id()::text
          )
        );

      -- Create database roles
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;

        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anonymous') THEN
          CREATE ROLE anonymous;
        END IF;
      END
      $$;

      -- Grant permissions to authenticated users
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT USAGE ON SCHEMA ai_agents TO authenticated;

      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT SELECT, UPDATE ON auth.users TO authenticated;
      GRANT SELECT ON auth.tenants TO authenticated;
      GRANT SELECT, INSERT, DELETE ON auth.sessions TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ai_agents TO authenticated;
    `;
  }

  /**
   * Register new user with tenant
   */
  async registerUser(email, password, tenantName) {
    const passwordHash = this.hashPassword(password);
    const tenantSlug = this.generateSlug(tenantName);

    // Create tenant first
    const [tenant] = await this.db`
      INSERT INTO auth.tenants (name, slug)
      VALUES (${tenantName}, ${tenantSlug})
      RETURNING *
    `;

    // Create user
    const [user] = await this.db`
      INSERT INTO auth.users (email, password_hash, tenant_id, role)
      VALUES (${email}, ${passwordHash}, ${tenant.id}, 'admin')
      RETURNING id, email, tenant_id, role, created_at
    `;

    // Generate JWT token
    const token = this.generateJWT(user);

    // Store session
    await this.createSession(user.id, token);

    return {
      user: {
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role
      },
      tenant,
      token
    };
  }

  /**
   * Authenticate user and return JWT
   */
  async authenticateUser(email, password) {
    const passwordHash = this.hashPassword(password);

    const [user] = await this.db`
      SELECT u.*, t.name as tenant_name, t.slug as tenant_slug
      FROM auth.users u
      JOIN auth.tenants t ON u.tenant_id = t.id
      WHERE u.email = ${email} AND u.password_hash = ${passwordHash}
    `;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.db`
      UPDATE auth.users
      SET last_login = NOW()
      WHERE id = ${user.id}
    `;

    // Generate JWT token
    const token = this.generateJWT(user);

    // Store session
    await this.createSession(user.id, token);

    return {
      user: {
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        tenant_slug: user.tenant_slug,
        role: user.role
      },
      token
    };
  }

  /**
   * Validate JWT token and return user context
   */
  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);

      // Check session exists and is not expired
      const [session] = await this.db`
        SELECT s.*, u.email, u.role, u.tenant_id
        FROM auth.sessions s
        JOIN auth.users u ON s.user_id = u.id
        WHERE s.token_hash = ${this.hashToken(token)}
          AND s.expires_at > NOW()
      `;

      if (!session) {
        throw new Error('Session expired or invalid');
      }

      // Update last accessed
      await this.db`
        UPDATE auth.sessions
        SET last_accessed = NOW()
        WHERE id = ${session.id}
      `;

      return {
        user_id: session.user_id,
        email: session.email,
        role: session.role,
        tenant_id: session.tenant_id,
        session_id: session.id
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Create database connection with RLS context
   */
  async createAuthenticatedConnection(token) {
    const userContext = await this.validateToken(token);

    // Return a database instance with RLS context set
    return {
      query: async (sql, params = []) => {
        // Set JWT claims for RLS
        await this.db`
          SELECT set_config('jwt.claims.sub', ${userContext.user_id}, true),
                 set_config('jwt.claims.role', ${userContext.role}, true),
                 set_config('jwt.claims.tenant_id', ${userContext.tenant_id}, true)
        `;

        // Execute the actual query
        return await this.db(sql, ...params);
      },
      userContext
    };
  }

  /**
   * Provision tenant-specific AI agent
   */
  async provisionTenantAgent(token, agentConfig) {
    const authDB = await this.createAuthenticatedConnection(token);

    // Agent will be automatically scoped to tenant via RLS
    const [agent] = await authDB.query`
      INSERT INTO ai_agents.registry (
        name, type, capabilities, status
      ) VALUES (
        ${agentConfig.name},
        ${agentConfig.type},
        ${JSON.stringify({
          ...agentConfig.capabilities,
          tenant_id: ${authDB.userContext.tenant_id}
        })},
        'active'
      ) RETURNING *
    `;

    return agent;
  }

  /**
   * Get tenant-scoped data
   */
  async getTenantData(token, dataType) {
    const authDB = await this.createAuthenticatedConnection(token);

    switch (dataType) {
      case 'projects':
        return await authDB.query`
          SELECT * FROM chittychat_projects
          ORDER BY updated_at DESC
        `;

      case 'agents':
        return await authDB.query`
          SELECT * FROM ai_agents.registry
          WHERE status = 'active'
          ORDER BY created_at DESC
        `;

      case 'sessions':
        return await authDB.query`
          SELECT s.*, a.name as agent_name, a.type as agent_type
          FROM ai_agents.sessions s
          JOIN ai_agents.registry a ON s.agent_id = a.id
          ORDER BY s.created_at DESC
          LIMIT 50
        `;

      default:
        throw new Error('Invalid data type');
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token) {
    const tokenHash = this.hashToken(token);

    await this.db`
      DELETE FROM auth.sessions
      WHERE token_hash = ${tokenHash}
    `;
  }

  /**
   * Helper: Generate JWT token
   */
  generateJWT(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      this.jwtSecret
    );
  }

  /**
   * Helper: Hash password
   */
  hashPassword(password) {
    return createHash('sha256').update(password + 'chittychat-salt').digest('hex');
  }

  /**
   * Helper: Hash token for storage
   */
  hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Helper: Generate tenant slug
   */
  generateSlug(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Helper: Create session record
   */
  async createSession(userId, token) {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return await this.db`
      INSERT INTO auth.sessions (user_id, token_hash, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
      RETURNING *
    `;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    const result = await this.db`
      DELETE FROM auth.sessions
      WHERE expires_at < NOW()
    `;

    return result.count;
  }

  /**
   * Get authentication health status
   */
  async getAuthHealth() {
    const [stats] = await this.db`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') as active_users,
        COUNT(DISTINCT tenant_id) as total_tenants
      FROM auth.users
    `;

    const [sessionStats] = await this.db`
      SELECT
        COUNT(*) as active_sessions,
        COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '1 hour') as recent_sessions
      FROM auth.sessions
      WHERE expires_at > NOW()
    `;

    return {
      users: stats,
      sessions: sessionStats,
      timestamp: new Date(),
      status: 'healthy'
    };
  }
}

export default NeonAuthIntegration;