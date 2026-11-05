import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config';

/**
 * Uploads.
 *
 * Reuses `config.upload` (dir `./uploads`, 10 MB limit) — that limit is what
 * caps a product clip, so keep videos short or raise it in the environment.
 * Payment proofs land in UPLOAD_ROOT itself and are only ever read back through
 * the authenticated `/api/v1/payments/proof/:paymentId` route; storefront
 * content images and clips land in the `content/` subdirectory and are public.
 */
export const UPLOAD_ROOT = path.resolve(config.upload.uploadDir);

try {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
} catch (error) {
  console.error('[upload] could not create uploads directory', UPLOAD_ROOT, error);
}

// Proof of payment is an image; ignore the video mimes the general uploader allows.
const IMAGE_MIMES = config.upload.allowedMimeTypes.filter((mime) => mime.startsWith('image/'));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10) || '.jpg';
    cb(null, `proof-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  }
};

export const proofUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 1 },
}).single('file');

/**
 * Images and clips the admin publishes as storefront content.
 *
 * These are world-readable, so they live in their own subdirectory: the public
 * read route can only ever see this folder and never the payment proofs that
 * share UPLOAD_ROOT.
 */
export const CONTENT_UPLOAD_ROOT = path.join(UPLOAD_ROOT, 'content');

// Extension chosen from the mime type multer sniffed, so a stored file can never
// be served as something other than what it actually is.
const CONTENT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const MEDIA_MIMES = Object.keys(CONTENT_EXTENSIONS);

try {
  fs.mkdirSync(CONTENT_UPLOAD_ROOT, { recursive: true });
} catch (error) {
  console.error('[upload] could not create content directory', CONTENT_UPLOAD_ROOT, error);
}

const contentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CONTENT_UPLOAD_ROOT);
  },
  // Extension comes from the mime type multer sniffed, never from the uploaded
  // filename, so a stored file cannot be served as something it is not.
  filename: (_req, file, cb) => {
    const ext = CONTENT_EXTENSIONS[file.mimetype] || '.jpg';
    cb(null, `content-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const mediaFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (MEDIA_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  }
};

export const contentMediaUpload = multer({
  storage: contentStorage,
  fileFilter: mediaFileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 1 },
}).single('file');

/** The public path a stored content image or clip is read back from. */
export const contentMediaUrl = (filename: string): string => `/api/v1/cms/media/${filename}`;

export default proofUpload;
