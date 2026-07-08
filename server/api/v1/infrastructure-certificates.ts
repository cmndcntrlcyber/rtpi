/**
 * Infrastructure certificate API.
 *
 * Routes (all mounted under /api/v1/infrastructure/certificates):
 *   POST   /                  upload a new cert (multipart). Admin can upload
 *                             origin OR client; operator restricted to client.
 *   GET    /                  list certs visible to the caller. Admin sees
 *                             all rows; operator sees only their own client
 *                             certs. Returns metadata only — no PEM bodies.
 *   GET    /:id               metadata for one cert, same scoping.
 *   POST   /:id/activate      admin-only — activates a specific origin cert
 *                             and deactivates all other active origins.
 *   POST   /:id/revoke        admin can revoke any cert; operator can revoke
 *                             only their own client cert.
 *   DELETE /:id                same rules as revoke; hard-delete.
 *
 * Multer is in-memory (PEM blobs are small, ~5 KB each). 64 KB per file is
 * a generous cap; anything bigger is almost certainly not a cert.
 *
 * No endpoint here returns decrypted private keys. Material distribution
 * (e.g. handing the key to nginx or a framework container) is intentionally
 * out of scope for this surface and will live in a deployment-time worker.
 */

import { Router, type Request } from "express";
import multer from "multer";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { infrastructureCertificates, users } from "@shared/schema";
import {
  ensureAuthenticated,
  ensureRole,
  logAudit,
} from "../../auth/middleware";
import {
  parseCertificatePem,
  validatePrivateKeyPem,
  validateKeyMatchesCertificate,
  validateChainPem,
  encryptPrivateKey,
  canRead,
  type CertType,
  type CertificateSummary,
} from "../../services/infrastructure-certificate-service";
import { createLogger } from '../../lib/logger';
const log = createLogger("infrastructure-certificates");

const router = Router();
router.use(ensureAuthenticated);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024, files: 3 },
});

const certFields = upload.fields([
  { name: "cert", maxCount: 1 },
  { name: "key", maxCount: 1 },
  { name: "chain", maxCount: 1 },
]);

function bufferToString(buf: Express.Multer.File | undefined): string | null {
  if (!buf) return null;
  const text = buf.buffer.toString("utf-8").trim();
  return text.length > 0 ? text : null;
}

function summary(row: typeof infrastructureCertificates.$inferSelect): CertificateSummary {
  return {
    id: row.id,
    certType: row.certType as CertType,
    ownerUserId: row.ownerUserId,
    name: row.name,
    description: row.description,
    subject: row.subject,
    issuer: row.issuer,
    serialNumber: row.serialNumber,
    fingerprintSha256: row.fingerprintSha256,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo.toISOString(),
    isActive: row.isActive,
    hasPrivateKey: row.keyPemEncrypted !== null,
    hasChain: row.chainPem !== null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedBy: row.uploadedBy,
  };
}

/**
 * Visibility filter applied to the list/get queries. Admins see everything;
 * operators see only client certs they own. Returns a Drizzle condition or
 * `undefined` (admin → no filter).
 */
function visibilityFilter(user: { id: string; role: string }) {
  if (user.role === "admin") return undefined;
  // Operator: only client certs they own.
  return and(
    eq(infrastructureCertificates.certType, "client"),
    eq(infrastructureCertificates.ownerUserId, user.id),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// POST / — upload
// ────────────────────────────────────────────────────────────────────────────

router.post("/", certFields, async (req: Request, res) => {
  const user = req.user as { id: string; role: string };
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const certFile = files?.cert?.[0];
  const keyFile = files?.key?.[0];
  const chainFile = files?.chain?.[0];
  const { name, description } = req.body ?? {};
  const certType = String(req.body?.certType ?? "").trim();

  // ── Input validation ──────────────────────────────────────────────────
  if (certType !== "origin" && certType !== "client") {
    return res.status(400).json({ error: "certType must be 'origin' or 'client'" });
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!certFile) {
    return res.status(400).json({ error: "cert (PEM file) is required" });
  }

  // ── Role gating: origin = admin-only; client = admin OR operator ──────
  if (certType === "origin" && user.role !== "admin") {
    await logAudit(user.id, "upload_cert_denied_origin", "/infrastructure/certificates", null, false, req);
    return res.status(403).json({ error: "Forbidden", message: "Only admins can upload origin certificates" });
  }
  if (certType === "client" && user.role !== "admin" && user.role !== "operator") {
    await logAudit(user.id, "upload_cert_denied_client", "/infrastructure/certificates", null, false, req);
    return res.status(403).json({ error: "Forbidden", message: "Only admins or operators can upload client certificates" });
  }

  const certPem = bufferToString(certFile);
  const keyPem = bufferToString(keyFile);
  const chainPem = bufferToString(chainFile);
  if (!certPem) {
    return res.status(400).json({ error: "cert file is empty" });
  }

  // ── PEM parsing + match validation ────────────────────────────────────
  let parsed;
  try {
    parsed = parseCertificatePem(certPem);
    if (keyPem) {
      validatePrivateKeyPem(keyPem);
      validateKeyMatchesCertificate(certPem, keyPem);
    }
    if (chainPem) {
      validateChainPem(chainPem);
    }
  } catch (err: any) {
    await logAudit(user.id, "upload_cert_validation_failed", "/infrastructure/certificates", null, false, req);
    return res.status(400).json({ error: "validation_failed", message: err?.message || "Invalid certificate" });
  }

  const keyPemEncrypted = keyPem ? encryptPrivateKey(keyPem) : null;
  // Client certs always carry an owner; origin certs are org-wide (null).
  const ownerUserId = certType === "client" ? user.id : null;

  try {
    // For origin certs, deactivate any currently-active origin row before
    // inserting the new one. The partial unique index guarantees at most
    // one active origin at a time, so we have to clear first or the INSERT
    // will fail.
    let inserted;
    await db.transaction(async (tx) => {
      if (certType === "origin") {
        await tx
          .update(infrastructureCertificates)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(infrastructureCertificates.certType, "origin"),
            eq(infrastructureCertificates.isActive, true),
            isNull(infrastructureCertificates.revokedAt),
          ));
      }
      const rows = await tx
        .insert(infrastructureCertificates)
        .values({
          certType,
          ownerUserId,
          name: name.trim(),
          description: typeof description === "string" ? description.trim() || null : null,
          certPem,
          keyPemEncrypted,
          chainPem,
          subject: parsed.subject,
          issuer: parsed.issuer,
          serialNumber: parsed.serialNumber,
          fingerprintSha256: parsed.fingerprintSha256,
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          isActive: true,
          uploadedBy: user.id,
        })
        .returning();
      inserted = rows[0];
    });

    await logAudit(user.id, "upload_cert", "/infrastructure/certificates", inserted!.id, true, req);
    return res.status(201).json({ certificate: summary(inserted!) });
  } catch (err: any) {
    // 23505 = unique_violation; surfaced as a friendly "duplicate" error.
    if (err?.cause?.code === "23505" || err?.code === "23505") {
      return res.status(409).json({
        error: "duplicate_certificate",
        message: "A certificate with this fingerprint already exists for this type",
      });
    }
    log.error("[infrastructure-certificates] insert failed:", err);
    await logAudit(user.id, "upload_cert_failed", "/infrastructure/certificates", null, false, req);
    return res.status(500).json({ error: "insert_failed", message: err?.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET / — list
// ────────────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const user = req.user as { id: string; role: string };
  try {
    const filter = visibilityFilter(user);
    const rows = await db
      .select()
      .from(infrastructureCertificates)
      .where(filter ?? sql`true`)
      .orderBy(desc(infrastructureCertificates.uploadedAt));
    res.json({ certificates: rows.map(summary) });
  } catch (err: any) {
    res.status(500).json({ error: "list_failed", message: err?.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /:id — metadata for one row
// ────────────────────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const user = req.user as { id: string; role: string };
  const [row] = await db
    .select()
    .from(infrastructureCertificates)
    .where(eq(infrastructureCertificates.id, req.params.id));
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!canRead(user, row)) return res.status(403).json({ error: "forbidden" });
  res.json({ certificate: summary(row) });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /:id/activate — admin-only, applies to origin certs
// ────────────────────────────────────────────────────────────────────────────

router.post("/:id/activate", ensureRole("admin"), async (req, res) => {
  const user = req.user as { id: string; role: string };
  const [target] = await db
    .select()
    .from(infrastructureCertificates)
    .where(eq(infrastructureCertificates.id, req.params.id));
  if (!target) return res.status(404).json({ error: "not_found" });

  try {
    await db.transaction(async (tx) => {
      if (target.certType === "origin") {
        await tx
          .update(infrastructureCertificates)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(infrastructureCertificates.certType, "origin"),
            eq(infrastructureCertificates.isActive, true),
            isNull(infrastructureCertificates.revokedAt),
          ));
      }
      await tx
        .update(infrastructureCertificates)
        .set({ isActive: true, revokedAt: null, revokedBy: null, updatedAt: new Date() })
        .where(eq(infrastructureCertificates.id, target.id));
    });
    await logAudit(user.id, "activate_cert", "/infrastructure/certificates", target.id, true, req);
    res.json({ ok: true });
  } catch (err: any) {
    await logAudit(user.id, "activate_cert_failed", "/infrastructure/certificates", target.id, false, req);
    res.status(500).json({ error: "activate_failed", message: err?.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /:id/revoke — soft revoke (keeps audit trail)
// ────────────────────────────────────────────────────────────────────────────

router.post("/:id/revoke", async (req, res) => {
  const user = req.user as { id: string; role: string };
  const [row] = await db
    .select()
    .from(infrastructureCertificates)
    .where(eq(infrastructureCertificates.id, req.params.id));
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!canRead(user, row)) return res.status(403).json({ error: "forbidden" });
  // Operators can revoke only client certs they own; admins can revoke any.
  if (user.role !== "admin" && row.certType !== "client") {
    return res.status(403).json({ error: "forbidden", message: "Only admins can revoke this certificate" });
  }

  await db
    .update(infrastructureCertificates)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(infrastructureCertificates.id, row.id));
  await logAudit(user.id, "revoke_cert", "/infrastructure/certificates", row.id, true, req);
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /:id — hard delete
// ────────────────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const user = req.user as { id: string; role: string };
  const [row] = await db
    .select()
    .from(infrastructureCertificates)
    .where(eq(infrastructureCertificates.id, req.params.id));
  if (!row) return res.status(404).json({ error: "not_found" });
  // Operator can only delete their own client certs; admin can delete any.
  if (user.role !== "admin") {
    if (row.certType !== "client" || row.ownerUserId !== user.id) {
      return res.status(403).json({ error: "forbidden" });
    }
  }
  await db.delete(infrastructureCertificates).where(eq(infrastructureCertificates.id, row.id));
  await logAudit(user.id, "delete_cert", "/infrastructure/certificates", row.id, true, req);
  res.json({ ok: true });
});

export default router;
