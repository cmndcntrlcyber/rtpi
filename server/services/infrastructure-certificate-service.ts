/**
 * Infrastructure certificate service.
 *
 * Parses uploaded PEM blocks, encrypts the private key for at-rest storage,
 * and centralizes the role-checking for read access (admins see every row;
 * operators see only client certs they own).
 *
 * Private-key material is encrypted with the existing AES-256-GCM helper
 * (`server/utils/encryption.ts`) that uses `ENCRYPTION_KEY`. No code path
 * here returns a decrypted private key — that decryption happens elsewhere
 * (deployment-time material distribution) and is intentionally outside the
 * HTTP API surface.
 */

import crypto from "crypto";
import { encrypt } from "../utils/encryption";

export type CertType = "origin" | "client";

export interface ParsedCertificate {
  subject: string;
  issuer: string;
  serialNumber: string | null;
  fingerprintSha256: string;
  validFrom: Date;
  validTo: Date;
}

/**
 * Parses a PEM-formatted X.509 certificate and returns the metadata the
 * platform persists alongside the raw PEM. Uses Node's built-in
 * `crypto.X509Certificate` (Node 16+) so there's no extra dependency.
 *
 * Throws when:
 *  - The string isn't a recognizable PEM block
 *  - The cert is unreadable (malformed DER, wrong PEM type, etc.)
 *  - `notBefore` / `notAfter` parse to invalid Date objects
 */
export function parseCertificatePem(pem: string): ParsedCertificate {
  const trimmed = pem.trim();
  if (!trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error("Not a PEM-encoded certificate (missing -----BEGIN CERTIFICATE----- marker)");
  }
  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(trimmed);
  } catch (err) {
    throw new Error(`Failed to parse certificate: ${err instanceof Error ? err.message : String(err)}`);
  }

  const validFrom = new Date(cert.validFrom);
  const validTo = new Date(cert.validTo);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime())) {
    throw new Error("Certificate has invalid validFrom/validTo dates");
  }

  // X509Certificate.fingerprint256 returns "AB:CD:..." colon-separated; we
  // normalize to lowercase hex with no separators so the unique index key
  // is stable.
  const fingerprintSha256 = cert.fingerprint256.replace(/:/g, "").toLowerCase();

  return {
    subject: cert.subject,
    issuer: cert.issuer,
    serialNumber: cert.serialNumber || null,
    fingerprintSha256,
    validFrom,
    validTo,
  };
}

/**
 * Validates that a PEM blob is a recognizable RSA / EC / Ed25519 private
 * key. We don't enforce that it MATCHES the certificate's public key here —
 * that's `validateKeyMatchesCertificate` below, which is stricter and slower
 * (one signature verification) and is opt-in.
 */
export function validatePrivateKeyPem(pem: string): void {
  const trimmed = pem.trim();
  if (!trimmed.match(/-----BEGIN (?:RSA |EC |ENCRYPTED |)?PRIVATE KEY-----/)) {
    throw new Error("Not a PEM-encoded private key (missing -----BEGIN ... PRIVATE KEY----- marker)");
  }
  try {
    // crypto.createPrivateKey accepts PKCS#1, PKCS#8, SEC1, Ed25519, etc.
    crypto.createPrivateKey({ key: trimmed, format: "pem" });
  } catch (err) {
    throw new Error(`Failed to parse private key: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Best-effort proof that the supplied private key corresponds to the
 * supplied certificate. Signs a random nonce with the key and verifies it
 * against the cert's public key. Catches the common "wrong key uploaded"
 * mistake before we persist a useless ciphertext blob.
 */
export function validateKeyMatchesCertificate(certPem: string, keyPem: string): void {
  let cert: crypto.X509Certificate;
  let keyObj: crypto.KeyObject;
  try {
    cert = new crypto.X509Certificate(certPem);
    keyObj = crypto.createPrivateKey({ key: keyPem, format: "pem" });
  } catch (err) {
    throw new Error(
      `Could not load cert or key for matching check: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const nonce = crypto.randomBytes(32);
  const sig = crypto.sign(null, nonce, keyObj);
  const ok = crypto.verify(null, nonce, cert.publicKey, sig);
  if (!ok) {
    throw new Error("Private key does not match the supplied certificate (signature verification failed)");
  }
}

/**
 * Lightweight chain validation — confirms each PEM block parses as an X.509
 * certificate. We don't enforce ordering or signature linkage here because
 * operators sometimes paste roots-only or weirdly-ordered chains and the
 * platform doesn't care; whoever deploys the cert downstream can be stricter.
 */
export function validateChainPem(chainPem: string): void {
  const blocks = chainPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length === 0) {
    throw new Error("Chain PEM contains no certificate blocks");
  }
  for (const [i, block] of blocks.entries()) {
    try {
      new crypto.X509Certificate(block);
    } catch (err) {
      throw new Error(
        `Chain block ${i + 1} failed to parse: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Wraps the AES-256-GCM helper so callers don't have to import it directly. */
export function encryptPrivateKey(keyPem: string): string {
  return encrypt(keyPem);
}

/**
 * Shape returned by list/get endpoints. Deliberately omits `keyPemEncrypted`
 * and `certPem`/`chainPem` so listings stay light; consumers needing the
 * raw PEM hit the `/raw` endpoint which is admin-gated and audited.
 */
export interface CertificateSummary {
  id: string;
  certType: CertType;
  ownerUserId: string | null;
  name: string;
  description: string | null;
  subject: string | null;
  issuer: string | null;
  serialNumber: string | null;
  fingerprintSha256: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  hasPrivateKey: boolean;
  hasChain: boolean;
  revokedAt: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
}

/**
 * Role-based access check used by list/get/delete handlers. Admins see
 * everything; operators see only their own client certificates; viewers
 * and any other role see nothing in this surface. Origin certs are never
 * visible to non-admins.
 */
export function canRead(
  user: { id: string; role: string },
  row: { certType: string; ownerUserId: string | null },
): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "operator") return false;
  if (row.certType !== "client") return false;
  return row.ownerUserId === user.id;
}
