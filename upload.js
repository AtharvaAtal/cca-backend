import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dirs = {
  video: path.join(__dirname, 'uploads', 'videos'),
  pdf: path.join(__dirname, 'uploads', 'pdfs'),
  thumbnail: path.join(__dirname, 'uploads', 'thumbnails')
};

Object.values(dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));

function storageFor(type) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs[type]),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  });
}

export const uploadVideo = multer({
  storage: storageFor('video'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only video files are allowed (mp4, mov, mkv, webm, avi)'));
  }
});

export const uploadThumbnail = multer({
  storage: storageFor('thumbnail'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, webp)'));
  }
});

export const uploadPdf = multer({
  storage: storageFor('pdf'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

// Combined uploader for video + thumbnail in one request
export const uploadVideoWithThumb = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, file.fieldname === 'thumbnail' ? dirs.thumbnail : dirs.video);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);
