import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { pool } from './pool';

const SCHEMA_PATH = path.resolve(__dirname, '../../sql/schema.sql');

async function waitForDatabase(retries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`[db] waiting for database (${attempt}/${retries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Creates the schema (idempotent) and makes sure an initial admin account exists. */
export async function migrate() {
  await waitForDatabase();
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  // Serialize concurrent startups with an advisory lock
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(72431)');
    await client.query(sql);

    const { rows } = await client.query(`SELECT 1 FROM users WHERE role = 'Admin' LIMIT 1`);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(config.admin.password, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, email, role)
         VALUES ($1, $2, $3, $4, 'Admin')
         ON CONFLICT DO NOTHING`,
        [config.admin.username, hash, config.admin.fullName, config.admin.email],
      );
      console.log(`[db] created initial admin user "${config.admin.username}"`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(72431)');
    client.release();
  }
  console.log('[db] schema is up to date');
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
