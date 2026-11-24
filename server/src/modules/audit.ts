import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
function activityMessage(log: { action: string; entity: string; metadata: unknown; user?: { firstName: string; lastName: string } | null }) {
  const actor = log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : 'System';
  const metadata = log.metadata && typeof log.metadata === 'object' ? log.metadata as Record<string, unknown> : {};
  const detailParts = [
    metadata.orderNumber && `order ${metadata.orderNumber}`,
    metadata.name && String(metadata.name),
    metadata.email && String(metadata.email),
    metadata.sku && `SKU ${metadata.sku}`,
    metadata.status && `status ${String(metadata.status).toLowerCase().replaceAll('_', ' ')}`,
    metadata.role && `role ${String(metadata.role).toLowerCase().replaceAll('_', ' ')}`,
    Array.isArray(metadata.fields) && metadata.fields.length ? `fields: ${metadata.fields.join(', ')}` : null,
    metadata.method && metadata.path && `${String(metadata.method).toUpperCase()} ${metadata.path}`
  ].filter((part): part is string => Boolean(part));
  const details = detailParts.length ? ` (${detailParts.join(' · ')})` : '';
  if (log.action === 'AUTH_LOGIN') return `${actor} signed in${details}.`;
  if (log.action === 'AUTH_LOGOUT') return `${actor} signed out${details}.`;
  if (log.action === 'AUTH_REGISTER') return `${actor} created an account${details}.`;
  if (log.action.startsWith('API_')) return `${actor} made a request${details || ` to ${String(metadata.path || log.entity)}`}.`;
  const readableActions: Record<string, string> = { ORDER_STATUS_UPDATED: 'updated the order status', ORDER_CANCELLED: 'cancelled an order', PRODUCT_CREATED: 'created a product', PRODUCT_UPDATED: 'updated a product', PRODUCT_ARCHIVED: 'archived a product', CATEGORY_CREATED: 'created a category', CATEGORY_UPDATED: 'updated a category', CATEGORY_ARCHIVED: 'archived a category', USER_CREATED: 'created a user', USER_ACCOUNT_UPDATED: 'updated a user account', USER_STATUS_UPDATED: 'updated a user status', USER_ROLE_UPDATED: 'updated a user role', KYC_APPROVED: 'approved KYC', KYC_PROCESSING: 'started KYC processing', KYC_REJECTED: 'rejected KYC', REVIEW_MODERATED: 'moderated a review' };
  if (readableActions[log.action]) return `${actor} ${readableActions[log.action]}${details}.`;
  const action = log.action.replaceAll('_', ' ').toLowerCase();
  return `${actor} ${action}${log.entity ? ` for ${log.entity.toLowerCase()}` : ''}${details}.`;
}
router.get('/', requireAuth, requirePermission('users.manage'), async (request, response, next) => {
  try {
    const query = z.object({ search: z.string().trim().max(120).optional(), entity: z.string().max(80).optional(), action: z.string().max(100).optional(), userId: z.string().cuid().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(10).max(100).default(25) }).parse(request.query);
    const entityFilters: Record<string, object> = { auth: { action: { startsWith: 'AUTH_' } }, orders: { entity: 'Order' }, products: { entity: 'Product' }, users: { entity: 'User' }, catalog: { entity: { in: ['Category', 'Brand'] } }, settings: { entity: 'settings' } };
    const searchTokens = query.search?.split(/\s+/).filter(Boolean) || [];
    const searchConditions = searchTokens.map((token) => ({ OR: [{ action: { contains: token } }, { entity: { contains: token } }, { user: { firstName: { contains: token } } }, { user: { lastName: { contains: token } } }, { user: { email: { contains: token } } }] }));
    const where = { ...(query.entity ? (entityFilters[query.entity] || { entity: query.entity }) : {}), ...(query.action ? { action: query.action } : {}), ...(query.userId ? { userId: query.userId } : {}), ...(searchConditions.length ? { AND: searchConditions } : {}) };
    const [total, logs] = await prisma.$transaction([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    const idsFor = (entity: string) => logs.filter((log) => log.entity === entity && log.entityId).map((log) => log.entityId as string);
    const [orders, products, users, categories, brands] = await Promise.all([
      prisma.order.findMany({ where: { id: { in: idsFor('Order') } }, select: { id: true, orderNumber: true } }),
      prisma.product.findMany({ where: { id: { in: idsFor('Product') } }, select: { id: true, name: true, sku: true } }),
      prisma.user.findMany({ where: { id: { in: idsFor('User') } }, select: { id: true, firstName: true, lastName: true, email: true } }),
      prisma.category.findMany({ where: { id: { in: idsFor('Category') } }, select: { id: true, name: true } }),
      prisma.brand.findMany({ where: { id: { in: idsFor('Brand') } }, select: { id: true, name: true } })
    ]);
    const resourceDetails = new Map<string, Record<string, unknown>>();
    orders.forEach((item) => resourceDetails.set(item.id, { orderNumber: item.orderNumber }));
    products.forEach((item) => resourceDetails.set(item.id, { name: item.name, sku: item.sku }));
    users.forEach((item) => resourceDetails.set(item.id, { name: `${item.firstName} ${item.lastName}`.trim(), email: item.email }));
    categories.forEach((item) => resourceDetails.set(item.id, { name: item.name }));
    brands.forEach((item) => resourceDetails.set(item.id, { name: item.name }));
    return response.json({ data: logs.map((log) => { const metadata = log.metadata && typeof log.metadata === 'object' ? log.metadata as Record<string, unknown> : {}; const enrichedLog = { ...log, metadata: { ...metadata, ...(log.entityId ? (resourceDetails.get(log.entityId) || {}) : {}) } }; return { ...log, message: activityMessage(enrichedLog) }; }), pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.max(1, Math.ceil(total / query.pageSize)) } });
  } catch (error) { return next(error); }
});
export default router;
