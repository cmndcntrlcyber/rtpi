-- Infrastructure certificate storage. Distinct from the existing
-- `certificates` table (which stores X.509 metadata discovered from
-- third-party devices) — this table holds operator/admin-uploaded PEM
-- material that the platform itself uses or distributes.
--
-- Two `cert_type` values:
--   - 'origin'  → admin-only. Global TLS terminator certificate (e.g.
--                 Cloudflare Origin / Let's Encrypt). Only one row is
--                 active at a time (enforced by partial unique index).
--   - 'client'  → admin or operator. mTLS / client-auth certificates,
--                 scoped per user. Operators see only their own; admins
--                 see every row.
--
-- Private key material is stored encrypted via the server-side AES-256-GCM
-- helper in server/utils/encryption.ts (uses the existing ENCRYPTION_KEY
-- env var). GET endpoints never return the decrypted key — only metadata.

CREATE TABLE IF NOT EXISTS infrastructure_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Discriminator + scoping
  cert_type TEXT NOT NULL CHECK (cert_type IN ('origin', 'client')),
  -- Origin certs are org-wide (owner_user_id IS NULL). Client certs are
  -- per-user (owner_user_id NOT NULL); a NULL means "admin-managed shared
  -- client cert", which only admins can read.
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Identification
  name TEXT NOT NULL,
  description TEXT,

  -- Material
  cert_pem TEXT NOT NULL,
  -- Encrypted private key in `iv:authTag:ciphertext` hex format produced
  -- by server/utils/encryption.ts `encrypt()`. NULL when the operator
  -- uploaded only the certificate (no private key on the platform).
  key_pem_encrypted TEXT,
  -- Optional intermediate / chain certificates (concatenated PEM blocks).
  chain_pem TEXT,

  -- Parsed metadata (populated server-side via crypto.X509Certificate at
  -- upload time so we don't have to re-parse on every list call).
  subject TEXT,
  issuer TEXT,
  serial_number TEXT,
  fingerprint_sha256 TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,

  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedupe on (cert_type, fingerprint_sha256) — same cert can't be uploaded
-- twice under the same type. (A client cert and an origin cert with the
-- same fingerprint is technically possible but vanishingly rare; allowing
-- it costs nothing.)
CREATE UNIQUE INDEX IF NOT EXISTS infrastructure_certificates_type_fp_uniq
  ON infrastructure_certificates (cert_type, fingerprint_sha256);

-- At most one ACTIVE origin certificate at a time. Inactive history is
-- preserved for audit/rotation visibility.
CREATE UNIQUE INDEX IF NOT EXISTS infrastructure_certificates_one_active_origin
  ON infrastructure_certificates ((true))
  WHERE cert_type = 'origin' AND is_active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS infrastructure_certificates_owner_idx
  ON infrastructure_certificates (owner_user_id)
  WHERE cert_type = 'client';

CREATE INDEX IF NOT EXISTS infrastructure_certificates_valid_to_idx
  ON infrastructure_certificates (valid_to);

-- updated_at trigger (consistent with existing migration patterns)
CREATE OR REPLACE FUNCTION update_infrastructure_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS infrastructure_certificates_updated_at ON infrastructure_certificates;
CREATE TRIGGER infrastructure_certificates_updated_at
  BEFORE UPDATE ON infrastructure_certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_infrastructure_certificates_updated_at();

COMMENT ON TABLE infrastructure_certificates IS 'Operator-uploaded TLS certificates (origin = org-wide TLS terminator; client = per-user mTLS). Private keys are AES-256-GCM encrypted via server/utils/encryption.ts.';
