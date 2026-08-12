import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function initDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('  Postgres connected ✔');
  } catch (err) {
    console.error('  Postgres connection FAILED:', err.message);
    throw err;
  }
}

export default pool;
