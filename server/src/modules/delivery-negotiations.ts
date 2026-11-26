import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const requestInput = z.object({
  country: z.string().trim().min(2).max(80),
  requestedMethod: z.string().trim().min(2).max(100),
  weightKg: z.coerce.number().nonnegative().max(5000),
  note: z.string().trim().max(500).optional()
});
const decisionInput = z.object({
  status: z.enum(['APPROVED', 'DECLINED']),
  shippingMethodId: z.string().min(1).optional(),
  responseNote: z.string().trim().max(1000).optional()
}).superRefine((input, context) => {
  if (input.status === 'APPROVED' && !input.shippingMethodId) {
    context.addIssue({ code: 'custom', path: ['shippingMethodId'], message: 'Choose the final delivery method.' });
  }
  if (input.status === 'DECLINED' && !input.responseNote) {
    context.addIssue({ code: 'custom', path: ['responseNote'], message: 'Provide a reason for declining this request.' });
  }
});

router.post('/', requireAuth, async (request, response, next) => {
  try {
    if (request.user!.role !== 'CUSTOMER') return response.status(403).json({ error: 'Only customers can request a delivery method.' });
    const input = requestInput.parse(request.body);
    const pending = await prisma.deliveryNegotiation.findFirst({ where: { userId: request.user!.id, status: 'PENDING' } });
    if (pending) return response.status(409).json({ error: 'You already have a delivery method request awaiting review.' });
    const negotiation = await prisma.deliveryNegotiation.create({
      data: { userId: request.user!.id, country: input.country.toUpperCase(), requestedMethod: input.requestedMethod, weightKg: input.weightKg, note: input.note || null }
    });
    return response.status(201).json({ data: negotiation });
  } catch (error) { return next(error); }
});

router.get('/mine', requireAuth, async (request, response, next) => {
  try {
    const data = await prisma.deliveryNegotiation.findMany({
      where: { userId: request.user!.id },
      include: { approvedShippingMethod: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return response.json({ data });
  } catch (error) { return next(error); }
});

router.get('/admin', requireAuth, requirePermission('shipping.update'), async (_request, response, next) => {
  try {
    const [requests, methods] = await Promise.all([
      prisma.deliveryNegotiation.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          approvedShippingMethod: { select: { id: true, name: true } },
          order: { select: { orderNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.shippingMethod.findMany({ where: { active: true, zone: { active: true } }, include: { zone: true } })
    ]);
    const data = requests.map((negotiation) => ({
      ...negotiation,
      availableMethods: methods
        .filter((method) => Array.isArray(method.zone.countries) && method.zone.countries.some((country) => String(country).toUpperCase() === negotiation.country))
        .map((method) => ({
          id: method.id,
          name: method.name,
          estimatedDays: { min: method.minDays, max: method.maxDays }
        }))
    }));
    return response.json({ data });
  } catch (error) { return next(error); }
});

router.patch('/:id', requireAuth, requirePermission('shipping.update'), async (request, response, next) => {
  try {
    const id = request.params.id;
    if (typeof id !== 'string') return response.status(400).json({ error: 'Invalid delivery method request ID' });
    const input = decisionInput.parse(request.body);
    const updated = await prisma.$transaction(async (transaction) => {
      const negotiation = await transaction.deliveryNegotiation.findUnique({ where: { id } });
      if (!negotiation) throw new HttpError(404, 'Delivery method request not found');
      if (negotiation.status !== 'PENDING') throw new HttpError(409, 'This delivery method request has already been reviewed');
      let approvedShippingMethodId: string | null = null;
      let methodName = '';
      if (input.status === 'APPROVED') {
        const method = await transaction.shippingMethod.findFirst({
          where: { id: input.shippingMethodId, active: true, zone: { active: true } },
          include: { zone: true }
        });
        const countryMatches = Array.isArray(method?.zone.countries) && method.zone.countries.some((country) => String(country).toUpperCase() === negotiation.country);
        if (!method || !countryMatches) throw new HttpError(400, 'Choose an active delivery method that serves this destination');
        approvedShippingMethodId = method.id;
        methodName = method.name;
      }
      const result = await transaction.deliveryNegotiation.update({
        where: { id },
        data: { status: input.status, approvedShippingMethodId, responseNote: input.responseNote || null },
        include: { approvedShippingMethod: { select: { id: true, name: true } } }
      });
      await transaction.notification.create({
        data: {
          userId: negotiation.userId,
          type: 'DELIVERY_NEGOTIATION',
          title: input.status === 'APPROVED' ? 'Delivery method approved' : 'Delivery method request declined',
          body: input.status === 'APPROVED'
            ? `Your request was approved. ${methodName} is available at checkout. The courier team will agree and collect the delivery fee separately; it is not included in your checkout payment.`
            : input.responseNote!,
          metadata: { deliveryNegotiationId: id }
        }
      });
      return result;
    });
    return response.json({ data: updated });
  } catch (error) { return next(error); }
});

export default router;
