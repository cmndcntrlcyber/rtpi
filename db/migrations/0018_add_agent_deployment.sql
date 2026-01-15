-- Migration: 0018_add_agent_deployment
-- Description: Add tables for agent builds, bundles, and download tokens

-- Create enum types
CREATE TYPE agent_build_status AS ENUM ('pending', 'building', 'completed', 'failed', 'cancelled');
CREATE TYPE agent_platform AS ENUM ('windows', 'linux');
CREATE TYPE agent_architecture AS ENUM ('x64', 'x86', 'arm64');

-- Agent builds table - tracks compilation jobs
CREATE TABLE IF NOT EXISTS agent_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status agent_build_status NOT NULL DEFAULT 'pending',
    platform agent_platform NOT NULL,
    architecture agent_architecture NOT NULL DEFAULT 'x64',
    features JSONB DEFAULT '[]'::jsonb,
    binary_path TEXT,
    binary_size INTEGER,
    binary_hash TEXT,
    build_log TEXT,
    build_duration_ms INTEGER,
    error_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Agent bundles table - stores generated agent packages
CREATE TABLE IF NOT EXISTS agent_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform agent_platform NOT NULL,
    architecture agent_architecture NOT NULL DEFAULT 'x64',
    build_id UUID REFERENCES agent_builds(id),
    certificate_id UUID REFERENCES rust_nexus_certificates(id),
    certificate_serial TEXT NOT NULL,
    certificate_fingerprint TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT NOT NULL,
    controller_url TEXT NOT NULL,
    implant_type implant_type DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT true,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Download tokens table - shareable download links
CREATE TABLE IF NOT EXISTS agent_download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    bundle_id UUID NOT NULL REFERENCES agent_bundles(id) ON DELETE CASCADE,
    max_downloads INTEGER NOT NULL DEFAULT 1,
    current_downloads INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    allowed_ip_ranges JSONB DEFAULT '[]'::jsonb,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_agent_builds_status ON agent_builds(status);
CREATE INDEX idx_agent_builds_created_by ON agent_builds(created_by);
CREATE INDEX idx_agent_builds_created_at ON agent_builds(created_at DESC);

CREATE INDEX idx_agent_bundles_platform ON agent_bundles(platform);
CREATE INDEX idx_agent_bundles_is_active ON agent_bundles(is_active);
CREATE INDEX idx_agent_bundles_created_by ON agent_bundles(created_by);
CREATE INDEX idx_agent_bundles_created_at ON agent_bundles(created_at DESC);

CREATE INDEX idx_agent_download_tokens_token ON agent_download_tokens(token);
CREATE INDEX idx_agent_download_tokens_bundle_id ON agent_download_tokens(bundle_id);
CREATE INDEX idx_agent_download_tokens_expires_at ON agent_download_tokens(expires_at);

-- Comments
COMMENT ON TABLE agent_builds IS 'Tracks agent compilation jobs in Docker containers';
COMMENT ON TABLE agent_bundles IS 'Stores generated agent packages with binaries, certificates, and configs';
COMMENT ON TABLE agent_download_tokens IS 'Shareable download tokens for public agent distribution';
