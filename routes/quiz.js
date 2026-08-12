import express from 'express';
import { query } from '../db.js';
import { requireAdmin, requireStudent } from './auth.js';

const router = express.Router();

router.get('/:chapterId', async (req, res) => {
  const rows = await query('SELECT * FROM test_questions WHERE chapter_id = $1', [req.params.chapterId]);
  res.json(rows.map((q) => ({
    id: q.id, chapterId: q.chapter_id, courseId: q.course_id,
    question: q.question, options: q.options, correctAnswer: q.correct_answer
  })));
});

router.post('/:chapterId', requireAdmin, async (req, res) => {
  const { courseId, question, options, correctAnswer } = req.body;
  if (!courseId || !question || !options || !correctAnswer) {
    return res.status(400).json({ error: 'courseId, question, options, correctAnswer are required' });
  }
  const rows = await query(
    `INSERT INTO test_questions (chapter_id, course_id, question, options, correct_answer)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.chapterId, courseId, question, JSON.stringify(options), correctAnswer]
  );
  res.status(201).json(rows[0]);
});

router.delete('/question/:id', requireAdmin, async (req, res) => {
  const rows = await query('DELETE FROM test_questions WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
  res.json({ success: true });
});

router.post('/:chapterId/submit', requireStudent, async (req, res) => {
  const { courseId, answers } = req.body;
  const questions = await query('SELECT * FROM test_questions WHERE chapter_id = $1', [req.params.chapterId]);
  let score = 0;
  questions.forEach((q) => {
    const given = answers.find((a) => a.questionId === q.id);
    if (given && given.answer === q.correct_answer) score++;
  });
  const total = questions.length;
  const passed = total > 0 && score / total >= 0.5;

  const rows = await query(
    `INSERT INTO quiz_results (student_id, chapter_id, course_id, score, total, passed)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.student.id, req.params.chapterId, courseId, score, total, passed]
  );

  await query(
    `INSERT INTO progress (student_id, chapter_id, course_id, quiz_completed)
     VALUES ($1,$2,$3,true)
     ON CONFLICT (student_id, chapter_id) DO UPDATE SET quiz_completed = true, updated_at = now()`,
    [req.student.id, req.params.chapterId, courseId]
  );

  res.json({ score, total, passed, resultId: rows[0].id });
});

router.get('/results/me', requireStudent, async (req, res) => {
  const rows = await query(
    `SELECT qr.*, c.title as course_title, ch.title as chapter_title
     FROM quiz_results qr
     JOIN courses c ON c.id = qr.course_id
     JOIN chapters ch ON ch.id = qr.chapter_id
     WHERE qr.student_id = $1 ORDER BY qr.taken_at DESC`,
    [req.student.id]
  );
  res.json(rows.map((r) => ({
    id: r.id, courseTitle: r.course_title, chapterTitle: r.chapter_title,
    score: r.score, total: r.total, passed: r.passed, takenAt: r.taken_at
  })));
});

export default router;
