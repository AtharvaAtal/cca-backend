import express from 'express';
import { query } from '../db.js';
import { requireStudent } from './auth.js';

const router = express.Router();

function generateCode() {
  return 'CCA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

router.post('/claim/:courseId', requireStudent, async (req, res) => {
  const chapters = await query('SELECT id FROM chapters WHERE course_id = $1', [req.params.courseId]);
  const progressRows = await query(
    'SELECT * FROM progress WHERE student_id = $1 AND course_id = $2',
    [req.student.id, req.params.courseId]
  );
  const completed = progressRows.filter((r) => r.pdf_viewed && r.quiz_completed).length;

  if (chapters.length === 0 || completed < chapters.length) {
    return res.status(400).json({ error: 'Course not yet completed' });
  }

  const existing = await query(
    'SELECT * FROM certificates WHERE student_id = $1 AND course_id = $2',
    [req.student.id, req.params.courseId]
  );
  if (existing.length > 0) return res.json(existing[0]);

  const rows = await query(
    `INSERT INTO certificates (student_id, course_id, certificate_code)
     VALUES ($1,$2,$3) RETURNING *`,
    [req.student.id, req.params.courseId, generateCode()]
  );
  res.status(201).json(rows[0]);
});

router.get('/me', requireStudent, async (req, res) => {
  const rows = await query(
    `SELECT cert.*, c.title as course_title FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     WHERE cert.student_id = $1 ORDER BY cert.issued_at DESC`,
    [req.student.id]
  );
  res.json(rows.map((r) => ({
    id: r.id, courseTitle: r.course_title, certificateCode: r.certificate_code, issuedAt: r.issued_at
  })));
});

export default router;
