-- ============================================================================
-- AGENT PLATFORM SCHEMA MIGRATION
-- Multi-agent intelligence platform: registry, tasks, runs, memory, RAG, skills
-- Created: 2026-07-07
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector for knowledge embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid() fallback

-- ============================================================================
-- 1. AGENT REGISTRY — agent definitions and configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,
    model           TEXT DEFAULT 'llama-3.3-70b-versatile',
    temperature     REAL DEFAULT 0.4,
    max_tokens      INT DEFAULT 2000,
    tools           TEXT[] DEFAULT '{}',
    memory_read     TEXT[] DEFAULT '{profile}',
    memory_write    TEXT[] DEFAULT '{}',
    rag_domains     TEXT[] DEFAULT '{}',
    risk_level      TEXT DEFAULT 'low'
                        CHECK (risk_level IN ('low', 'medium', 'high')),
    requires_approval BOOLEAN DEFAULT false,
    cost_ceiling_usd  REAL DEFAULT 0.10,
    system_prompt   TEXT,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. AGENT TASKS — goal/task threading
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    goal        TEXT,
    status      TEXT DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'waiting', 'done', 'failed')),
    agent_slug  TEXT REFERENCES agent_registry(slug),
    artifacts   JSONB DEFAULT '[]'::jsonb,
    context     JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. AGENT RUNS — immutable audit log for every agent execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    agent_slug      TEXT NOT NULL,
    parent_run_id   UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    goal            TEXT,
    model           TEXT NOT NULL,
    temperature     REAL,
    prompt_hash     TEXT,                          -- SHA-256 of system prompt
    tools_used      TEXT[] DEFAULT '{}',
    tool_calls      JSONB DEFAULT '[]'::jsonb,
    memory_reads    JSONB DEFAULT '[]'::jsonb,
    memory_writes   JSONB DEFAULT '[]'::jsonb,
    scratchpad      JSONB DEFAULT '{}'::jsonb,     -- PRIVATE reasoning, never exposed
    output          TEXT,
    output_format   TEXT DEFAULT 'markdown',
    tokens_in       INT,
    tokens_out      INT,
    cost_usd        REAL,
    latency_ms      INT,
    status          TEXT DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
    error           TEXT,
    quality_score   REAL,
    anomaly_flags   TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

-- ============================================================================
-- 4. PROFILE MEMORY — structured key-value user/profile facts
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general',
    source      TEXT DEFAULT 'manual',
    confidence  REAL DEFAULT 1.0,
    verified    BOOLEAN DEFAULT true,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (key, category)
);

-- ============================================================================
-- 5. KNOWLEDGE MEMORY — RAG-indexed knowledge facts with embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_memory (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content      TEXT NOT NULL,
    embedding    vector(768),
    domain       TEXT NOT NULL,
    source_type  TEXT NOT NULL
                     CHECK (source_type IN ('document', 'email', 'web', 'agent', 'manual')),
    source_id    TEXT,
    source_url   TEXT,
    confidence   REAL DEFAULT 1.0,
    verified     BOOLEAN DEFAULT false,
    created_by   TEXT,                             -- agent slug
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. DOCUMENTS — uploaded documents for RAG ingestion
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    filename      TEXT,
    mime_type     TEXT,
    storage_path  TEXT,                             -- Supabase Storage path
    domain        TEXT NOT NULL,
    tags          TEXT[] DEFAULT '{}',
    sensitivity   TEXT DEFAULT 'normal'
                      CHECK (sensitivity IN ('normal', 'sensitive', 'restricted')),
    chunk_count   INT DEFAULT 0,
    version       INT DEFAULT 1,
    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. SKILL REGISTRY — learned/installed skills
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_registry (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    source_type  TEXT NOT NULL
                     CHECK (source_type IN ('github', 'manual', 'learned')),
    source_url   TEXT,
    procedure    JSONB NOT NULL,
    version      INT DEFAULT 1,
    status       TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'active', 'deprecated')),
    analysis     JSONB,
    approved_at  TIMESTAMPTZ,
    approved_by  TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 8. APPROVAL QUEUE — human-in-the-loop approval requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_queue (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id       UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
    agent_slug   TEXT NOT NULL,
    action_type  TEXT NOT NULL,
    action_data  JSONB NOT NULL,
    risk_level   TEXT NOT NULL,
    status       TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    decided_at   TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
    created_at   TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- agent_runs lookups
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_slug  ON agent_runs (agent_slug);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id     ON agent_runs (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at  ON agent_runs (created_at DESC);

-- agent_tasks lookups
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status     ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_slug ON agent_tasks (agent_slug);

-- knowledge_memory domain filter
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_domain ON knowledge_memory (domain);

-- approval_queue pending scan
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue (status);

-- profile_memory category filter
CREATE INDEX IF NOT EXISTS idx_profile_memory_category ON profile_memory (category);

-- Vector similarity search (HNSW preferred over IVFFlat for recall quality)
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_embedding
    ON knowledge_memory
    USING hnsw (embedding vector_cosine_ops);


-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to every table with an updated_at column
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'agent_registry',
            'agent_tasks',
            'profile_memory',
            'documents'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; '
            'CREATE TRIGGER trg_%s_updated_at '
            'BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- SEED: INITIAL AGENT REGISTRY
-- ============================================================================

INSERT INTO agent_registry (slug, name, role, model, temperature, risk_level, requires_approval, memory_read, memory_write, tools, rag_domains)
VALUES
    -- Executive Orchestrator: routes goals to specialist agents
    ('orchestrator',
     'Executive Orchestrator',
     'Routes user goals to specialist agents, plans multi-step workflows, and synthesises results',
     'compound-beta', 0.3, 'low', false,
     '{profile,knowledge}', '{}', '{route,plan,delegate}', '{}'),

    -- Memory Agent: validates and writes to shared memory layers
    ('memory',
     'Memory Agent',
     'Validates, deduplicates, and writes facts to shared profile and knowledge memory',
     'llama-3.3-70b-versatile', 0.2, 'low', false,
     '{profile,knowledge}', '{profile,knowledge}', '{memory_write,deduplicate}', '{}'),

    -- Career Agent: job search, resume, applications
    ('career',
     'Career Agent',
     'Job search, resume tailoring, application tracking, and interview preparation',
     'compound-beta', 0.4, 'medium', false,
     '{profile,knowledge}', '{}', '{web_search,document_gen}', '{career,resume}'),

    -- Research Agent: web search and synthesis
    ('research',
     'Research Agent',
     'Web search, source verification, and multi-source synthesis into structured briefs',
     'compound-beta', 0.4, 'low', false,
     '{profile,knowledge}', '{}', '{web_search,web_fetch}', '{research}'),

    -- Email Intelligence: inbox scan, classify, draft
    ('email',
     'Email Intelligence',
     'Inbox scanning, classification, priority triage, and draft reply generation',
     'compound-beta', 0.3, 'medium', true,
     '{profile,knowledge}', '{}', '{email_read,email_draft}', '{email}'),

    -- Finance Agent: portfolio and market intelligence
    ('finance',
     'Finance Agent',
     'Portfolio monitoring, market intelligence, and personal finance analysis',
     'compound-beta', 0.3, 'low', false,
     '{profile,knowledge}', '{}', '{market_data,portfolio_read}', '{finance}'),

    -- Visibility Agent: content, SEO, blog
    ('visibility',
     'Visibility Agent',
     'Content creation, SEO optimisation, blog drafting, and social media strategy',
     'compound-beta', 0.5, 'medium', false,
     '{profile,knowledge}', '{}', '{web_search,content_gen}', '{content,seo}'),

    -- Legal Support Agent: immigration/visa retrieval only
    ('legal',
     'Legal Support Agent',
     'Immigration and visa document retrieval and summarisation (retrieval only, no advice)',
     'llama-3.3-70b-versatile', 0.2, 'high', true,
     '{profile,knowledge}', '{}', '{}', '{legal,immigration}'),

    -- News Scout: RSS/web news digest (migrated from existing)
    ('news',
     'News Scout',
     'RSS feed monitoring, web news aggregation, and digest generation',
     'compound-beta', 0.4, 'low', false,
     '{profile,knowledge}', '{}', '{rss_read,web_fetch}', '{news}'),

    -- Life Agent: personal notes/digest (migrated from existing)
    ('life',
     'Life Agent',
     'Personal note-taking, daily digest compilation, and life event tracking',
     'compound-beta', 0.4, 'low', false,
     '{profile,knowledge}', '{}', '{notes,calendar}', '{life}')

ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- DATA MIGRATION NOTE
-- ============================================================================
-- After running this migration, migrate existing personal_facts data:
--
--   INSERT INTO profile_memory (key, value, category, source, verified)
--   SELECT key, value, category, 'migrated_from_personal_facts', true
--   FROM personal_facts
--   ON CONFLICT (key, category) DO NOTHING;
--
-- ============================================================================
