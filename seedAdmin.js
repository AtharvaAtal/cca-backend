// Run once: node seedAdmin.js
// Creates the first admin account so you can log in.
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const USERNAME = 'admin';
const PASSWORD = 'ChangeMe123!'; // change this after first login

async function seed() {
  const existing = await pool.query('SELECT id FROM admins WHERE username = $1', [USERNAME]);
  if (existing.rows.length > 0) {
    console.log('Admin already exists, skipping.');
    process.exit(0);
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query(
    'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
    [USERNAME, hash]
  );

  console.log('Admin created:');
  console.log('  username:', USERNAME);
  console.log('  password:', PASSWORD);
  console.log('Change this password after your first login.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
