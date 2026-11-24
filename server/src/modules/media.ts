import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const uploadDirectory = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({ storage, limits: { files: 12, fileSize: 8 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) });
const avatarUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) });
const kycUpload = multer({ storage, limits: { files: 12, fileSize: 8 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) || file.mimetype === 'application/pdf') });

router.post('/upload', requireAuth, requirePermission('products.update'), upload.array('images', 12), (request, response) => {
  const files = (request.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) return response.status(400).json({ error: 'At least one valid image is required' });
  return response.status(201).json({ data: files.map((file) => ({ url: `/uploads/${file.filename}`, filename: file.filename, altText: file.originalname })) });
});

router.post('/avatar', requireAuth, avatarUpload.single('image'), async (request, response, next) => {
  try { const file = request.file; if (!file) return response.status(400).json({ error: 'A valid profile image is required' }); const avatarUrl = `/uploads/${file.filename}`; await prisma.user.update({ where: { id: request.user!.id }, data: { avatarUrl } }); return response.status(201).json({ data: { avatarUrl } }); } catch (error) { return next(error); }
});

router.post('/kyc', requireAuth, requireRole('STAFF', 'ADMIN'), kycUpload.fields([{ name: 'documents', maxCount: 12 }, { name: 'proofOfAddress', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), (request, response) => {
  const fileFields = (request.files as { [fieldname: string]: Express.Multer.File[] } | undefined) || {};
  const files = fileFields.documents || [];
  if (!files.length) return response.status(400).json({ error: 'At least one valid KYC document image is required' });
  const urls = files.map((file) => `/uploads/${file.filename}`);
  const payload: Record<string, unknown> = { documentUrl: urls[0], documents: urls };
  if (fileFields.proofOfAddress?.[0]) payload.proofOfAddressUrl = `/uploads/${fileFields.proofOfAddress[0].filename}`;
  if (fileFields.selfie?.[0]) payload.selfieUrl = `/uploads/${fileFields.selfie[0].filename}`;
  return response.status(201).json({ data: payload });
});

export default router;
