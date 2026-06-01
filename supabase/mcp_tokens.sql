-- MCP access tokens for the Lucy MCP Hub.
-- Run this in Supabase SQL editor.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Unnamed',
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;
