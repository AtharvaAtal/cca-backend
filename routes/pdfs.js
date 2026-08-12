import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { uploadPdf } from '../upload.js';
import { requireAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

function toPdfJSON(p) {
  return {
    id: p.id,
    chapterId: p.chapter_id,
    courseId: p.course_id,
    title: p.title,
    filename: p.filename,
    uploadedAt: p.uploaded_at
  };
}

router.get('/', async (req, res) => {
  let sql = 'SELECT * FROM pdfs WHERE 1=1';
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
  res.json(rows.map(toPdfJSON));
});

router.get('/:id', async (req, res) => {
  const rows = await query('SELECT * FROM pdfs WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'PDF not found' });
  res.json(toPdfJSON(rows[0]));
});

router.post('/upload', requireAdmin, (req, res) => {
  uploadPdf.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { chapterId, courseId, title } = req.body;
    if (!chapterId || !courseId || !title) {
      return res.status(400).json({ error: 'chapterId, courseId and title are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required (field name "pdf")' });
    }

    const rows = await query(
      `INSERT INTO pdfs (chapter_id, course_id, title, filename)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [chapterId, courseId, title, `/uploads/pdfs/${req.file.filename}`]
    );
    res.status(201).json(toPdfJSON(rows[0]));
  });
});

router.put('/:id', requireAdmin, (req, res) => {
  uploadPdf.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const existing = await query('SELECT * FROM pdfs WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'PDF not found' });
    const pdf = existing[0];

    const { title } = req.body;
    const filename = req.file ? `/uploads/pdfs/${req.file.filename}` : pdf.filename;

    if (req.file && pdf.filename) {
      fs.unlink(path.join(__dirname, '..', pdf.filename), () => {});
    }

    const rows = await query(
      'UPDATE pdfs SET title=$1, filename=$2 WHERE id=$3 RETURNING *',
      [title ?? pdf.title, filename, req.params.id]
    );
    res.json(toPdfJSON(rows[0]));
  });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const rows = await query('SELECT * FROM pdfs WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'PDF not found' });
  const pdf = rows[0];

  if (pdf.filename) {
    fs.unlink(path.join(__dirname, '..', pdf.filename), () => {});
  }
  await query('DELETE FROM pdfs WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
