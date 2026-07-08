import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import postgres from 'postgres';
import path from 'path';

const ADMIN_URL = 'postgresql://rtpi:rtpi@localhost:5434/postgres';
const TEST_DB_NAME = 'rtpi_smoke_test';
const TEST_DB_URL = `postgresql://rtpi:rtpi@localhost:5434/${TEST_DB_NAME}`;
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const PUSH_TIMEOUT = 60_000;

let pgAvailable = false;
try {
  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 3 });
  await probe`SELECT 1`;
  await probe.end();
  pgAvailable = true;
} catch {
  pgAvailable = false;
}

const suite = pgAvailable ? describe : describe.skip;

suite('Database Migration Smoke Test (apply → rollback → reapply)', () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;

  async function getTableCount(sql: postgres.Sql): Promise<number> {
    const rows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    return rows[0].cnt;
  }

  async function getEnumCount(sql: postgres.Sql): Promise<number> {
    const rows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e' AND n.nspname = 'public'
    `;
    return rows[0].cnt;
  }

  async function tableExists(sql: postgres.Sql, name: string): Promise<boolean> {
    const rows = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    `;
    return rows.length > 0;
  }

  function pushSchema(): void {
    execSync('npx drizzle-kit push', {
      cwd: PROJECT_ROOT,
      timeout: PUSH_TIMEOUT,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    });
  }

  async function createExtensions(sql: postgres.Sql): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await sql`CREATE EXTENSION IF NOT EXISTS "vector"`;
  }

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1, connect_timeout: 5, idle_timeout: 5 });

    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);

    testSql = postgres(TEST_DB_URL, { max: 1, connect_timeout: 5, idle_timeout: 5, prepare: false });
    await createExtensions(testSql);
    await testSql.end();
  }, 30_000);

  it('apply — schema push creates all tables and enums', async () => {
    pushSchema();

    testSql = postgres(TEST_DB_URL, { max: 1, connect_timeout: 5, idle_timeout: 5, prepare: false });

    const tableCount = await getTableCount(testSql);
    const enumCount = await getEnumCount(testSql);

    expect(tableCount).toBeGreaterThanOrEqual(130);
    expect(enumCount).toBeGreaterThanOrEqual(65);

    expect(await tableExists(testSql, 'users')).toBe(true);
    expect(await tableExists(testSql, 'operations')).toBe(true);
    expect(await tableExists(testSql, 'vulnerabilities')).toBe(true);
    expect(await tableExists(testSql, 'agents')).toBe(true);
    expect(await tableExists(testSql, 'mcp_servers')).toBe(true);
    expect(await tableExists(testSql, 'knowledge_base')).toBe(true);

    await testSql.end();
  }, PUSH_TIMEOUT + 10_000);

  it('rollback — drop schema cascade empties the database', async () => {
    testSql = postgres(TEST_DB_URL, { max: 1, connect_timeout: 5, idle_timeout: 5, prepare: false });

    await testSql.unsafe('DROP SCHEMA public CASCADE');
    await testSql.unsafe('CREATE SCHEMA public');
    await testSql.unsafe('GRANT ALL ON SCHEMA public TO rtpi');
    await testSql.unsafe('GRANT ALL ON SCHEMA public TO public');

    expect(await getTableCount(testSql)).toBe(0);
    expect(await getEnumCount(testSql)).toBe(0);

    await testSql.end();
  }, 15_000);

  it('reapply — schema push succeeds after rollback', async () => {
    testSql = postgres(TEST_DB_URL, { max: 1, connect_timeout: 5, idle_timeout: 5, prepare: false });
    await createExtensions(testSql);
    await testSql.end();

    pushSchema();

    testSql = postgres(TEST_DB_URL, { max: 1, connect_timeout: 5, idle_timeout: 5, prepare: false });

    const tableCount = await getTableCount(testSql);
    const enumCount = await getEnumCount(testSql);

    expect(tableCount).toBeGreaterThanOrEqual(130);
    expect(enumCount).toBeGreaterThanOrEqual(65);

    expect(await tableExists(testSql, 'users')).toBe(true);
    expect(await tableExists(testSql, 'vulnerabilities')).toBe(true);
    expect(await tableExists(testSql, 'mcp_servers')).toBe(true);
    expect(await tableExists(testSql, 'knowledge_base')).toBe(true);

    await testSql.end();
  }, PUSH_TIMEOUT + 10_000);

  afterAll(async () => {
    try { await testSql?.end(); } catch { /* already closed */ }

    if (adminSql) {
      await adminSql.unsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
      `);
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
      await adminSql.end();
    }
  }, 15_000);
});
