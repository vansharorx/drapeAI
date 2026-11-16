import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/001_initial.sql');
    const sql = await readFile(migrationPath, 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ('001_initial.sql') ON CONFLICT DO NOTHING");
    await client.query('COMMIT');
    console.log('Database migrations are up to date.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
