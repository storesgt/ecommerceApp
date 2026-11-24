import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const productInput = z.object({ name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9-]+$/), sku: z.string().min(2).max(80), description: z.string().max(10000).optional(), shortDescription: z.string().max(500).optional(), usage: z.string().max(10000).optional(), features: z.string().max(10000).optional(), price: z.coerce.number().nonnegative(), compareAtPrice: z.coerce.number().nonnegative().optional(), categoryId: z.string().cuid().optional(), brandId: z.string().cuid().optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK']).default('DRAFT'), featured: z.boolean().default(false), images: z.array(z.object({ url: z.string().url(), altText: z.string().max(160).optional() })).max(12).default([]), stock: z.coerce.number().int().nonnegative().default(0) });
const variantInput = z.object({ sku: z.string().min(2).max(80), name: z.string().min(1).max(120), price: z.coerce.number().nonnegative().optional(), inventory: z.coerce.number().int().nonnegative().default(0), active: z.boolean().default(true) });

router.get('/', async (request, response, next) => {
  try {
    const query = z.object({ search: z.string().optional(), categoryId: z.string().cuid().optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK', 'ALL']).optional(), take: z.coerce.number().int().min(1).max(100).default(24), skip: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const products = await prisma.product.findMany({ where: { deletedAt: null, ...(query.status !== 'ALL' ? { status: query.status || 'ACTIVE' } : {}), ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(query.search ? { OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }] } : {}) }, include: { images: { orderBy: { sortOrder: 'asc' } }, inventory: true, category: true }, orderBy: { createdAt: 'desc' }, take: query.take, skip: query.skip });
    return response.json({ data: products });
  } catch (error) { return next(error); }
});

  router.post('/:productId/view', async (request, response, next) => {
    try {
      const productId = request.params.productId;
      if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' });
      const product = await prisma.product.updateMany({ where: { id: productId, status: 'ACTIVE', visibility: true, deletedAt: null }, data: { viewCount: { increment: 1 } } });
      if (!product.count) return response.status(404).json({ error: 'Product not found' });
      return response.status(204).send();
    } catch (error) { return next(error); }
  });

router.post('/', requireAuth, requirePermission('products.create'), async (request, response, next) => {
  try {
    const input = productInput.parse(request.body);
    const product = await prisma.product.create({ data: { name: input.name, slug: input.slug, sku: input.sku, description: input.description, shortDescription: input.shortDescription, usage: input.usage, features: input.features, price: input.price, compareAtPrice: input.compareAtPrice, status: input.status, featured: input.featured, categoryId: input.categoryId, brandId: input.brandId, images: { create: input.images.map((image, sortOrder) => ({ ...image, sortOrder })) }, inventory: { create: { available: input.stock, movements: { create: { type: 'RESTOCK', quantity: input.stock, reason: 'Initial stock' } } } } }, include: { images: true, inventory: true } });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id, metadata: { name: product.name, sku: product.sku } } });
    return response.status(201).json({ data: product });
  } catch (error) { return next(error); }
});

router.patch('/:productId', requireAuth, requirePermission('products.update'), async (request, response, next) => {
  try {
    const productId = request.params.productId;
    if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' });
    const hasExplicitStatus = Object.prototype.hasOwnProperty.call(request.body || {}, 'status');
    const input = productInput.partial().parse(request.body);
    const existing = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } });
    if (!existing) return response.status(404).json({ error: 'Product not found' });
    const { images, stock, ...productData } = input;
    if (!hasExplicitStatus) productData.status = existing.status;
    const product = await prisma.$transaction(async (transaction) => {
      if (images?.length) { await transaction.productImage.deleteMany({ where: { productId } }); await transaction.productImage.createMany({ data: images.map((image, sortOrder) => ({ ...image, productId, sortOrder })) }); }
      if (stock !== undefined) { const inventory = await transaction.inventory.findUnique({ where: { productId } }); if (inventory) { const difference = stock - inventory.available; await transaction.inventory.update({ where: { productId }, data: { available: stock } }); if (difference !== 0) await transaction.inventoryMovement.create({ data: { inventoryId: inventory.id, type: 'ADJUSTMENT', quantity: difference, reason: 'Product update' } }); } }
      return transaction.product.update({ where: { id: productId }, data: productData, include: { images: { orderBy: { sortOrder: 'asc' } }, inventory: true, variants: true } });
    });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: product.id, metadata: { name: product.name, sku: product.sku } } });
    return response.json({ data: product });
  } catch (error) { return next(error); }
});

router.delete('/:productId', requireAuth, requirePermission('products.delete'), async (request, response, next) => {
  try { const productId = request.params.productId; if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' }); const product = await prisma.product.update({ where: { id: productId }, data: { status: 'ARCHIVED', visibility: false, deletedAt: new Date() } }); await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'PRODUCT_ARCHIVED', entity: 'Product', entityId: product.id, metadata: { name: product.name, sku: product.sku } } }); return response.status(204).send(); } catch (error) { return next(error); }
});

router.post('/:productId/variants', requireAuth, requirePermission('products.update'), async (request, response, next) => {
  try { const productId = request.params.productId; if (typeof productId !== 'string') return response.status(400).json({ error: 'Invalid product ID' }); const input = variantInput.parse(request.body); const variant = await prisma.productVariant.create({ data: { ...input, productId } }); return response.status(201).json({ data: variant }); } catch (error) { return next(error); }
});

router.patch('/:productId/variants/:variantId', requireAuth, requirePermission('products.update'), async (request, response, next) => {
  try { const { productId, variantId } = request.params; if (typeof productId !== 'string' || typeof variantId !== 'string') return response.status(400).json({ error: 'Invalid variant reference' }); const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId } }); if (!existing) return response.status(404).json({ error: 'Variant not found' }); const variant = await prisma.productVariant.update({ where: { id: variantId }, data: variantInput.partial().parse(request.body) }); return response.json({ data: variant }); } catch (error) { return next(error); }
});

export default router;
