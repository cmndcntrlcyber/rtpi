-- Migration: Add rust-nexus Agentic Implants Integration
-- Created: 2025-12-27
-- Description: Creates tables for rust-nexus implant management, task distribution,
--              certificate management, and telemetry tracking

-- ============================================================================
-- Table 1: rust_nexus_implants
-- Stores registered implant information and metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS rust_nexus_implants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,

    -- Implant Identity
    implant_name TEXT NOT NULL UNIQUE,
    implant_type TEXT NOT NULL CHECK (implant_type IN ('reconnaissance', 'exploitation', 'exfiltration', 'general')),
    version TEXT NOT NULL,

    -- Target System Information
    hostname TEXT NOT NULL,
    os_type TEXT NOT NULL,
    os_version TEXT,
    architecture TEXT NOT NULL CHECK (architecture IN ('x86', 'x64', 'arm', 'arm64')),
    ip_address TEXT,
    mac_address TEXT,

    -- Connection Status
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'connected', 'idle', 'busy', 'disconnected', 'terminated')),
    last_heartbeat TIMESTAMP,
    connection_quality INTEGER DEFAULT 100 CHECK (connection_quality >= 0 AND connection_quality <= 100),

    -- Authentication
    certificate_serial TEXT NOT NULL UNIQUE,
    certificate_fingerprint TEXT NOT NULL,
    auth_token TEXT NOT NULL,

    -- Capabilities
    capabilities JSONB DEFAULT '[]'::jsonb,
    max_concurrent_tasks INTEGER DEFAULT 3 CHECK (max_concurrent_tasks > 0),

    -- AI Configuration
    ai_provider TEXT CHECK (ai_provider IN ('openai', 'anthropic', 'local-llama', 'proxy')),
    ai_model TEXT,
    autonomy_level INTEGER DEFAULT 1 CHECK (autonomy_level >= 1 AND autonomy_level <= 10),

    -- Statistics
    total_tasks_completed INTEGER DEFAULT 0,
    total_tasks_failed INTEGER DEFAULT 0,
    total_bytes_transferred BIGINT DEFAULT 0,
    average_response_time_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Timestamps
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    first_connection_at TIMESTAMP,
    last_connection_at TIMESTAMP,
    terminated_at TIMESTAMP,

    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rust_nexus_implants_operation ON rust_nexus_implants(operation_id);
CREATE INDEX idx_rust_nexus_implants_status ON rust_nexus_implants(status);
CREATE INDEX idx_rust_nexus_implants_type ON rust_nexus_implants(implant_type);
CREATE INDEX idx_rust_nexus_implants_last_heartbeat ON rust_nexus_implants(last_heartbeat);
CREATE INDEX idx_rust_nexus_implants_hostname ON rust_nexus_implants(hostname);


-- ============================================================================
-- Table 2: rust_nexus_tasks
-- Task queue and execution tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS rust_nexus_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implant_id UUID NOT NULL REFERENCES rust_nexus_implants(id) ON DELETE CASCADE,
    operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES agent_workflows(id) ON DELETE SET NULL,

    -- Task Definition
    task_type TEXT NOT NULL CHECK (task_type IN (
        'shell_command',
        'file_transfer',
        'process_execution',
        'network_scan',
        'credential_harvest',
        'privilege_escalation',
        'lateral_movement',
        'data_collection',
        'persistence',
        'custom'
    )),
    task_name TEXT NOT NULL,
    task_description TEXT,

    -- Task Payload
    command TEXT,
    parameters JSONB DEFAULT '{}'::jsonb,
    environment_vars JSONB DEFAULT '{}'::jsonb,

    -- Execution Control
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    timeout_seconds INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Status Tracking
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued',
        'assigned',
        'running',
        'completed',
        'failed',
        'timeout',
        'cancelled',
        'retrying'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- AI Decision Making
    requires_ai_approval BOOLEAN DEFAULT FALSE,
    ai_approved BOOLEAN,
    ai_reasoning TEXT,

    -- Execution Metadata
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    execution_time_ms INTEGER,

    -- Error Handling
    error_message TEXT,
    error_stack TEXT,

    -- Dependencies
    depends_on_task_ids UUID[] DEFAULT ARRAY[]::UUID[],
    blocks_task_ids UUID[] DEFAULT ARRAY[]::UUID[],

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rust_nexus_tasks_implant ON rust_nexus_tasks(implant_id);
CREATE INDEX idx_rust_nexus_tasks_operation ON rust_nexus_tasks(operation_id);
CREATE INDEX idx_rust_nexus_tasks_workflow ON rust_nexus_tasks(workflow_id);
CREATE INDEX idx_rust_nexus_tasks_status ON rust_nexus_tasks(status);
CREATE INDEX idx_rust_nexus_tasks_priority ON rust_nexus_tasks(priority DESC);
CREATE INDEX idx_rust_nexus_tasks_created_at ON rust_nexus_tasks(created_at);


-- ============================================================================
-- Table 3: rust_nexus_task_results
-- Task execution results and output
-- ============================================================================

CREATE TABLE IF NOT EXISTS rust_nexus_task_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES rust_nexus_tasks(id) ON DELETE CASCADE,
    implant_id UUID NOT NULL REFERENCES rust_nexus_implants(id) ON DELETE CASCADE,

    -- Result Data
    result_type TEXT NOT NULL CHECK (result_type IN ('stdout', 'stderr', 'file', 'json', 'binary', 'error')),
    result_data TEXT,
    result_data_compressed BYTEA,
    result_json JSONB,

    -- File Results
    file_path TEXT,
    file_size BIGINT,
    file_hash TEXT,
    file_mime_type TEXT,

    -- Execution Metrics
    exit_code INTEGER,
    execution_time_ms INTEGER NOT NULL,
    memory_used_mb INTEGER,
    cpu_usage_percent INTEGER,

    -- Output Parsing
    parsed_successfully BOOLEAN DEFAULT FALSE,
    parsing_errors TEXT,
    extracted_data JSONB,

    -- Security Indicators
    contains_credentials BOOLEAN DEFAULT FALSE,
    contains_sensitive_data BOOLEAN DEFAULT FALSE,
    security_flags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rust_nexus_task_results_task ON rust_nexus_task_results(task_id);
CREATE INDEX idx_rust_nexus_task_results_implant ON rust_nexus_task_results(implant_id);
CREATE INDEX idx_rust_nexus_task_results_type ON rust_nexus_task_results(result_type);
CREATE INDEX idx_rust_nexus_task_results_captured_at ON rust_nexus_task_results(captured_at);


-- ============================================================================
-- Table 4: rust_nexus_certificates
-- mTLS certificate management and tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS rust_nexus_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implant_id UUID REFERENCES rust_nexus_implants(id) ON DELETE CASCADE,

    -- Certificate Identity
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('ca', 'server', 'client')),
    serial_number TEXT NOT NULL UNIQUE,
    fingerprint_sha256 TEXT NOT NULL UNIQUE,

    -- Subject Information
    common_name TEXT NOT NULL,
    organization TEXT,
    organizational_unit TEXT,
    country TEXT,

    -- Certificate Data
    certificate_pem TEXT NOT NULL,
    private_key_encrypted BYTEA,
    public_key_pem TEXT NOT NULL,

    -- Validity
    not_before TIMESTAMP NOT NULL,
    not_after TIMESTAMP NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,

    -- Revocation
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    revoked_by TEXT,

    -- CA Information
    issuer_common_name TEXT NOT NULL,
    issuer_fingerprint TEXT,
    ca_certificate_id TEXT,

    -- Usage Tracking
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,

    -- Rotation
    rotation_scheduled_at TIMESTAMP,
    rotation_completed_at TIMESTAMP,
    successor_certificate_id UUID,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit
    issued_by UUID NOT NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rust_nexus_certificates_implant ON rust_nexus_certificates(implant_id);
CREATE INDEX idx_rust_nexus_certificates_type ON rust_nexus_certificates(certificate_type);
CREATE INDEX idx_rust_nexus_certificates_serial ON rust_nexus_certificates(serial_number);
CREATE INDEX idx_rust_nexus_certificates_validity ON rust_nexus_certificates(not_after) WHERE is_valid = TRUE;
CREATE INDEX idx_rust_nexus_certificates_revoked ON rust_nexus_certificates(revoked);


-- ============================================================================
-- Table 5: rust_nexus_telemetry
-- Implant health, performance metrics, and monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS rust_nexus_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implant_id UUID NOT NULL REFERENCES rust_nexus_implants(id) ON DELETE CASCADE,

    -- System Metrics
    cpu_usage_percent NUMERIC(5,2),
    memory_usage_mb INTEGER,
    memory_total_mb INTEGER,
    disk_usage_gb NUMERIC(10,2),
    disk_total_gb NUMERIC(10,2),

    -- Network Metrics
    network_latency_ms INTEGER,
    network_bandwidth_kbps INTEGER,
    packets_sent INTEGER,
    packets_received INTEGER,
    bytes_sent BIGINT,
    bytes_received BIGINT,

    -- Process Metrics
    process_count INTEGER,
    thread_count INTEGER,
    handle_count INTEGER,
    uptime_seconds INTEGER,

    -- Task Metrics
    active_tasks INTEGER DEFAULT 0,
    queued_tasks INTEGER DEFAULT 0,
    completed_tasks_last_hour INTEGER DEFAULT 0,
    failed_tasks_last_hour INTEGER DEFAULT 0,

    -- Connection Metrics
    connection_drops_count INTEGER DEFAULT 0,
    reconnection_attempts INTEGER DEFAULT 0,
    last_connection_error TEXT,

    -- Health Status
    health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'critical')),
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
    health_issues TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Anomaly Detection
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_type TEXT,
    anomaly_severity TEXT CHECK (anomaly_severity IN ('low', 'medium', 'high', 'critical')),
    anomaly_description TEXT,

    -- Security Events
    security_events_count INTEGER DEFAULT 0,
    last_security_event TEXT,
    last_security_event_at TIMESTAMP,

    -- AI Metrics (if implant has local AI)
    ai_inference_count INTEGER DEFAULT 0,
    ai_average_latency_ms INTEGER,
    ai_error_count INTEGER DEFAULT 0,

    -- Custom Metrics
    custom_metrics JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    collected_at TIMESTAMP NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rust_nexus_telemetry_implant ON rust_nexus_telemetry(implant_id);
CREATE INDEX idx_rust_nexus_telemetry_collected_at ON rust_nexus_telemetry(collected_at DESC);
CREATE INDEX idx_rust_nexus_telemetry_health ON rust_nexus_telemetry(health_status);
CREATE INDEX idx_rust_nexus_telemetry_anomaly ON rust_nexus_telemetry(anomaly_detected) WHERE anomaly_detected = TRUE;


-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rust_nexus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rust_nexus_implants_updated_at
    BEFORE UPDATE ON rust_nexus_implants
    FOR EACH ROW
    EXECUTE FUNCTION update_rust_nexus_updated_at();

CREATE TRIGGER rust_nexus_tasks_updated_at
    BEFORE UPDATE ON rust_nexus_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_rust_nexus_updated_at();

CREATE TRIGGER rust_nexus_certificates_updated_at
    BEFORE UPDATE ON rust_nexus_certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_rust_nexus_updated_at();


-- Auto-update implant statistics on task completion
CREATE OR REPLACE FUNCTION update_implant_task_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE rust_nexus_implants
        SET total_tasks_completed = total_tasks_completed + 1,
            updated_at = NOW()
        WHERE id = NEW.implant_id;
    ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        UPDATE rust_nexus_implants
        SET total_tasks_failed = total_tasks_failed + 1,
            updated_at = NOW()
        WHERE id = NEW.implant_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rust_nexus_tasks_update_stats
    AFTER UPDATE ON rust_nexus_tasks
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'failed'))
    EXECUTE FUNCTION update_implant_task_stats();


-- Auto-expire certificates
CREATE OR REPLACE FUNCTION check_certificate_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.not_after < NOW() THEN
        NEW.is_valid = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rust_nexus_certificates_check_expiry
    BEFORE INSERT OR UPDATE ON rust_nexus_certificates
    FOR EACH ROW
    EXECUTE FUNCTION check_certificate_expiry();


-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Active implants view
CREATE OR REPLACE VIEW rust_nexus_active_implants AS
SELECT
    i.*,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('queued', 'assigned', 'running')) as pending_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed' AND t.completed_at > NOW() - INTERVAL '1 hour') as tasks_completed_last_hour,
    EXTRACT(EPOCH FROM (NOW() - i.last_heartbeat))::INTEGER as seconds_since_heartbeat
FROM rust_nexus_implants i
LEFT JOIN rust_nexus_tasks t ON t.implant_id = i.id
WHERE i.status IN ('connected', 'idle', 'busy')
  AND i.terminated_at IS NULL
GROUP BY i.id;

-- Healthy implants view
CREATE OR REPLACE VIEW rust_nexus_healthy_implants AS
SELECT i.*
FROM rust_nexus_implants i
LEFT JOIN LATERAL (
    SELECT health_status, health_score
    FROM rust_nexus_telemetry
    WHERE implant_id = i.id
    ORDER BY collected_at DESC
    LIMIT 1
) t ON TRUE
WHERE i.status IN ('connected', 'idle', 'busy')
  AND i.last_heartbeat > NOW() - INTERVAL '5 minutes'
  AND (t.health_status IS NULL OR t.health_status IN ('healthy', 'degraded'))
  AND i.terminated_at IS NULL;

-- Task queue view
CREATE OR REPLACE VIEW rust_nexus_task_queue AS
SELECT
    t.*,
    i.implant_name,
    i.status as implant_status,
    i.max_concurrent_tasks,
    COUNT(DISTINCT t2.id) FILTER (WHERE t2.status = 'running') as implant_active_tasks
FROM rust_nexus_tasks t
JOIN rust_nexus_implants i ON i.id = t.implant_id
LEFT JOIN rust_nexus_tasks t2 ON t2.implant_id = i.id AND t2.status = 'running'
WHERE t.status IN ('queued', 'assigned')
GROUP BY t.id, i.id
ORDER BY t.priority DESC, t.created_at ASC;


-- ============================================================================
-- Initial Data
-- ============================================================================

-- Insert default task types configuration
COMMENT ON TABLE rust_nexus_implants IS 'Registered rust-nexus implant agents for distributed operations';
COMMENT ON TABLE rust_nexus_tasks IS 'Task queue and execution tracking for implants';
COMMENT ON TABLE rust_nexus_task_results IS 'Task execution results and output data';
COMMENT ON TABLE rust_nexus_certificates IS 'mTLS certificate management for implant authentication';
COMMENT ON TABLE rust_nexus_telemetry IS 'Implant health, performance, and monitoring metrics';
