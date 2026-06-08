/**
 * Tests for the infrastructure certificate service.
 *
 * Verifies:
 *   - parseCertificatePem accepts a freshly-generated self-signed X.509
 *     and surfaces subject/issuer/fingerprint/validity
 *   - parseCertificatePem rejects garbage and rejects non-cert PEM blobs
 *   - validatePrivateKeyPem accepts RSA / EC / Ed25519 PEM keys and
 *     rejects garbage
 *   - validateKeyMatchesCertificate passes for a matching pair and
 *     throws for a mismatched pair
 *   - validateChainPem accepts a single cert and rejects an empty blob
 *   - encryptPrivateKey output roundtrips through the existing encrypt/
 *     decrypt helper (so we know the format is compatible)
 *   - canRead enforces the admin-sees-all / operator-sees-only-own-client
 *     contract used by the list/get endpoints
 */

import crypto from "crypto";
import { describe, expect, it, beforeAll } from "vitest";

import {
  parseCertificatePem,
  validatePrivateKeyPem,
  validateKeyMatchesCertificate,
  validateChainPem,
  encryptPrivateKey,
  canRead,
} from "../../../server/services/infrastructure-certificate-service";
import { decrypt } from "../../../server/utils/encryption";

// Stable AES-256-GCM key for the test process — the encryption helper
// requires a 32-byte hex value.
beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

/**
 * Generates a self-signed RSA certificate using only Node's built-ins so
 * the test suite stays hermetic. Returns the cert + matching key as PEM
 * strings, plus a separate non-matching key for negative tests.
 */
function makeSelfSignedRsaCert(): { certPem: string; keyPem: string; otherKeyPem: string } {
  // Generate two unrelated RSA keypairs. We sign a cert with key #1, then
  // hand back key #2 as "the wrong one" for the mismatch test.
  const keypair1 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const keypair2 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

  // Hand-roll a minimal X.509 via the `node-forge`-free path: use Node's
  // x509 isn't available for creation, so we sign a CSR-style cert with
  // OpenSSL's createCertificate API. Node doesn't expose that natively —
  // so we generate via the certutil-style flow using `selfsigned`?
  // Actually, the simplest portable path: shell out to `openssl req` via
  // child_process. The unit-test container has openssl available.
  const { execSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "certtest-"));
  const keyPath = path.join(tmp, "key.pem");
  const certPath = path.join(tmp, "cert.pem");
  fs.writeFileSync(keyPath, keypair1.privateKey.export({ type: "pkcs8", format: "pem" }));
  execSync(
    `openssl req -new -x509 -key ${keyPath} -out ${certPath} -days 30 -subj "/CN=rtpi-cert-test/O=Test"`,
    { stdio: "ignore" },
  );
  const certPem = fs.readFileSync(certPath, "utf-8");
  const keyPem = fs.readFileSync(keyPath, "utf-8");
  const otherKeyPem = keypair2.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  fs.rmSync(tmp, { recursive: true, force: true });
  return { certPem, keyPem, otherKeyPem };
}

let fixture: { certPem: string; keyPem: string; otherKeyPem: string };
beforeAll(() => {
  fixture = makeSelfSignedRsaCert();
});

describe("parseCertificatePem", () => {
  it("extracts subject, issuer, fingerprint, and validity from a real PEM", () => {
    const parsed = parseCertificatePem(fixture.certPem);
    expect(parsed.subject).toContain("rtpi-cert-test");
    expect(parsed.issuer).toContain("rtpi-cert-test"); // self-signed → issuer == subject
    expect(parsed.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.validFrom.getTime()).toBeLessThanOrEqual(Date.now());
    expect(parsed.validTo.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects non-PEM garbage", () => {
    expect(() => parseCertificatePem("not a cert")).toThrow(/PEM-encoded certificate/);
    expect(() => parseCertificatePem("")).toThrow();
  });

  it("rejects a PEM with the BEGIN marker but malformed DER body", () => {
    const bogus = [
      "-----BEGIN CERTIFICATE-----",
      "deadbeefdeadbeefdeadbeefdeadbeef==",
      "-----END CERTIFICATE-----",
    ].join("\n");
    expect(() => parseCertificatePem(bogus)).toThrow();
  });
});

describe("validatePrivateKeyPem", () => {
  it("accepts a valid RSA private key", () => {
    expect(() => validatePrivateKeyPem(fixture.keyPem)).not.toThrow();
  });

  it("accepts an Ed25519 private key", () => {
    const ed = crypto.generateKeyPairSync("ed25519");
    const pem = ed.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(() => validatePrivateKeyPem(pem)).not.toThrow();
  });

  it("rejects garbage", () => {
    expect(() => validatePrivateKeyPem("nope")).toThrow(/PEM-encoded private key/);
  });
});

describe("validateKeyMatchesCertificate", () => {
  it("passes when the key actually matches the certificate", () => {
    expect(() =>
      validateKeyMatchesCertificate(fixture.certPem, fixture.keyPem),
    ).not.toThrow();
  });

  it("throws when the key does NOT match the certificate", () => {
    expect(() =>
      validateKeyMatchesCertificate(fixture.certPem, fixture.otherKeyPem),
    ).toThrow(/does not match/);
  });
});

describe("validateChainPem", () => {
  it("accepts a chain containing one cert", () => {
    expect(() => validateChainPem(fixture.certPem)).not.toThrow();
  });

  it("accepts a chain containing two certs (concatenated PEM blocks)", () => {
    const chain = `${fixture.certPem.trim()}\n${fixture.certPem.trim()}\n`;
    expect(() => validateChainPem(chain)).not.toThrow();
  });

  it("rejects an empty / cert-less chain blob", () => {
    expect(() => validateChainPem("no certs here")).toThrow(/no certificate blocks/);
  });
});

describe("encryptPrivateKey", () => {
  it("roundtrips through decrypt() — the format matches encryption.ts", () => {
    const encrypted = encryptPrivateKey(fixture.keyPem);
    const back = decrypt(encrypted);
    expect(back).toBe(fixture.keyPem);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const a = encryptPrivateKey(fixture.keyPem);
    const b = encryptPrivateKey(fixture.keyPem);
    expect(a).not.toBe(b);
  });
});

describe("canRead role gating", () => {
  const admin = { id: "u-admin", role: "admin" };
  const opOne = { id: "u-op-1", role: "operator" };
  const opTwo = { id: "u-op-2", role: "operator" };
  const viewer = { id: "u-viewer", role: "viewer" };

  it("admin sees every certificate regardless of owner or type", () => {
    expect(canRead(admin, { certType: "origin", ownerUserId: null })).toBe(true);
    expect(canRead(admin, { certType: "client", ownerUserId: opOne.id })).toBe(true);
    expect(canRead(admin, { certType: "client", ownerUserId: null })).toBe(true);
  });

  it("operator never sees origin certs", () => {
    expect(canRead(opOne, { certType: "origin", ownerUserId: null })).toBe(false);
    expect(canRead(opOne, { certType: "origin", ownerUserId: opOne.id })).toBe(false);
  });

  it("operator sees their own client certs only", () => {
    expect(canRead(opOne, { certType: "client", ownerUserId: opOne.id })).toBe(true);
    expect(canRead(opOne, { certType: "client", ownerUserId: opTwo.id })).toBe(false);
    expect(canRead(opOne, { certType: "client", ownerUserId: null })).toBe(false);
  });

  it("viewer sees nothing in this surface", () => {
    expect(canRead(viewer, { certType: "origin", ownerUserId: null })).toBe(false);
    expect(canRead(viewer, { certType: "client", ownerUserId: viewer.id })).toBe(false);
  });
});
