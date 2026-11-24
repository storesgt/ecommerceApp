import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { isMailerConfigured, sendVerificationEmail } from '../lib/mailer';

const router = Router();
const secret = process.env.JWT_SECRET || 'development-only-secret';
const credentials = z.object({ firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), email: z.string().email(), password: z.string().min(8).max(128) });

function tokenFor(user: { id: string; role: UserRole }) { return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '1h' }); }
function rawToken() { return crypto.randomBytes(32).toString('hex'); }
function tokenHash(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }

router.post('/register', async (request, response, next) => {
  try {
    const input = credentials.parse(request.body);
    const { password, ...profile } = input;
    const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) return response.status(409).json({ error: 'An account with that email already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationRequired = isMailerConfigured() || process.env.NODE_ENV === 'production';
    const user = await prisma.user.create({ data: { ...profile, email: profile.email.toLowerCase(), passwordHash, status: verificationRequired ? 'PENDING' : 'ACTIVE', emailVerified: !verificationRequired }, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } });
    const verificationToken = rawToken();
    await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: tokenHash(verificationToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail({ email: user.email, firstName: user.firstName, token: verificationToken });
    } catch (error) {
      console.error('Verification email could not be sent', error);
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: 'AUTH_REGISTER', entity: 'User', entityId: user.id, metadata: { email: user.email, role: user.role } } });
    return response.status(201).json({ user, emailSent, message: verificationRequired ? (emailSent ? 'Check your email to verify your account.' : 'Your account was created, but email delivery is not configured.') : 'Account created. You can sign in now.', ...(!verificationRequired ? {} : (!isMailerConfigured() || process.env.NODE_ENV !== 'production' ? { developmentVerificationToken: verificationToken } : {})) });
  } catch (error) { return next(error); }
});

router.post('/login', async (request, response, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string() }).parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(input.password, user.passwordHash))) return response.status(401).json({ error: 'Invalid email or password' });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'AUTH_LOGIN', entity: 'User', entityId: user.id, metadata: { email: user.email } } });
    return response.json({ user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }, token: tokenFor(user) });
  } catch (error) { return next(error); }
});

router.post('/logout', requireAuth, async (request, response, next) => { try { await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'AUTH_LOGOUT', entity: 'User', entityId: request.user!.id } }); return response.status(204).send(); } catch (error) { return next(error); } });

router.post('/forgot-password', async (request, response, next) => {
  try {
    const input = z.object({ email: z.string().email() }).parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) return response.json({ message: 'If the account exists, reset instructions have been created.' });
    const token = rawToken();
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    return response.json({ message: 'If the account exists, reset instructions have been created.', ...(process.env.NODE_ENV === 'production' ? {} : { developmentToken: token }) });
  } catch (error) { return next(error); }
});

router.post('/reset-password', async (request, response, next) => {
  try {
    const input = z.object({ token: z.string().length(64), password: z.string().min(8).max(128) }).parse(request.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(input.token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) return response.status(400).json({ error: 'Reset token is invalid or expired' });
    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.$transaction([prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }), prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
    return response.json({ message: 'Password updated successfully' });
  } catch (error) { return next(error); }
});

async function verifyEmailToken(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return false;
  await prisma.$transaction([prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true, status: 'ACTIVE' } }), prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
  return true;
}

router.get('/verify-email', async (request, response, next) => {
  try {
    const token = z.string().length(64).parse(request.query.token);
    if (!await verifyEmailToken(token)) return response.status(400).send('Verification link is invalid or expired.');
    return response.send('Email verified successfully. You can return to Ground and sign in.');
  } catch (error) { return next(error); }
});

router.post('/verify-email', async (request, response, next) => {
  try {
    const input = z.object({ token: z.string().length(64) }).parse(request.body);
    if (!await verifyEmailToken(input.token)) return response.status(400).json({ error: 'Verification token is invalid or expired' });
    return response.json({ message: 'Email verified successfully' });
  } catch (error) { return next(error); }
});

router.post('/change-password', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) }).parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return response.status(401).json({ error: 'Current password is incorrect' });
    if (input.currentPassword === input.newPassword) return response.status(400).json({ error: 'New password must be different' });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } });
    return response.json({ message: 'Password changed successfully' });
  } catch (error) { return next(error); }
});

export default router;
