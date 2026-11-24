import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const requestInput = z.object({ orderId: z.string().cuid(), orderItemId: z.string().cuid().optional(), quantity: z.coerce.number().int().positive().optional(), amount: z.coerce.number().positive(), reason: z.string().min(5).max(500), notes: z.string().max(1000).optional() });
const statusInput = z.object({ status: z.enum(['APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED']), notes: z.string().max(1000).optional() });

router.get('/', requireAuth, async (request, response, next) => { try { const refunds = await prisma.refund.findMany({ where: request.user!.role === 'CUSTOMER' ? { userId: request.user!.id } : {}, include: { order: { select: { orderNumber: true, total: true } }, orderItem: { select: { name: true, sku: true, quantity: true, unitPrice: true } }, user: { select: { firstName: true, lastName: true, email: true } }, payment: { select: { reference: true, provider: true, status: true } } }, orderBy: { createdAt: 'desc' } }); return response.json({ data: refunds }); } catch (error) { return next(error); } });

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = requestInput.parse(request.body);
    const order = await prisma.order.findFirst({ where: { id: input.orderId, userId: request.user!.id, status: { in: ['DELIVERED', 'RETURNED'] } }, include: { items: true, payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 1 } } });
    if (!order || !order.payments[0]) return response.status(400).json({ error: 'Only delivered orders with a successful payment can be refunded' });
    if (input.amount > Number(order.total)) return response.status(400).json({ error: 'Refund cannot exceed the order total' });
    const orderItem = input.orderItemId ? order.items.find((item) => item.id === input.orderItemId) : undefined;
    if (input.orderItemId && !orderItem) return response.status(400).json({ error: 'Selected item does not belong to this order' });
    if (input.quantity && orderItem && input.quantity > orderItem.quantity) return response.status(400).json({ error: 'Return quantity cannot exceed the purchased quantity' });
    const refund = await prisma.refund.create({ data: { orderId: order.id, orderItemId: orderItem?.id, quantity: input.quantity || (orderItem ? orderItem.quantity : undefined), paymentId: order.payments[0].id, userId: request.user!.id, amount: input.amount, reason: input.reason, notes: input.notes } });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'RETURN_REQUESTED' } });
    return response.status(201).json({ data: refund });
  } catch (error) { return next(error); }
});

router.patch('/:refundId/status', requireAuth, requirePermission('orders.refund'), async (request, response, next) => { try { const refundId = request.params.refundId; if (typeof refundId !== 'string') return response.status(400).json({ error: 'Invalid refund ID' }); const input = statusInput.parse(request.body); const refund = await prisma.refund.update({ where: { id: refundId }, data: { status: input.status, notes: input.notes } }); if (input.status === 'COMPLETED') await prisma.$transaction([prisma.payment.update({ where: { id: refund.paymentId }, data: refund.orderItemId ? { status: 'PARTIALLY_REFUNDED' } : { status: 'REFUNDED' } }), prisma.order.update({ where: { id: refund.orderId }, data: refund.orderItemId ? { status: 'RETURNED', paymentStatus: 'PARTIALLY_REFUNDED' } : { status: 'REFUNDED', paymentStatus: 'REFUNDED' } })]); await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'REFUND_STATUS_UPDATED', entity: 'Refund', entityId: refund.id, metadata: { status: input.status, orderItemId: refund.orderItemId } } }); return response.json({ data: refund }); } catch (error) { return next(error); } });

export default router;
