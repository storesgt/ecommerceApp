import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
const itemInput = z.object({ productId: z.string().cuid(), quantity: z.number().int().min(1).max(100) });

async function cartForUser(userId: string) {
  return prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, inventory: true } } } } } });
}

router.use(requireAuth);

router.get('/', async (request, response, next) => {
  try {
    return response.json({ data: await cartForUser(request.user!.id) });
  } catch (error) { return next(error); }
});

router.delete('/', async (request, response, next) => {
  try { const cart = await prisma.cart.findUnique({ where: { userId: request.user!.id } }); if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }); return response.json({ data: { items: [] } }); } catch (error) { return next(error); }
});

router.post('/items', async (request, response, next) => {
  try {
    const input = itemInput.parse(request.body);
    const product = await prisma.product.findFirst({ where: { id: input.productId, status: 'ACTIVE', visibility: true, deletedAt: null }, include: { inventory: true } });
    if (!product) return response.status(404).json({ error: 'Product not found or unavailable' });
    const cart = await prisma.cart.upsert({ where: { userId: request.user!.id }, create: { userId: request.user!.id }, update: {} });
    const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId: product.id } } });
    const nextQuantity = (existing?.quantity || 0) + input.quantity;
    if (!product.inventory || product.inventory.available < nextQuantity) return response.status(409).json({ error: 'Requested quantity is not available', available: product.inventory?.available || 0 });
    const item = existing ? await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } }) : await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: input.quantity } });
    return response.status(existing ? 200 : 201).json({ data: item, cart: await cartForUser(request.user!.id) });
  } catch (error) { return next(error); }
});

router.patch('/items/:itemId', async (request, response, next) => {
  try {
    const itemId = request.params.itemId;
    if (typeof itemId !== 'string') return response.status(400).json({ error: 'Invalid cart item ID' });
    const input = z.object({ quantity: z.number().int().min(1).max(100) }).parse(request.body);
    const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId: request.user!.id } }, include: { product: { include: { inventory: true } } } });
    if (!item) return response.status(404).json({ error: 'Cart item not found' });
    if (!item.product.inventory || item.product.inventory.available < input.quantity) return response.status(409).json({ error: 'Requested quantity is not available', available: item.product.inventory?.available || 0 });
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: input.quantity } });
    return response.json({ data: await cartForUser(request.user!.id) });
  } catch (error) { return next(error); }
});

router.delete('/items/:itemId', async (request, response, next) => {
  try {
    const itemId = request.params.itemId;
    if (typeof itemId !== 'string') return response.status(400).json({ error: 'Invalid cart item ID' });
    const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId: request.user!.id } } });
    if (!item) return response.status(404).json({ error: 'Cart item not found' });
    await prisma.cartItem.delete({ where: { id: item.id } });
    return response.json({ data: await cartForUser(request.user!.id) });
  } catch (error) { return next(error); }
});

export default router;
