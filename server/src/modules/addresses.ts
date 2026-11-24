import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
const addressInput = z.object({ fullName: z.string().min(2).max(120), phone: z.string().min(5).max(30), country: z.string().min(2).max(80), region: z.string().max(80).optional(), city: z.string().min(2).max(80), district: z.string().max(80).optional(), addressLine1: z.string().min(3).max(160), addressLine2: z.string().max(160).optional(), postalCode: z.string().max(20).optional(), instructions: z.string().max(500).optional(), isDefault: z.boolean().default(false) });
router.use(requireAuth);

router.get('/', async (request, response, next) => { try { return response.json({ data: await prisma.address.findMany({ where: { userId: request.user!.id }, orderBy: [{ isDefault: 'desc' }, { id: 'desc' }] }) }); } catch (error) { return next(error); } });

router.post('/', async (request, response, next) => {
  try {
    const input = addressInput.parse(request.body);
    const address = await prisma.$transaction(async (transaction) => {
      if (input.isDefault) await transaction.address.updateMany({ where: { userId: request.user!.id }, data: { isDefault: false } });
      const hasAddress = await transaction.address.count({ where: { userId: request.user!.id } });
      return transaction.address.create({ data: { ...input, userId: request.user!.id, isDefault: input.isDefault || hasAddress === 0 } });
    });
    return response.status(201).json({ data: address });
  } catch (error) { return next(error); }
});

router.patch('/:addressId', async (request, response, next) => {
  try {
    const addressId = request.params.addressId;
    if (typeof addressId !== 'string') return response.status(400).json({ error: 'Invalid address ID' });
    const input = addressInput.partial().parse(request.body);
    const existing = await prisma.address.findFirst({ where: { id: addressId, userId: request.user!.id } });
    if (!existing) return response.status(404).json({ error: 'Address not found' });
    const address = await prisma.$transaction(async (transaction) => { if (input.isDefault) await transaction.address.updateMany({ where: { userId: request.user!.id }, data: { isDefault: false } }); return transaction.address.update({ where: { id: addressId }, data: input }); });
    return response.json({ data: address });
  } catch (error) { return next(error); }
});

router.delete('/:addressId', async (request, response, next) => { try { const addressId = request.params.addressId; if (typeof addressId !== 'string') return response.status(400).json({ error: 'Invalid address ID' }); const result = await prisma.address.deleteMany({ where: { id: addressId, userId: request.user!.id } }); if (!result.count) return response.status(404).json({ error: 'Address not found' }); return response.status(204).send(); } catch (error) { return next(error); } });

export default router;
