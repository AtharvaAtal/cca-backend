import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireStudent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'student') {
      return res.status(403).json({ error: 'Student access required' });
    }
    req.student = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const rows = await query('SELECT * FROM admins WHERE username = $1', [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const admin = rows[0];
  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, admin: { id: admin.id, username: admin.username } });
});

router.post('/student/login', async (req, res) => {
  const { student_code, password } = req.body;
  if (!student_code || !password) {
    return res.status(400).json({ error: 'Student code and password required' });
  }
  const rows = await query('SELECT * FROM students WHERE student_code = $1', [student_code]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const student = rows[0];
  if (!student.is_active) {
    return res.status(403).json({ error: 'This account has been disabled. Contact your institute.' });
  }
  const match = await bcrypt.compare(password, student.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: student.id, student_code: student.student_code, role: 'student' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({
    token,
    student: { id: student.id, name: student.name, student_code: student.student_code }
  });
});

// ---- POST /api/auth/student/change-password ----
// Student can change their own password. Updates the DB immediately.
router.post('/student/change-password', requireStudent, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const rows = await query('SELECT * FROM students WHERE id = $1', [req.student.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
  const student = rows[0];

  const match = await bcrypt.compare(currentPassword, student.password_hash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await query(
    'UPDATE students SET password_hash = $1, updated_at = now() WHERE id = $2',
    [newHash, req.student.id]
  );

  res.json({ success: true, message: 'Password updated successfully' });
});

export default router;
