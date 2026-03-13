 -- Migration: Add BurpSuite Activation System
-- v2.3.6.2 - BurpSuite Activation Workflow
-- Created: 2026-03-11

-- Create enum for activation status
CREATE TYPE burp_activation_status AS ENUM ('dormant', 'activating', 'active', 'error');

-- Create burp_setup table (singleton table - only one row allowed)
CREATE TABLE burp_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- JAR file state
  jar_uploaded BOOLEAN NOT NULL DEFAULT false,
  jar_filename TEXT,
  jar_file_size INTEGER,
  jar_file_hash TEXT,
  jar_uploaded_at TIMESTAMP,
  jar_uploaded_by UUID REFERENCES users(id),
  
  -- License file state
  license_uploaded BOOLEAN NOT NULL DEFAULT false,
  license_filename TEXT,
  license_type TEXT, -- 'pro' | 'enterprise'
  license_expiry_date TIMESTAMP,
  license_uploaded_at TIMESTAMP,
  license_uploaded_by UUID REFERENCES users(id),
  
  -- Activation state
  activation_status burp_activation_status NOT NULL DEFAULT 'dormant',
  activated_at TIMESTAMP,
  activated_by UUID REFERENCES users(id),
  deactivated_at TIMESTAMP,
  
  -- MCP connection
  mcp_server_url TEXT,
  mcp_health_check_passed BOOLEAN NOT NULL DEFAULT false,
  last_health_check TIMESTAMP,
  
  -- Error tracking
  error_message TEXT,
  activation_log JSON DEFAULT '[]'::json,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enforce singleton: only allow one row in burp_setup table
CREATE UNIQUE INDEX burp_setup_singleton ON burp_setup ((1));

-- Create initial dormant record
INSERT INTO burp_setup (
  jar_uploaded,
  license_uploaded,
  activation_status
) VALUES (
  false,
  false,
  'dormant'
);

-- Create index for faster status checks
CREATE INDEX idx_burp_setup_activation_status ON burp_setup(activation_status);

-- Add comment for documentation
COMMENT ON TABLE burp_setup IS 'Singleton table tracking BurpSuite Professional activation state';
COMMENT ON COLUMN burp_setup.activation_status IS 'Current activation state: dormant (awaiting files), activating (in progress), active (ready), error (failed)';
