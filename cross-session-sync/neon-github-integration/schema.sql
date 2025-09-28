-- Cross-Session Sync Database Schema for Neon
-- Uses Neon's GitHub integration for automatic branch databases

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Session registry table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_name VARCHAR(255) NOT NULL,
    github_branch VARCHAR(255),
    github_pr_number INTEGER,
    github_workflow_run_id BIGINT,
    notion_page_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    tasks TEXT[] DEFAULT '{}',
    locks TEXT[] DEFAULT '{}'
);

-- Task coordination table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    dependencies UUID[] DEFAULT '{}',
    notion_task_id VARCHAR(255),
    github_issue_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- State synchronization table
CREATE TABLE session_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    state_type VARCHAR(100) NOT NULL,
    state_data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    parent_version UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, state_type, version)
);

-- Lock management table
CREATE TABLE resource_locks (
    resource_name VARCHAR(255) PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    lock_type VARCHAR(50) DEFAULT 'exclusive'
);

-- Event log for coordination
CREATE TABLE sync_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notion sync tracking
CREATE TABLE notion_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notion_page_id VARCHAR(255) UNIQUE NOT NULL,
    notion_database_id VARCHAR(255),
    sync_type VARCHAR(50),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50),
    metadata JSONB DEFAULT '{}'
);

-- GitHub Action runs tracking
CREATE TABLE github_action_runs (
    id BIGINT PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255),
    branch VARCHAR(255),
    status VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    conclusion VARCHAR(50),
    html_url TEXT
);

-- Create indexes for performance
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_heartbeat ON sessions(last_heartbeat);
CREATE INDEX idx_tasks_session ON tasks(session_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_states_session ON session_states(session_id);
CREATE INDEX idx_locks_expires ON resource_locks(expires_at);
CREATE INDEX idx_events_session ON sync_events(session_id);
CREATE INDEX idx_events_created ON sync_events(created_at);

-- Functions for session management
CREATE OR REPLACE FUNCTION update_session_heartbeat(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sessions
    SET last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to claim a task atomically
CREATE OR REPLACE FUNCTION claim_task(p_task_id UUID, p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_claimed BOOLEAN;
BEGIN
    UPDATE tasks
    SET session_id = p_session_id,
        claimed_at = CURRENT_TIMESTAMP,
        status = 'in_progress'
    WHERE id = p_task_id
        AND session_id IS NULL
        AND status = 'pending';

    GET DIAGNOSTICS v_claimed = ROW_COUNT > 0;
    RETURN v_claimed;
END;
$$ LANGUAGE plpgsql;

-- Function to acquire a lock with timeout
CREATE OR REPLACE FUNCTION acquire_lock(
    p_resource VARCHAR(255),
    p_session_id UUID,
    p_timeout_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    v_acquired BOOLEAN;
BEGIN
    -- Try to insert or update if expired
    INSERT INTO resource_locks (resource_name, session_id, expires_at)
    VALUES (p_resource, p_session_id, CURRENT_TIMESTAMP + (p_timeout_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (resource_name) DO UPDATE
    SET session_id = p_session_id,
        acquired_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + (p_timeout_seconds || ' seconds')::INTERVAL
    WHERE resource_locks.expires_at < CURRENT_TIMESTAMP
        OR resource_locks.session_id = p_session_id;

    GET DIAGNOSTICS v_acquired = ROW_COUNT > 0;
    RETURN v_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to log sync events
CREATE OR REPLACE FUNCTION log_sync_event(
    p_event_type VARCHAR(100),
    p_session_id UUID,
    p_payload JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO sync_events (event_type, session_id, payload)
    VALUES (p_event_type, p_session_id, p_payload)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup stale sessions (run via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS VOID AS $$
BEGIN
    -- Mark sessions as stale after 5 minutes of no heartbeat
    UPDATE sessions
    SET status = 'stale'
    WHERE status = 'active'
        AND last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '5 minutes';

    -- Release locks from stale sessions
    DELETE FROM resource_locks
    WHERE session_id IN (
        SELECT id FROM sessions WHERE status = 'stale'
    );

    -- Unclaim tasks from stale sessions
    UPDATE tasks
    SET session_id = NULL,
        status = 'pending',
        claimed_at = NULL
    WHERE session_id IN (
        SELECT id FROM sessions WHERE status = 'stale'
    );

    -- Delete very old stale sessions
    DELETE FROM sessions
    WHERE status = 'stale'
        AND last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job with pg_cron
SELECT cron.schedule('cleanup-stale-sessions', '*/5 * * * *', 'SELECT cleanup_stale_sessions();');