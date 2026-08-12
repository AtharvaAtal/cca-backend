import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDB } from './db.js';

import coursesRouter from './routes/courses.js';
import chaptersRouter from './routes/chapters.js';
import videosRouter from './routes/videos.js';
import analyticsRouter from './routes/analytics.js';
import studentsRouter from './routes/students.js';
import authRouter from './routes/auth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/videos', videosRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/students', studentsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'CCA Admin API running' }));

await initDB();

app.listen(PORT, () => {
  console.log(`\n  CCA Admin Backend running -> http://localhost:${PORT}`);
  console.log(`  Uploads served from       -> http://localhost:${PORT}/uploads\n`);
});
