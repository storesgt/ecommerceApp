import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response, next) => { try { const notifications = await prisma.notification.findMany({ where: { userId: request.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 }); return response.json({ data: notifications, unread: notifications.filter((notification) => !notification.readAt).length }); } catch (error) { return next(error); } });
router.patch('/:notificationId/read', async (request, response, next) => { try { const notificationId = request.params.notificationId; if (typeof notificationId !== 'string') return response.status(400).json({ error: 'Invalid notification ID' }); const notification = await prisma.notification.updateMany({ where: { id: notificationId, userId: request.user!.id }, data: { readAt: new Date() } }); if (!notification.count) return response.status(404).json({ error: 'Notification not found' }); return response.status(204).send(); } catch (error) { return next(error); } });
router.patch('/read-all', async (request, response, next) => { try { await prisma.notification.updateMany({ where: { userId: request.user!.id, readAt: null }, data: { readAt: new Date() } }); return response.status(204).send(); } catch (error) { return next(error); } });
router.get('/preferences', async (request, response, next) => { try { const preferences = await prisma.notificationPreference.upsert({ where: { userId: request.user!.id }, create: { userId: request.user!.id }, update: {} }); return response.json({ data: preferences }); } catch (error) { return next(error); } });
router.patch('/preferences', async (request, response, next) => { try { const input = z.object({ orderEmails: z.boolean().optional(), promotions: z.boolean().optional(), lowStock: z.boolean().optional() }).parse(request.body); const preferences = await prisma.notificationPreference.upsert({ where: { userId: request.user!.id }, create: { userId: request.user!.id, ...input }, update: input }); return response.json({ data: preferences }); } catch (error) { return next(error); } });
export default router;