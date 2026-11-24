import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const createInput = z.object({ code: z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']), value: z.coerce.number().nonnegative(), minimumOrder: z.coerce.number().nonnegative().optional(), maximumDiscount: z.coerce.number().nonnegative().optional(), usageLimit: z.coerce.number().int().positive().optional(), startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(), active: z.boolean().default(true) });
const validateInput = z.object({ code: z.string().min(3), subtotal: z.coerce.number().nonnegative(), shipping: z.coerce.number().nonnegative().default(0) });
const endOfExpiryDay = (value?: Date) => { if (!value) return value; const expiry = new Date(value); expiry.setHours(23, 59, 59, 999); return expiry; };

router.post('/', requireAuth, requireRole('ADMIN'), requirePermission('coupons.manage'), async (request, response, next) => {
  try { const input = createInput.parse(request.body); if (input.type === 'PERCENTAGE' && input.value > 100) return response.status(400).json({ error: 'Percentage coupons cannot exceed 100' }); const coupon = await prisma.coupon.create({ data: { ...input, expiresAt: endOfExpiryDay(input.expiresAt), code: input.code.toUpperCase() } }); return response.status(201).json({ data: coupon }); } catch (error) { return next(error); }
});

router.get('/', requireAuth, requirePermission('coupons.read'), async (_request, response, next) => { try { return response.json({ data: await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }) }); } catch (error) { return next(error); } });

router.patch('/:couponId', requireAuth, requireRole('ADMIN'), requirePermission('coupons.manage'), async (request, response, next) => { try { const couponId = request.params.couponId; if (typeof couponId !== 'string') return response.status(400).json({ error: 'Invalid coupon ID' }); const input = createInput.partial().parse(request.body); if (input.type === 'PERCENTAGE' && input.value !== undefined && input.value > 100) return response.status(400).json({ error: 'Percentage coupons cannot exceed 100' }); const coupon = await prisma.coupon.update({ where: { id: couponId }, data: { ...input, ...(input.expiresAt ? { expiresAt: endOfExpiryDay(input.expiresAt) } : {}), ...(input.code ? { code: input.code.toUpperCase() } : {}) } }); return response.json({ data: coupon }); } catch (error) { return next(error); } });
router.delete('/:couponId', requireAuth, requireRole('ADMIN'), requirePermission('coupons.manage'), async (request, response, next) => { try { const couponId = request.params.couponId; if (typeof couponId !== 'string') return response.status(400).json({ error: 'Invalid coupon ID' }); await prisma.coupon.update({ where: { id: couponId }, data: { active: false } }); return response.status(204).send(); } catch (error) { return next(error); } });

router.post('/validate', requireAuth, async (request, response, next) => {
  try {
    const input = validateInput.parse(request.body);
    const coupon = await prisma.coupon.findUnique({ where: { code: input.code.toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) return response.status(400).json({ error: 'Coupon is invalid or expired' });
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return response.status(400).json({ error: 'Coupon usage limit reached' });
    if (coupon.minimumOrder !== null && input.subtotal < Number(coupon.minimumOrder)) return response.status(400).json({ error: `Minimum order is ${coupon.minimumOrder}` });
    const usedByUser = await prisma.couponRedemption.findUnique({ where: { couponId_userId: { couponId: coupon.id, userId: request.user!.id } } });
    if (usedByUser) return response.status(400).json({ error: 'Coupon already used by this customer' });
    let discount = 0;
    if (coupon.type === 'PERCENTAGE') discount = input.subtotal * Number(coupon.value) / 100;
    if (coupon.type === 'FIXED_AMOUNT') discount = Number(coupon.value);
    if (coupon.type === 'FREE_SHIPPING') discount = input.shipping;
    if (coupon.maximumDiscount !== null) discount = Math.min(discount, Number(coupon.maximumDiscount));
    discount = Math.min(discount, input.subtotal + (coupon.type === 'FREE_SHIPPING' ? input.shipping : 0));
    return response.json({ data: { code: coupon.code, type: coupon.type, discount: Number(discount.toFixed(2)), shipping: coupon.type === 'FREE_SHIPPING' ? 0 : input.shipping } });
  } catch (error) { return next(error); }
});

export default router;
