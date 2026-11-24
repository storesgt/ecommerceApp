import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { generateChatAiReply } from '../lib/chat-ai';

const router = Router();
const messageInput = z.object({ body: z.string().trim().min(1).max(2000), userId: z.string().cuid().optional() });
router.use(requireAuth);

router.get('/presence', async (_request, response, next) => {
  try {
    const onlineSince = new Date(Date.now() - 15 * 60 * 1000);
    const staff = await prisma.user.findMany({ where: { role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', lastLoginAt: { gte: onlineSince }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true, lastLoginAt: true }, orderBy: { lastLoginAt: 'desc' } });
    return response.json({ data: staff });
  } catch (error) { return next(error); }
});

router.post('/assistant', async (request, response, next) => {
  try {
    if (request.user!.role !== 'CUSTOMER') return response.status(403).json({ error: 'The AI assistant is available to customers only' });
    const input = messageInput.pick({ body: true }).parse(request.body);
    const reply = await generateChatAiReply({ userId: request.user!.id, message: input.body });
    const messages = await prisma.$transaction([
      prisma.supportMessage.create({ data: { userId: request.user!.id, senderRole: 'CUSTOMER', body: input.body } }),
      prisma.supportMessage.create({ data: { userId: request.user!.id, senderRole: 'STAFF', body: reply.body, readAt: new Date() } })
    ]);
    return response.status(201).json({ data: { messages, handoff: reply.handoff } });
  } catch (error) { return next(error); }
});

router.get('/', async (request, response, next) => {
  try {
    const isStaff = request.user!.role !== 'CUSTOMER';
    const messages = await prisma.supportMessage.findMany({ where: isStaff ? {} : { userId: request.user!.id }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' }, take: 200 });
    return response.json({ data: messages });
  } catch (error) { return next(error); }
});

router.post('/', async (request, response, next) => {
  try {
    const input = messageInput.parse(request.body);
    if (request.user!.role !== 'CUSTOMER' && !input.userId) return response.status(400).json({ error: 'A customer is required for staff replies' });
    const userId = request.user!.role === 'CUSTOMER' ? request.user!.id : input.userId!;
    const message = await prisma.supportMessage.create({ data: { userId, senderId: request.user!.role === 'CUSTOMER' ? null : request.user!.id, senderRole: request.user!.role, body: input.body }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } });
    return response.status(201).json({ data: message });
  } catch (error) { return next(error); }
});

router.patch('/read', requirePermission('users.manage'), async (request, response, next) => {
  try { const userId = z.string().cuid().optional().parse(request.body?.userId); await prisma.supportMessage.updateMany({ where: { senderRole: 'CUSTOMER', readAt: null, ...(userId ? { userId } : {}) }, data: { readAt: new Date() } }); return response.status(204).send(); } catch (error) { return next(error); }
});

export default router;