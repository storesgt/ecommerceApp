import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response, next) => {
  try {
    const items = await prisma.wishlistItem.findMany({ where: { userId: request.user!.id }, include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, inventory: true } } }, orderBy: { id: 'desc' } });
    return response.json({ data: items });
  } catch (error) { return next(error); }
});

router.post('/:productId', async (request, response, next) => {
  try {
    const productId = z.string().cuid().parse(request.params.productId);
    const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) return response.status(404).json({ error: 'Product not found' });
    const item = await prisma.wishlistItem.upsert({ where: { userId_productId: { userId: request.user!.id, productId } }, create: { userId: request.user!.id, productId }, update: {} });
    return response.status(201).json({ data: item });
  } catch (error) { return next(error); }
});

router.delete('/:productId', async (request, response, next) => {
  try {
    const productId = z.string().cuid().parse(request.params.productId);
    await prisma.wishlistItem.deleteMany({ where: { userId: request.user!.id, productId } });
    return response.status(204).send();
  } catch (error) { return next(error); }
});

export default router;
