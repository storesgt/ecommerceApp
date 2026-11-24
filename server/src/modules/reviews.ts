import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const reviewInput = z.object({ rating: z.number().int().min(1).max(5), title: z.string().max(120).optional(), body: z.string().min(10).max(3000) });
const moderationInput = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']) });

router.get('/product/:productId', async (request, response, next) => {
  try {
    const productId = request.params.productId;
    if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' });
    const reviews = await prisma.review.findMany({ where: { productId, status: 'APPROVED' }, select: { id: true, rating: true, title: true, body: true, verified: true, createdAt: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } });
    return response.json({ data: reviews });
  } catch (error) { return next(error); }
});

router.post('/product/:productId', requireAuth, async (request, response, next) => {
  try {
    const productId = request.params.productId;
    if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' });
    const input = reviewInput.parse(request.body);
    const purchased = await prisma.orderItem.findFirst({ where: { productId, order: { userId: request.user!.id, status: { in: ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] } } } });
    if (!purchased) return response.status(403).json({ error: 'You can review products after purchasing them' });
    const review = await prisma.review.upsert({ where: { productId_userId: { productId, userId: request.user!.id } }, create: { productId, userId: request.user!.id, ...input, status: 'APPROVED', verified: true }, update: { ...input, status: 'APPROVED', verified: true }, include: { product: { select: { name: true } } } });
    return response.status(200).json({ data: review });
  } catch (error) { return next(error); }
});

router.get('/moderation', requireAuth, requireRole('ADMIN', 'STAFF'), async (_request, response, next) => {
  try { return response.json({ data: await prisma.review.findMany({ where: { status: 'PENDING' }, include: { product: { select: { name: true } }, user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'asc' } }) }); } catch (error) { return next(error); }
});

router.patch('/:reviewId/status', requireAuth, requireRole('ADMIN', 'STAFF'), async (request, response, next) => {
  try {
    const reviewId = request.params.reviewId;
    if (typeof reviewId !== 'string') return response.status(400).json({ error: 'Invalid review ID' });
    const input = moderationInput.parse(request.body);
    const review = await prisma.review.update({ where: { id: reviewId }, data: { status: input.status } });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'REVIEW_MODERATED', entity: 'Review', entityId: review.id, metadata: { status: input.status } } });
    return response.json({ data: review });
  } catch (error) { return next(error); }
});

export default router;
