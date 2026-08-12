import express from 'express';
import { query } from '../db.js';
import { requireAdmin, requireStudent } from './auth.js';

const router = express.Router();

// ---- POST /api/enrollments  (admin only) — grant a student access to a course ----
router.post('/', requireAdmin, async (req, res) => {
  const { studentId, courseId } = req.body;
  if (!studentId || !courseId) {
    return res.status(400).json({ error: 'studentId and courseId are required' });
  }

  const existing = await query(
    'SELECT id FROM purchases WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Student already has access to this course' });
  }

  const rows = await query(
    `INSERT INTO purchases (student_id, course_id, amount)
     VALUES ($1, $2, 0) RETURNING *`,
    [studentId, courseId]
  );
  res.status(201).json(rows[0]);
});

// ---- DELETE /api/enrollments/:id  (admin only) — revoke access ----
router.delete('/:id', requireAdmin, async (req, res) => {
  const rows = await query('DELETE FROM purchases WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Enrollment not found' });
  res.json({ success: true });
});

// ---- GET /api/enrollments/student/:studentId  (admin only) — list a student's courses ----
router.get('/student/:studentId', requireAdmin, async (req, res) => {
  const rows = await query(
    `SELECT p.id as purchase_id, c.* FROM purchases p
     JOIN courses c ON c.id = p.course_id
     WHERE p.student_id = $1`,
    [req.params.studentId]
  );
  res.json(rows);
});

// ---- GET /api/enrollments/me  (student only) — student's own enrolled courses ----
router.get('/me', requireStudent, async (req, res) => {
  const rows = await query(
    `SELECT p.id as purchase_id, c.* FROM purchases p
     JOIN courses c ON c.id = p.course_id
     WHERE p.student_id = $1`,
    [req.student.id]
  );
  res.json(
    rows.map((c) => ({
      purchaseId: c.purchase_id,
      courseId: c.id,
      courseTitle: c.title,
      subtitle: c.subtitle,
      thumbnail: c.thumbnail,
      category: c.category
    }))
  );
});

export default router;
