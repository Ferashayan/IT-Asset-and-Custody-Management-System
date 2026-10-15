import { Pool, PoolClient, types } from 'pg';
import { config } from '../config';

// Return DATE columns as plain 'YYYY-MM-DD' strings (avoid timezone shifting)
types.setTypeParser(1082, (value: string) => value);
// COUNT(*) / BIGINT -> number (safe for our ranges)
types.setTypeParser(20, (value: string) => Number(value));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error', err);
});

/** Anything that can run a parameterized query: the pool or a transaction client. */
export type Queryable = Pick<Pool | PoolClient, 'query'>;

/**
 * Run `fn` inside an explicit transaction (BEGIN / COMMIT / ROLLBACK).
 * The callback receives a dedicated client - all queries must go through it.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
