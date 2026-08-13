import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAdmin } from './auth.js';

const router = express.Router();

// ---- GET /api/students  (admin only) - list all students with enrolled courses ----
router.get('/', requireAdmin, async (req, res) => {
  const rows = await query(
    'SELECT id, student_code, name, phone, email, is_active, created_at FROM students ORDER BY created_at DESC'
  );

  const purchases = await query(
    `SELECT p.student_id, p.amount, c.id as course_id, c.title
     FROM purchases p JOIN courses c ON c.id = p.course_id`
  );

  const result = rows.map((s) => {
    const own = purchases.filter((p) => p.student_id === s.id);
    return {
      ...s,
      joinedAt: s.created_at,
      totalSpent: own.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      courses: own.map((p) => ({ id: p.course_id, title: p.title }))
    };
  });

  res.json(result);
});

// ---- POST /api/students  (admin only) - add one student manually ----
router.post('/', requireAdmin, async (req, res) => {
  const { student_code, name, phone, email, password } = req.body;
  if (!student_code || !name || !password) {
    return res.status(400).json({ error: 'student_code, name and password are required' });
  }

  const existing = await query('SELECT id FROM students WHERE student_code = $1', [student_code]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'A student with this code already exists' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const rows = await query(
    `INSERT INTO students (student_code, name, phone, email, password_hash, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, student_code, name, phone, email, is_active, created_at`,
    [student_code, name, phone || null, email || null, password_hash, req.admin.id]
  );
  res.status(201).json(rows[0]);
});

// ---- PATCH /api/students/:id/disable  (admin only) - soft-disable a student ----
router.patch('/:id/disable', requireAdmin, async (req, res) => {
  const rows = await query(
    'UPDATE students SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id, student_code, is_active',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
  res.json(rows[0]);
});

// ---- PATCH /api/students/:id/enable  (admin only) - re-enable a student ----
router.patch('/:id/enable', requireAdmin, async (req, res) => {
  const rows = await query(
    'UPDATE students SET is_active = true, updated_at = now() WHERE id = $1 RETURNING id, student_code, is_active',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
  res.json(rows[0]);
});

// ---- DELETE /api/students/:id  (admin only) - permanently remove ----
router.delete('/:id', requireAdmin, async (req, res) => {
  const rows = await query('DELETE FROM students WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
  res.json({ deleted: true, id: rows[0].id });
});

export default router;
