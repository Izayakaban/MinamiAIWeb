import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from './db/db.js';

dotenv.config();

const username = 'izaya';
const newPassword = 'minami';

const hash = await bcrypt.hash(newPassword, 10);

const result = await pool.query(
  'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username, role',
  [hash, username]
);

if (result.rowCount === 0) {
  console.log('No user found with that username.');
} else {
  console.log('Password reset for:', result.rows[0]);
}

process.exit(0);