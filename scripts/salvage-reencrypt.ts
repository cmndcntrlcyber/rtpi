#!/usr/bin/env tsx
/**
 * Salvage re-encryption: decrypts AES-256-GCM ciphertext with the
 * decommissioned-host's ENCRYPTION_KEY (the hardcoded default
 * 0123...cdef), then re-encrypts with the current live key from .env.
 *
 * Source: shadow Postgres at localhost:55432 (db rtpi_main, user rtpi, pw salvage)
 * Target: live Postgres in docker compose (db rtpi_main)
 *
 * Idempotent within a single invocation: reads ciphertext from source,
 * writes plaintext→new-ciphertext to the target row. If a target row
 * already has a valid (new-key) ciphertext, it is overwritten.
 *
 * Aborts cleanly before any write if a source decrypt fails — leaving
 * the live DB untouched.
 *
 * Usage:
 *   npx tsx scripts/salvage-reencrypt.ts
 */

import crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const OLD_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const NEW_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!NEW_KEY_HEX || NEW_KEY_HEX.length !== 64) {
  console.error('[salvage-reencrypt] ENCRYPTION_KEY missing or wrong length in .env');
  process.exit(1);
}
if (NEW_KEY_HEX === OLD_KEY_HEX) {
  console.error('[salvage-reencrypt] Live ENCRYPTION_KEY equals the default; refusing to run a no-op migration');
  process.exit(1);
}

const OLD_KEY = Buffer.from(OLD_KEY_HEX, 'hex');
const NEW_KEY = Buffer.from(NEW_KEY_HEX, 'hex');

function decryptWith(key: Buffer, ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  let out = d.update(dataHex, 'hex', 'utf8');
  out += d.final('utf8');
  return out;
}

function encryptWith(key: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  let out = c.update(plaintext, 'utf8', 'hex');
  out += c.final('hex');
  const tag = c.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${out}`;
}

type Column = {
  table: string;
  idCol: string;
  ciphertextCol: string;
  required: boolean;
};

const COLUMNS: Column[] = [
  { table: 'empire_servers', idCol: 'id', ciphertextCol: 'admin_password_hash', required: true },
];

async function main() {
  const source = postgres({
    host: '127.0.0.1',
    port: 55432,
    user: 'rtpi',
    password: 'salvage',
    database: 'rtpi_main',
    max: 1,
    idle_timeout: 10,
  });

  const target = postgres({
    host: '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5434', 10),
    user: process.env.DB_USER || 'rtpi',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rtpi_main',
    max: 1,
    idle_timeout: 10,
  });

  const plan: Array<{ table: string; idCol: string; col: string; id: string; newCipher: string }> = [];

  try {
    for (const c of COLUMNS) {
      const rows = await source.unsafe(
        `SELECT ${c.idCol} AS id, ${c.ciphertextCol} AS cipher FROM ${c.table} WHERE ${c.ciphertextCol} IS NOT NULL AND ${c.ciphertextCol} <> ''`
      );
      console.log(`[${c.table}.${c.ciphertextCol}] ${rows.length} row(s)`);
      for (const r of rows as any[]) {
        let plain: string;
        try {
          plain = decryptWith(OLD_KEY, r.cipher);
        } catch (e: any) {
          console.error(`  id=${r.id}: DECRYPT FAILED with old key: ${e.message}`);
          console.error('  Aborting. Live DB untouched.');
          process.exit(2);
        }
        if (!plain) {
          console.error(`  id=${r.id}: decrypt produced empty plaintext — aborting`);
          process.exit(2);
        }
        const newCipher = encryptWith(NEW_KEY, plain);
        plan.push({ table: c.table, idCol: c.idCol, col: c.ciphertextCol, id: r.id, newCipher });
        console.log(`  id=${r.id}: decrypted OK (${plain.length} chars), re-encrypted with new key`);
      }
    }

    console.log(`\n[salvage-reencrypt] ${plan.length} row(s) ready. Writing to live DB...`);
    await target.begin(async (tx) => {
      for (const p of plan) {
        await tx.unsafe(
          `UPDATE ${p.table} SET ${p.col} = $1 WHERE ${p.idCol} = $2`,
          [p.newCipher, p.id]
        );
      }
    });
    console.log('[salvage-reencrypt] done.');
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((e) => {
  console.error('[salvage-reencrypt] FATAL:', e);
  process.exit(1);
});
