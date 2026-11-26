import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { HttpError } from '../lib/http-error';

const router = Router();
const createOrderInput = z.object({
  items: z.array(z.object({ productId: z.string().cuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(50),
  addressId: z.string().cuid().optional(),
  email: z.string().email().optional(),
  provider: z.literal('paystack').default('paystack'),
  currency: z.string().length(3).default('USD'),
  couponCode: z.string().trim().min(3).max(40).optional(),
  notes: z.string().max(1000).optional()
});
const statusInput = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED']) });
const defaultTaxRates: Record<string, number> = { GH: 15, GHANA: 15, US: 0, GB: 20 };

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `ORD-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

router.get('/', requireAuth, async (request, response, next) => {
  try {
    const ownOrdersOnly = request.query.scope === 'mine' || request.header('x-client-area') === 'storefront';
    const orders = await prisma.order.findMany({ where: ownOrdersOnly || request.user!.role === 'CUSTOMER' ? { userId: request.user!.id } : {}, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, items: { include: { product: { select: { images: { orderBy: { sortOrder: 'asc' }, select: { url: true, altText: true } } } } } }, refunds: { select: { id: true, orderItemId: true, quantity: true, status: true } }, payments: { select: { id: true, reference: true, provider: true, status: true, amount: true, currency: true, paymentMethod: true, providerTransactionId: true, paidAt: true, metadata: true } }, address: true, deliveryNegotiation: { include: { approvedShippingMethod: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } });
    return response.json({ data: orders.map((order) => ({ ...order, status: order.status === 'RETURN_REQUESTED' ? 'DELIVERED' : order.status })) });
  } catch (error) { return next(error); }
});

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = createOrderInput.parse(request.body);
    const order = await prisma.$transaction(async (transaction) => {
      const quantities = new Map<string, number>();
      for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      const normalizedItems = [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
      let deliveryCountry = '';
      if (input.addressId) { const address = await transaction.address.findFirst({ where: { id: input.addressId, userId: request.user!.id } }); if (!address) throw new HttpError(400, 'Shipping address does not belong to this customer'); deliveryCountry = address.country.toUpperCase(); }
      const productIds = normalizedItems.map((item) => item.productId);
      const products = await transaction.product.findMany({ where: { id: { in: productIds }, status: 'ACTIVE', deletedAt: null }, include: { inventory: true } });
      if (products.length !== productIds.length) throw new HttpError(409, 'One or more products are unavailable');
      const productMap = new Map(products.map((product) => [product.id, product]));
      let subtotal = 0;
      const items = normalizedItems.map((item) => {
        const product = productMap.get(item.productId)!;
        if (!product.inventory || product.inventory.available < item.quantity) throw new HttpError(409, `${product.name} is out of stock`);
        subtotal += Number(product.price) * item.quantity;
        return { product, quantity: item.quantity };
      });
      let shipping = 0;
      let discount = 0;
      let coupon: { id: string; active: boolean; type: string; value: unknown; minimumOrder: unknown; maximumDiscount: unknown; usageLimit: number | null; usedCount: number; startsAt: Date | null; expiresAt: Date | null } | null = null;
      if (input.couponCode) {
        coupon = await transaction.coupon.findUnique({ where: { code: input.couponCode.toUpperCase() } });
        const now = new Date();
        if (!coupon || !coupon.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) throw new HttpError(400, 'Coupon is invalid or expired');
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new HttpError(400, 'Coupon usage limit reached');
        if (coupon.minimumOrder !== null && subtotal < Number(coupon.minimumOrder)) throw new HttpError(400, `Minimum order is ${coupon.minimumOrder}`);
        if (await transaction.couponRedemption.findUnique({ where: { couponId_userId: { couponId: coupon.id, userId: request.user!.id } } })) throw new HttpError(400, 'Coupon already used by this customer');
        if (coupon.type === 'PERCENTAGE') discount = subtotal * Number(coupon.value) / 100;
        if (coupon.type === 'FIXED_AMOUNT') discount = Number(coupon.value);
        if (coupon.type === 'FREE_SHIPPING') shipping = 0;
        if (coupon.maximumDiscount !== null) discount = Math.min(discount, Number(coupon.maximumDiscount));
        discount = Math.min(discount, subtotal);
      }
      const taxableSubtotal = Math.max(0, subtotal - discount);
      const taxSetting = await transaction.appSetting.findUnique({ where: { key: 'taxEnabled' } });
      const taxRateKey = deliveryCountry === 'GHANA' ? 'GH' : deliveryCountry;
      const taxRateSetting = await transaction.appSetting.findUnique({ where: { key: `taxRate${taxRateKey}` } });
      const taxCountriesSetting = await transaction.appSetting.findUnique({ where: { key: 'taxCountries' } });
      const taxCountries = Array.isArray(taxCountriesSetting?.value) ? taxCountriesSetting.value : [];
      const configuredCountry = taxCountries.find((entry) => entry && typeof entry === 'object' && String((entry as { code?: string }).code).toUpperCase() === deliveryCountry);
      const configuredTaxRate = Number((configuredCountry as { rate?: number } | undefined)?.rate ?? taxRateSetting?.value);
      const taxRate = Number.isFinite(configuredTaxRate) ? configuredTaxRate : (defaultTaxRates[deliveryCountry] ?? 0);
      const taxEnabled = taxSetting?.value === true || taxSetting?.value === 'true';
      const tax = taxEnabled ? taxableSubtotal * taxRate / 100 : 0;
      const gatewaysSetting = await transaction.appSetting.findUnique({ where: { key: 'paymentGateways' } });
      const configuredGateway = Array.isArray(gatewaysSetting?.value) ? gatewaysSetting.value.find((entry) => entry && typeof entry === 'object' && String((entry as { id?: string }).id).toLowerCase() === 'paystack') as { serviceFee?: number } | undefined : undefined;
      const serviceFeeRate = Number(configuredGateway?.serviceFee ?? 0.2);
      const serviceFee = Number(((taxableSubtotal + shipping + tax) * serviceFeeRate / 100).toFixed(2));
      const total = taxableSubtotal + shipping + tax + serviceFee;
      if (coupon) {
        const redemption = await transaction.coupon.updateMany({
          where: { id: coupon.id, active: true, ...(coupon.usageLimit === null ? {} : { usedCount: { lt: coupon.usageLimit } }) },
          data: { usedCount: { increment: 1 } }
        });
        if (redemption.count !== 1) throw new HttpError(409, 'Coupon usage limit reached');
      }
      const orderNotes = [input.notes?.trim(), 'Courier team to arrange delivery and collect the delivery fee separately.'].filter(Boolean).join('\n');
      const created = await transaction.order.create({ data: { orderNumber: orderNumber(), userId: request.user!.id, addressId: input.addressId, subtotal, discount, tax, shipping, serviceFee, total, currency: input.currency.toUpperCase(), notes: orderNotes, items: { create: items.map(({ product, quantity }) => ({ productId: product.id, name: product.name, sku: product.sku, unitPrice: product.price, quantity })) }, payments: { create: { provider: input.provider, reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount: total, currency: input.currency.toUpperCase(), status: 'PENDING', metadata: input.email ? { email: input.email } : undefined } } }, include: { items: true, payments: true } });
      if (coupon) await transaction.couponRedemption.create({ data: { couponId: coupon.id, userId: request.user!.id, orderId: created.id, amount: discount } });
      await transaction.notification.create({ data: { userId: request.user!.id, type: 'ORDER_PLACED', title: 'Order received', body: `Your order ${created.orderNumber} has been received.`, metadata: { orderId: created.id, orderNumber: created.orderNumber } } });
      for (const { product, quantity } of items) {
        const result = await transaction.inventory.updateMany({ where: { productId: product.id, available: { gte: quantity } }, data: { available: { decrement: quantity }, reserved: { increment: quantity } } });
        if (result.count !== 1) throw new HttpError(409, `${product.name} became unavailable during checkout`);
        await transaction.inventoryMovement.create({ data: { inventoryId: product.inventory!.id, type: 'RESERVE', quantity, reason: created.orderNumber } });
      }
      return created;
    });
    return response.status(201).json({ data: order, receipt: { invoiceNumber: `INV-${order.orderNumber}`, url: `/api/v1/orders/${order.orderNumber}/receipt`, accounting: { subtotal: Number(order.subtotal), discount: Number(order.discount), tax: Number(order.tax), shipping: Number(order.shipping), serviceFee: Number(order.serviceFee), total: Number(order.total), currency: order.currency }, payment: order.payments[0] ? { reference: order.payments[0].reference, provider: order.payments[0].provider, status: order.payments[0].status } : null } });
  } catch (error) { return next(error); }
});

router.get('/:orderNumber/receipt', requireAuth, async (request, response, next) => {
  try {
    const orderNumberParam = request.params.orderNumber;
    if (typeof orderNumberParam !== 'string') return response.status(400).json({ error: 'Invalid order number' });
    const order = await prisma.order.findUnique({ where: { orderNumber: orderNumberParam }, include: { items: true, address: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!order || (request.user!.role === 'CUSTOMER' && order.userId !== request.user!.id)) return response.status(404).json({ error: 'Order not found' });
    const redemption = await prisma.couponRedemption.findFirst({ where: { orderId: order.id }, include: { coupon: { select: { code: true, usageLimit: true } } } });
    return response.json({ data: { invoiceNumber: `INV-${order.orderNumber}`, orderNumber: order.orderNumber, issuedAt: order.createdAt, currency: order.currency, subtotal: Number(order.subtotal), shipping: Number(order.shipping), tax: Number(order.tax), serviceFee: Number(order.serviceFee), discount: Number(order.discount), couponCode: redemption?.coupon.usageLimit === 1 ? null : redemption?.coupon.code || null, total: Number(order.total), status: order.status, paymentStatus: order.paymentStatus, address: order.address, items: order.items, payment: order.payments[0] || null } });
  } catch (error) { return next(error); }
});

router.patch('/:orderNumber/status', requireAuth, requirePermission('shipping.update'), async (request, response, next) => {
  try {
    const input = statusInput.parse(request.body);
    const orderNumberParam = request.params.orderNumber;
    if (typeof orderNumberParam !== 'string') return response.status(400).json({ error: 'Invalid order number' });
    const order = await prisma.order.findUnique({ where: { orderNumber: orderNumberParam }, include: { payments: { select: { status: true } } } });
    if (!order) return response.status(404).json({ error: 'Order not found' });
    const processingStatuses = ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const paymentConfirmed = order.payments.some((payment) => payment.status === 'SUCCESS');
    if (processingStatuses.includes(input.status) && !paymentConfirmed) return response.status(409).json({ error: 'Payment must be confirmed before this order can be processed.', code: 'PAYMENT_REQUIRED', paymentStatus: order.paymentStatus });
    const updatedOrder = await prisma.order.update({ where: { id: order.id }, data: { status: input.status } });
    await prisma.notification.create({ data: { userId: order.userId, type: 'ORDER_STATUS_UPDATED', title: `Order ${input.status.toLowerCase().replaceAll('_', ' ')}`, body: `Your order ${order.orderNumber} is now ${input.status.toLowerCase().replaceAll('_', ' ')}.`, metadata: { orderId: order.id, orderNumber: order.orderNumber, status: input.status } } });
    await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'ORDER_STATUS_UPDATED', entity: 'Order', entityId: order.id, metadata: { orderNumber: order.orderNumber, status: input.status } } });
    return response.json({ data: updatedOrder });
  } catch (error) { return next(error); }
});

router.post('/:orderNumber/cancel', requireAuth, requirePermission('orders.cancel'), async (request, response, next) => {
  try {
    const orderNumberParam = request.params.orderNumber;
    if (typeof orderNumberParam !== 'string') return response.status(400).json({ error: 'Invalid order number' });
    const order = await prisma.order.findUnique({ where: { orderNumber: orderNumberParam }, include: { items: true } });
    if (!order || (request.user!.role === 'CUSTOMER' && order.userId !== request.user!.id)) return response.status(404).json({ error: 'Order not found' });
    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) return response.status(409).json({ error: 'This order can no longer be cancelled' });
    const cancelled = await prisma.$transaction(async (transaction) => {
      for (const item of order.items) {
        const inventory = await transaction.inventory.findUnique({ where: { productId: item.productId } });
        if (!inventory) continue;
        await transaction.inventory.update({ where: { id: inventory.id }, data: { available: { increment: item.quantity }, reserved: { decrement: item.quantity } } });
        await transaction.inventoryMovement.create({ data: { inventoryId: inventory.id, type: 'RELEASE', quantity: item.quantity, reason: order.orderNumber } });
      }
      return transaction.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    });
    if (request.user!.role !== 'CUSTOMER') await prisma.auditLog.create({ data: { userId: request.user!.id, action: 'ORDER_CANCELLED', entity: 'Order', entityId: cancelled.id, metadata: { orderNumber: cancelled.orderNumber } } });
    return response.json({ data: cancelled });
  } catch (error) { return next(error); }
});

export default router;
