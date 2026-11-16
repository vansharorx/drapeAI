import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be configured before starting the API.');

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

pool.on('error', (error) => {
  const code = (error as NodeJS.ErrnoException).code;
  console.error(JSON.stringify({ level: 'error', event: 'postgres_pool_error', code: code && /^[A-Z0-9_]+$/.test(code) ? code : 'DATABASE_ERROR' }));
});
