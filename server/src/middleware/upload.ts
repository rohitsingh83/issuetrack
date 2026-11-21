import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!ALLOWED_UPLOAD_MIME.includes(file.mimetype)) {
    cb(
      new ApiError(
        400,
        'Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, PDF',
        'INVALID_FILE_TYPE',
      ),
    );
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 },
});

export function safeUnlink(filename: string): void {
  const target = path.resolve(uploadDir, path.basename(filename));
  if (!target.startsWith(uploadDir)) return;
  fs.promises.unlink(target).catch(() => undefined);
}

export { uploadDir };
