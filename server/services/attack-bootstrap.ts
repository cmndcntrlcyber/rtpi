import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../db";
import { attackTactics } from "@shared/schema";
import { importSTIXBundle } from "./stix-parser";
import { createLogger } from '../lib/logger';
const log = createLogger("attack-bootstrap");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, "../data/attack/enterprise-attack.json");
const STIX_URL =
  process.env.ATTACK_STIX_URL ||
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

async function fetchStixBundle(): Promise<unknown> {
  const res = await fetch(STIX_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`STIX download failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function bootstrapAttackData(): Promise<void> {
  if (process.env.ATTACK_AUTO_IMPORT === "false") {
    log.info("🗂️  MITRE ATT&CK auto-import disabled (ATTACK_AUTO_IMPORT=false)");
    return;
  }

  const existing = await db.select({ id: attackTactics.id }).from(attackTactics).limit(1);
  if (existing.length > 0) return;

  let bundle: any;

  if (existsSync(DATA_FILE)) {
    log.info(`🗂️  MITRE ATT&CK DB empty — importing from ${DATA_FILE}`);
    bundle = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } else {
    log.info(`🗂️  MITRE ATT&CK DB empty and no local bundle — downloading from ${STIX_URL}`);
    bundle = await fetchStixBundle();
    try {
      mkdirSync(dirname(DATA_FILE), { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(bundle));
      log.info(`💾 Cached STIX bundle to ${DATA_FILE}`);
    } catch (cacheErr) {
      log.warn(`⚠️  Could not cache STIX bundle:`, cacheErr);
    }
  }

  if (!bundle || bundle.type !== "bundle" || !Array.isArray(bundle.objects)) {
    throw new Error("Fetched payload is not a valid STIX bundle");
  }

  const start = Date.now();
  const stats = await importSTIXBundle(bundle);
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  log.info(
    `✅ ATT&CK import complete in ${seconds}s — ` +
      `${stats.tactics} tactics, ${stats.techniques} techniques, ${stats.relationships} relationships` +
      (stats.errors.length ? ` (${stats.errors.length} errors)` : "")
  );
}
