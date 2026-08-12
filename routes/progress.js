import express from 'express';
import { query } from '../db.js';
import { requireStudent } from './auth.js';

const router = express.Router();

router.post('/pdf-viewed', requireStudent, async (req, res) => {
  const { chapterId, courseId } = req.body;
  await query(
    `INSERT INTO progress (student_id, chapter_id, course_id, pdf_viewed)
     VALUES ($1,$2,$3,true)
     ON CONFLICT (student_id, chapter_id) DO UPDATE SET pdf_viewed = true, updated_at = now()`,
    [req.student.id, chapterId, courseId]
  );
  res.json({ success: true });
});

router.get('/course/:courseId', requireStudent, async (req, res) => {
  const rows = await query(
    'SELECT * FROM progress WHERE student_id = $1 AND course_id = $2',
    [req.student.id, req.params.courseId]
  );
  const chapters = await query('SELECT id FROM chapters WHERE course_id = $1', [req.params.courseId]);
  const totalChapters = chapters.length;
  const completedChapters = rows.filter((r) => r.pdf_viewed && r.quiz_completed).length;
  const percent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  res.json({
    courseId: req.params.courseId,
    totalChapters,
    completedChapters,
    percent,
    chapters: rows.map((r) => ({
      chapterId: r.chapter_id, pdfViewed: r.pdf_viewed, quizCompleted: r.quiz_completed
    }))
  });
});

export default router;
