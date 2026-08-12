import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { uploadVideoWithThumb } from '../upload.js';
import { requireAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

function toVideoJSON(v) {
  return {
    id: v.id,
    chapterId: v.chapter_id,
    courseId: v.course_id,
    title: v.title,
    description: v.description,
    filename: v.filename,
    duration: v.duration,
    thumbnail: v.thumbnail,
    views: v.views,
    status: v.status,
    order: v.video_order,
    isLocked: v.is_locked,
    pdfId: v.pdf_id,
    uploadedAt: v.uploaded_at
  };
}

router.get('/', async (req, res) => {
  let sql = 'SELECT * FROM videos WHERE 1=1';
  const params = [];
  if (req.query.chapterId) {
    params.push(req.query.chapterId);
    sql += ` AND chapter_id = $${params.length}`;
  }
  if (req.query.courseId) {
    params.push(req.query.courseId);
    sql += ` AND course_id = $${params.length}`;
  }
  const rows = await query(sql, params);
  res.json(rows.sort((a, b) => a.video_order - b.video_order).map(toVideoJSON));
});

router.get('/:id', async (req, res) => {
  const rows = await query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
  res.json(toVideoJSON(rows[0]));
});

router.post('/upload', (req, res) => {
  uploadVideoWithThumb(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { chapterId, courseId, title, description, status } = req.body;
    if (!chapterId || !courseId || !title) {
      return res.status(400).json({ error: 'chapterId, courseId and title are required' });
    }
    if (!req.files || !req.files.video) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    const videoFile = req.files.video[0];
    const thumbFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    const countRows = await query('SELECT COUNT(*) FROM videos WHERE chapter_id = $1', [chapterId]);
    const nextOrder = Number(countRows[0].count) + 1;

    const rows = await query(
      `INSERT INTO videos (chapter_id, course_id, title, description, filename, thumbnail, duration, status, video_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        chapterId,
        courseId,
        title,
        description || '',
        `/uploads/videos/${videoFile.filename}`,
        thumbFile ? `/uploads/thumbnails/${thumbFile.filename}` : null,
        '00:00',
        status || 'processing',
        nextOrder
      ]
    );
    res.status(201).json(toVideoJSON(rows[0]));
  });
});

router.put('/:id', (req, res) => {
  uploadVideoWithThumb(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const existing = await query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Video not found' });
    const video = existing[0];

    const { title, description, status, order } = req.body;
    const thumbFile = req.files?.thumbnail?.[0];

    const rows = await query(
      `UPDATE videos SET title=$1, description=$2, status=$3, video_order=$4, thumbnail=$5 WHERE id=$6 RETURNING *`,
      [
        title ?? video.title,
        description ?? video.description,
        status ?? video.status,
        order ?? video.video_order,
        thumbFile ? `/uploads/thumbnails/${thumbFile.filename}` : video.thumbnail,
        req.params.id
      ]
    );
    res.json(toVideoJSON(rows[0]));
  });
});

router.patch('/:id/lock', requireAdmin, async (req, res) => {
  const { pdfId } = req.body;
  const rows = await query(
    'UPDATE videos SET is_locked = true, pdf_id = $1 WHERE id = $2 RETURNING *',
    [pdfId || null, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
  res.json(toVideoJSON(rows[0]));
});

router.patch('/:id/unlock', requireAdmin, async (req, res) => {
  const rows = await query(
    'UPDATE videos SET is_locked = false WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
  res.json(toVideoJSON(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const rows = await query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
  const video = rows[0];

  if (video.filename) {
    fs.unlink(path.join(__dirname, '..', video.filename), () => {});
  }
  if (video.thumbnail) {
    fs.unlink(path.join(__dirname, '..', video.thumbnail), () => {});
  }

  await query('DELETE FROM videos WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
