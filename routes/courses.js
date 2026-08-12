import express from 'express';
import { query } from '../db.js';
import { uploadThumbnail } from '../upload.js';

const router = express.Router();

function toCourseJSON(c) {
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
    category: c.category,
    price: Number(c.price),
    originalPrice: Number(c.original_price),
    tag: c.tag,
    thumbnail: c.thumbnail,
    status: c.status,
    studentsEnrolled: c.students_enrolled,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

router.get('/', async (req, res) => {
  const courses = await query('SELECT * FROM courses ORDER BY created_at DESC');
  const chapters = await query('SELECT id, course_id FROM chapters');
  const videos = await query('SELECT id, course_id FROM videos');

  const result = courses.map((c) => ({
    ...toCourseJSON(c),
    chapterCount: chapters.filter((ch) => ch.course_id === c.id).length,
    videoCount: videos.filter((v) => v.course_id === c.id).length
  }));
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const courses = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
  if (courses.length === 0) return res.status(404).json({ error: 'Course not found' });
  const course = courses[0];

  const chapterRows = await query(
    'SELECT * FROM chapters WHERE course_id = $1 ORDER BY chapter_order ASC',
    [req.params.id]
  );
  const videoRows = await query('SELECT * FROM videos WHERE course_id = $1', [req.params.id]);
  const pdfRows = await query('SELECT * FROM pdfs WHERE course_id = $1', [req.params.id]);

  const chapters = chapterRows.map((ch) => ({
    id: ch.id,
    courseId: ch.course_id,
    title: ch.title,
    order: ch.chapter_order,
    status: ch.status,
    videos: videoRows
      .filter((v) => v.chapter_id === ch.id)
      .sort((a, b) => a.video_order - b.video_order),
    pdfs: pdfRows.filter((p) => p.chapter_id === ch.id)
  }));

  res.json({ ...toCourseJSON(course), chapters });
});

router.post('/', uploadThumbnail.single('thumbnail'), async (req, res) => {
  const { title, subtitle, description, category, price, originalPrice, tag, status } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price are required' });

  const thumbnail = req.file ? `/uploads/thumbnails/${req.file.filename}` : null;

  const rows = await query(
    `INSERT INTO courses (title, subtitle, description, category, price, original_price, tag, thumbnail, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      title,
      subtitle || '',
      description || '',
      category || 'General',
      Number(price),
      Number(originalPrice) || Number(price),
      tag || '',
      thumbnail,
      status || 'draft'
    ]
  );
  res.status(201).json(toCourseJSON(rows[0]));
});

router.put('/:id', uploadThumbnail.single('thumbnail'), async (req, res) => {
  const existing = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ error: 'Course not found' });
  const course = existing[0];

  const { title, subtitle, description, category, price, originalPrice, tag, status } = req.body;
  const thumbnail = req.file ? `/uploads/thumbnails/${req.file.filename}` : course.thumbnail;

  const rows = await query(
    `UPDATE courses SET
      title=$1, subtitle=$2, description=$3, category=$4, price=$5,
      original_price=$6, tag=$7, status=$8, thumbnail=$9, updated_at=now()
     WHERE id=$10 RETURNING *`,
    [
      title ?? course.title,
      subtitle ?? course.subtitle,
      description ?? course.description,
      category ?? course.category,
      price !== undefined ? Number(price) : course.price,
      originalPrice !== undefined ? Number(originalPrice) : course.original_price,
      tag ?? course.tag,
      status ?? course.status,
      thumbnail,
      req.params.id
    ]
  );
  res.json(toCourseJSON(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const rows = await query('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Course not found' });
  res.json({ success: true });
});

export default router;
