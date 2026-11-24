import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { allPermissions, requirePermission, roleHasPermission, type Permission } from '../middleware/permissions';

const router = Router();
const statusInput = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING']) });
const roleInput = z.object({ role: z.enum(['CUSTOMER', 'ADMIN', 'STAFF', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF']) });
const profileInput = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80) });
const createUserInput = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email(), password: z.string().min(8).max(128), role: z.enum(['CUSTOMER', 'ADMIN', 'STAFF', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF']).default('CUSTOMER'), status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING']).default('ACTIVE') });
const manageUserInput = z.object({ firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(80).optional(), email: z.string().trim().email().optional(), password: z.string().min(8).max(128).optional() }).refine((input) => Object.keys(input).length > 0, 'At least one account field is required');
const kycInput = z.object({ documentType: z.string().trim().min(2).max(80), documentNumber: z.string().trim().min(2).max(120), documentUrl: z.string().url().optional(), documents: z.array(z.string().url()).max(12).optional(), notes: z.string().trim().max(1000).optional(), aliases: z.string().trim().max(500).optional(), dateOfBirth: z.coerce.date().optional(), nationality: z.string().trim().min(2).max(80).optional(), currentAddress: z.string().trim().min(5).max(500).optional(), previousAddresses: z.array(z.string().trim().min(5).max(500)).max(10).optional(), proofOfAddressUrl: z.string().url().optional(), selfieUrl: z.string().url().optional(), ndaSigned: z.boolean().optional(), acceptableUsePolicyAccepted: z.boolean().optional(), accessTier: z.enum(['LEVEL_1_SUPPORT', 'LEVEL_2_OPERATIONS', 'LEVEL_3_FINANCE_EXECUTIVE']).optional() });
const kycReviewInput = z.object({ status: z.enum(['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED']), reviewReason: z.string().trim().max(1000).optional(), identityVerificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED']).optional(), documentVerificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED']).optional(), addressVerificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED']).optional(), backgroundCheckStatus: z.enum(['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED']).optional(), criminalRecordStatus: z.enum(['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED']).optional(), sanctionsPepStatus: z.enum(['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED']).optional(), adverseMediaStatus: z.enum(['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED']).optional(), employmentVerificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED']).optional(), screeningNotes: z.string().trim().max(2000).optional(), accessTier: z.enum(['LEVEL_1_SUPPORT', 'LEVEL_2_OPERATIONS', 'LEVEL_3_FINANCE_EXECUTIVE']).optional(), verificationProvider: z.string().trim().max(100).optional(), verificationReference: z.string().trim().max(160).optional(), ndaSigned: z.boolean().optional(), acceptableUsePolicyAccepted: z.boolean().optional() }).superRefine((input, context) => { if (input.status === 'REJECTED' && !input.reviewReason) context.addIssue({ code: 'custom', path: ['reviewReason'], message: 'A rejection reason is required' }); if (input.status === 'APPROVED' && (input.identityVerificationStatus !== 'VERIFIED' || input.documentVerificationStatus !== 'VERIFIED' || input.addressVerificationStatus !== 'VERIFIED' || input.backgroundCheckStatus !== 'CLEAR' || input.criminalRecordStatus !== 'CLEAR' || input.sanctionsPepStatus !== 'CLEAR' || input.adverseMediaStatus !== 'CLEAR' || input.employmentVerificationStatus !== 'CLEAR' || input.ndaSigned !== true || input.acceptableUsePolicyAccepted !== true)) context.addIssue({ code: 'custom', path: ['status'], message: 'All identity, screening, and agreement checks must be cleared before approval' }); });
const permissionInput = z.object({ permissions: z.array(z.object({ permission: z.enum(allPermissions as [Permission, ...Permission[]]), granted: z.boolean() })).max(allPermissions.length) });

export function normalizeKycSubmitBody(input: Record<string, unknown> = {}) {
  const value = (key: string, fallback?: string) => {
    const raw = input[key];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : fallback;
    }
    return typeof raw === 'boolean' || typeof raw === 'number' || typeof raw === 'object' ? raw : fallback;
  };

  const documents = Array.isArray(input.documents) ? input.documents.map((item) => String(item).trim()).filter(Boolean) : undefined;
  const documentUrl = typeof input.documentUrl === 'string' ? input.documentUrl.trim() : undefined;
  const proofOfAddressUrl = typeof input.proofOfAddressUrl === 'string' ? input.proofOfAddressUrl.trim() : undefined;
  const selfieUrl = typeof input.selfieUrl === 'string' ? input.selfieUrl.trim() : undefined;
  const previousAddresses = Array.isArray(input.previousAddresses) ? input.previousAddresses.map((item) => String(item).trim()).filter(Boolean) : undefined;

  return {
    documentType: value('documentType'),
    documentNumber: value('documentNumber'),
    documentUrl: documentUrl || (documents?.[0] ?? undefined),
    documents: documents?.length ? documents : undefined,
    notes: value('notes', undefined),
    aliases: value('aliases', undefined),
    dateOfBirth: value('dateOfBirth', undefined),
    nationality: value('nationality', undefined),
    currentAddress: value('currentAddress', undefined),
    previousAddresses: previousAddresses?.length ? previousAddresses : undefined,
    proofOfAddressUrl,
    selfieUrl,
    ndaSigned: typeof input.ndaSigned === 'boolean' ? input.ndaSigned : input.ndaSigned === 'true',
    acceptableUsePolicyAccepted: typeof input.acceptableUsePolicyAccepted === 'boolean' ? input.acceptableUsePolicyAccepted : input.acceptableUsePolicyAccepted === 'true',
    accessTier: value('accessTier', 'LEVEL_1_SUPPORT')
  };
}

router.get('/me', requireAuth, async (request, response, next) => { try { const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, emailVerified: true, lastLoginAt: true, createdAt: true, avatarUrl: true, addresses: true, permissionOverrides: { select: { permission: true, granted: true } }, kycApplication: { include: { documents: { select: { url: true } } } } } }); if (!user) return response.status(404).json({ error: 'User not found' }); const kycApplication = user.kycApplication ? { ...user.kycApplication, documents: user.kycApplication.documents.map((document) => document.url) } : null; const permissions = allPermissions.filter((permission) => { const override = user.permissionOverrides.find((item) => item.permission === permission); return override ? override.granted : roleHasPermission(user.role, permission); }); return response.json({ data: { ...user, kycApplication, permissions } }); } catch (error) { return next(error); } });
router.patch('/me', requireAuth, async (request, response, next) => { try { const input = profileInput.parse(request.body); const user = await prisma.user.update({ where: { id: request.user!.id }, data: input, select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true, avatarUrl: true } }); return response.json({ data: user }); } catch (error) { return next(error); } });
router.post('/me/kyc', requireAuth, async (request, response, next) => { try { if (request.user!.role === 'CUSTOMER') return response.status(403).json({ error: 'Only internal staff can submit KYC' }); const normalized = normalizeKycSubmitBody(request.body as Record<string, unknown>); const input = kycInput.parse(normalized); const submittedDocuments = Array.from(new Set([...(input.documents || []), ...(input.documentUrl ? [input.documentUrl] : [])].map((value) => String(value).trim()).filter(Boolean))); if (!submittedDocuments.length || !input.proofOfAddressUrl || !input.selfieUrl || !input.dateOfBirth || !input.nationality || !input.currentAddress || input.ndaSigned !== true || input.acceptableUsePolicyAccepted !== true) return response.status(400).json({ error: 'Complete identity, address, selfie, and compliance agreement requirements before submitting KYC' }); const application = await prisma.$transaction(async (tx) => { const existing = await tx.kycApplication.upsert({ where: { userId: request.user!.id }, create: { userId: request.user!.id, documentType: input.documentType, documentNumber: input.documentNumber, documentUrl: submittedDocuments[0], notes: input.notes || null, aliases: input.aliases || null, dateOfBirth: input.dateOfBirth, nationality: input.nationality, currentAddress: input.currentAddress, previousAddresses: input.previousAddresses || [], proofOfAddressUrl: input.proofOfAddressUrl, selfieUrl: input.selfieUrl, identityVerificationStatus: 'PENDING', documentVerificationStatus: 'PENDING', addressVerificationStatus: 'PENDING', backgroundCheckStatus: 'PENDING', criminalRecordStatus: 'PENDING', sanctionsPepStatus: 'PENDING', adverseMediaStatus: 'PENDING', employmentVerificationStatus: 'PENDING', accessTier: input.accessTier || 'LEVEL_1_SUPPORT', ndaSigned: true, acceptableUsePolicyAccepted: true, agreementSignedAt: new Date(), nextReviewAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }, update: { documentType: input.documentType, documentNumber: input.documentNumber, documentUrl: submittedDocuments[0], notes: input.notes || null, aliases: input.aliases || null, dateOfBirth: input.dateOfBirth, nationality: input.nationality, currentAddress: input.currentAddress, previousAddresses: input.previousAddresses || [], proofOfAddressUrl: input.proofOfAddressUrl, selfieUrl: input.selfieUrl, status: 'PENDING', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewReason: null, identityVerificationStatus: 'PENDING', documentVerificationStatus: 'PENDING', addressVerificationStatus: 'PENDING', backgroundCheckStatus: 'PENDING', criminalRecordStatus: 'PENDING', sanctionsPepStatus: 'PENDING', adverseMediaStatus: 'PENDING', employmentVerificationStatus: 'PENDING', accessTier: input.accessTier || 'LEVEL_1_SUPPORT', ndaSigned: true, acceptableUsePolicyAccepted: true, agreementSignedAt: new Date(), screenedAt: null, accessGrantedAt: null, revokedAt: null, revocationReason: null, nextReviewAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } }); await tx.kycDocument.deleteMany({ where: { applicationId: existing.id } }); await tx.kycDocument.createMany({ data: submittedDocuments.map((url) => ({ applicationId: existing.id, url })) }); return { ...existing, documents: submittedDocuments }; }); return response.status(201).json({ data: application }); } catch (error) { return next(error); } });
router.get('/kyc', requireAuth, requireRole('ADMIN'), async (_request, response, next) => { try { const applications = await prisma.kycApplication.findMany({ include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, createdAt: true } }, documents: { select: { url: true } } }, orderBy: { submittedAt: 'desc' } }); return response.json({ data: applications.map((application) => ({ ...application, documents: application.documents.map((document) => document.url) })) }); } catch (error) { return next(error); } });
router.patch('/kyc/:applicationId', requireAuth, requireRole('ADMIN'), async (request, response, next) => { try { const applicationId = request.params.applicationId; if (typeof applicationId !== 'string') return response.status(400).json({ error: 'Invalid KYC application ID' }); const parsedInput = kycReviewInput.parse(request.body); const input = { ...parsedInput, status: parsedInput.status === 'PENDING' ? 'PROCESSING' as const : parsedInput.status }; const application = await prisma.kycApplication.update({ where: { id: applicationId }, data: { status: input.status, reviewReason: input.reviewReason, reviewedAt: input.status === 'PROCESSING' ? null : new Date(), reviewedById: request.user!.id, ...(input.identityVerificationStatus ? { identityVerificationStatus: input.identityVerificationStatus } : {}), ...(input.documentVerificationStatus ? { documentVerificationStatus: input.documentVerificationStatus } : {}), ...(input.addressVerificationStatus ? { addressVerificationStatus: input.addressVerificationStatus } : {}), ...(input.backgroundCheckStatus ? { backgroundCheckStatus: input.backgroundCheckStatus } : {}), ...(input.criminalRecordStatus ? { criminalRecordStatus: input.criminalRecordStatus } : {}), ...(input.sanctionsPepStatus ? { sanctionsPepStatus: input.sanctionsPepStatus } : {}), ...(input.adverseMediaStatus ? { adverseMediaStatus: input.adverseMediaStatus } : {}), ...(input.employmentVerificationStatus ? { employmentVerificationStatus: input.employmentVerificationStatus } : {}), ...(input.screeningNotes !== undefined ? { screeningNotes: input.screeningNotes } : {}), ...(input.accessTier ? { accessTier: input.accessTier } : {}), ...(input.verificationProvider !== undefined ? { verificationProvider: input.verificationProvider } : {}), ...(input.verificationReference !== undefined ? { verificationReference: input.verificationReference } : {}), ...(input.ndaSigned !== undefined ? { ndaSigned: input.ndaSigned } : {}), ...(input.acceptableUsePolicyAccepted !== undefined ? { acceptableUsePolicyAccepted: input.acceptableUsePolicyAccepted } : {}), ...(input.status === 'APPROVED' ? { accessGrantedAt: new Date(), revokedAt: null, revocationReason: null } : input.status === 'REJECTED' ? { accessGrantedAt: null } : {}) }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }); await prisma.auditLog.create({ data: { userId: request.user!.id, action: `KYC_${input.status}`, entity: 'KycApplication', entityId: application.id, metadata: { reason: input.reviewReason || null, accessTier: input.accessTier || null } } }); return response.json({ data: application }); } catch (error) { return next(error); } });

router.post('/kyc/:applicationId/revoke', requireAuth, requireRole('ADMIN'), async (request, response, next) => { try { const applicationId = request.params.applicationId; if (typeof applicationId !== 'string') return response.status(400).json({ error: 'Invalid KYC application ID' }); const reason = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(request.body).reason; const application = await prisma.kycApplication.update({ where: { id: applicationId }, data: { status: 'REJECTED', revokedAt: new Date(), revocationReason: reason, accessGrantedAt: null, reviewReason: reason, reviewedAt: new Date(), reviewedById: request.user!.id }, select: { id: true, userId: true, status: true, revokedAt: true, revocationReason: true } }); await prisma.user.update({ where: { id: application.userId }, data: { status: 'SUSPENDED' } }); await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'KYC_ACCESS_REVOKED', entity: 'KycApplication', entityId: application.id, metadata: { reason } } }); return response.json({ data: application }); } catch (error) { return next(error); } });

router.get('/', requireAuth, requirePermission('users.read'), async (request, response, next) => {
  try {
    const query = z.object({ search: z.string().optional(), role: z.enum(['CUSTOMER', 'ADMIN', 'STAFF', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF']).optional(), status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING']).optional(), take: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    const users = await prisma.user.findMany({ where: { deletedAt: null, ...(query.role ? { role: query.role } : {}), ...(query.status ? { status: query.status } : {}), ...(query.search ? { OR: [{ email: { contains: query.search } }, { firstName: { contains: query.search } }, { lastName: { contains: query.search } }] } : {}) }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, emailVerified: true, lastLoginAt: true, createdAt: true, avatarUrl: true, addresses: true, kycApplication: true, permissionOverrides: { select: { permission: true, granted: true } } }, orderBy: { createdAt: 'desc' }, take: query.take });
    return response.json({ data: users.map((user) => ({ ...user, permissions: allPermissions.filter((permission) => { const override = user.permissionOverrides.find((item) => item.permission === permission); return override ? override.granted : roleHasPermission(user.role, permission); }) })) });
  } catch (error) { return next(error); }
});

router.post('/', requireAuth, requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = createUserInput.parse(request.body);
    const email = input.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return response.status(409).json({ error: 'An account with that email already exists' });
    const user = await prisma.user.create({ data: { firstName: input.firstName, lastName: input.lastName, email, passwordHash: await bcrypt.hash(input.password, 12), role: input.role, status: input.status, emailVerified: input.status === 'ACTIVE' }, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, emailVerified: true, createdAt: true } });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'USER_CREATED', entity: 'User', entityId: user.id, metadata: { name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, role: user.role, status: user.status } } });
    return response.status(201).json({ data: user });
  } catch (error) { return next(error); }
});

router.patch('/:userId/account', requireAuth, requirePermission('users.manage'), async (request, response, next) => {
  try {
    const userId = request.params.userId;
    if (typeof userId !== 'string') return response.status(400).json({ error: 'Invalid user ID' });
    const input = manageUserInput.parse(request.body);
    const { password, ...profile } = input;
    const data = { ...profile, ...(profile.email ? { email: profile.email.toLowerCase() } : {}), ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) };
    const user = await prisma.user.update({ where: { id: userId }, data, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, emailVerified: true } });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'USER_ACCOUNT_UPDATED', entity: 'User', entityId: user.id, metadata: { fields: Object.keys(input).filter((field) => field !== 'password') } } });
    return response.json({ data: user });
  } catch (error) { return next(error); }
});

router.patch('/:userId/status', requireAuth, requirePermission('users.manage'), async (request, response, next) => {
  try { const userId = request.params.userId; if (typeof userId !== 'string') return response.status(400).json({ error: 'Invalid user ID' }); const input = statusInput.parse(request.body); const user = await prisma.user.update({ where: { id: userId }, data: { status: input.status }, select: { id: true, email: true, status: true } }); await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'USER_STATUS_UPDATED', entity: 'User', entityId: user.id, metadata: { status: input.status } } }); return response.json({ data: user }); } catch (error) { return next(error); }
});

router.patch('/:userId/role', requireAuth, requirePermission('staff.roles'), async (request, response, next) => {
  try { const userId = request.params.userId; if (typeof userId !== 'string') return response.status(400).json({ error: 'Invalid user ID' }); const input = roleInput.parse(request.body); if (userId === request.user!.id && input.role !== 'ADMIN') return response.status(400).json({ error: 'You cannot remove your own admin role' }); const user = await prisma.user.update({ where: { id: userId }, data: { role: input.role }, select: { id: true, email: true, role: true } }); await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'USER_ROLE_UPDATED', entity: 'User', entityId: user.id, metadata: { role: input.role } } }); return response.json({ data: user }); } catch (error) { return next(error); }
});

router.patch('/:userId/permissions', requireAuth, requirePermission('staff.roles'), async (request, response, next) => {
  try {
    const userId = request.params.userId;
    if (typeof userId !== 'string') return response.status(400).json({ error: 'Invalid user ID' });
    const input = permissionInput.parse(request.body);
    const unavailable = input.permissions.filter((item) => !roleHasPermission(request.user!.role, item.permission));
    if (unavailable.length) return response.status(403).json({ error: `You cannot grant permissions you do not have: ${unavailable.map((item) => item.permission).join(', ')}` });
    await prisma.$transaction(input.permissions.map((item) => prisma.userPermission.upsert({ where: { userId_permission: { userId, permission: item.permission } }, create: { userId, permission: item.permission, granted: item.granted }, update: { granted: item.granted } })));
    const overrides = await prisma.userPermission.findMany({ where: { userId }, select: { permission: true, granted: true } });
    return response.json({ data: overrides });
  } catch (error) { return next(error); }
});

export default router;
