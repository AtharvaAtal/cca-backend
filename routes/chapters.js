import express from 'express';
import { query } from '../db.js';

const router = express.Router();

function toChapterJSON(ch) {
  return { id: ch.id, courseId: ch.course_id, title: ch.title, order: ch.chapter_order, status: ch.status };
}

router.post('/', async (req, res) => {
  const { courseId, title, status } = req.body;
  if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });

  const countRows = await query('SELECT COUNT(*) FROM chapters WHERE course_id = $1', [courseId]);
  const nextOrder = Number(countRows[0].count) + 1;

  const rows = await query(
    `INSERT INTO chapters (course_id, title, chapter_order, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [courseId, title, nextOrder, status || 'draft']
  );
  res.status(201).json(toChapterJSON(rows[0]));
});

router.put('/:id', async (req, res) => {
  const existing = await query('SELECT * FROM chapters WHERE id = $1', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ error: 'Chapter not found' });
  const ch = existing[0];

  const { title, status, order } = req.body;
  const rows = await query(
    `UPDATE chapters SET title=$1, status=$2, chapter_order=$3 WHERE id=$4 RETURNING *`,
    [title ?? ch.title, status ?? ch.status, order ?? ch.chapter_order, req.params.id]
  );
  res.json(toChapterJSON(rows[0]));
});

router.post('/reorder', async (req, res) => {
  const { orderedIds } = req.body;
  for (let i = 0; i < orderedIds.length; i++) {
    await query('UPDATE chapters SET chapter_order = $1 WHERE id = $2', [i + 1, orderedIds[i]]);
  }
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const rows = await query('DELETE FROM chapters WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Chapter not found' });
  res.json({ success: true });
});

export default router;
