import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { providers } from '../payments/adapters';

const router = Router();
const providerInput = z.object({ provider: z.literal('paystack'), paymentId: z.string().cuid(), email: z.string().email().optional() });
const webhookInput = z.object({ eventId: z.string().min(1), reference: z.string().min(1), status: z.enum(['SUCCESS', 'FAILED', 'PROCESSING', 'CANCELLED', 'EXPIRED']) });

export function paymentInitializationErrorMessage(error: unknown, provider: string, currency: string): string {
  const message = error instanceof Error ? error.message : 'The payment provider could not start this transaction.';
  if (provider === 'paystack' && /Paystack request failed \(HTTP 403\): Currency not supported by merchant/i.test(message)) {
    return `Paystack does not support ${currency.toUpperCase()} for this merchant account. Enable ${currency.toUpperCase()} in the Paystack account, or change the store currency in Admin Settings to a currency the account supports. Prices are not converted automatically.`;
  }
  return message;
}

router.get('/paystack/callback', async (request, response, next) => {
  try {
    const reference = typeof request.query.reference === 'string' ? request.query.reference : '';
    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    if (!reference) return response.redirect(`${appUrl}/index.html#tracking`);
    const payment = await prisma.payment.findUnique({ where: { reference }, include: { order: true } });
    if (!payment) return response.redirect(`${appUrl}/index.html#tracking`);
    const provider = providers.paystack;
    if (provider.configure) {
      const rows = await prisma.appSetting.findMany({ where: { key: { in: ['paystackSecretKey', 'paystackPublicKey', 'paymentGateways'] } } });
      const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      const gateway = Array.isArray(settings.paymentGateways) ? settings.paymentGateways.find((entry) => entry && typeof entry === 'object' && (entry as { id?: string }).id === 'paystack') as Record<string, string> | undefined : undefined;
      provider.configure({ secretKey: gateway?.secretKey || String(settings.paystackSecretKey || ''), publicKey: gateway?.publicKey || String(settings.paystackPublicKey || '') });
    }
    const result = await provider.verify(reference);
    const previousMetadata = typeof payment.metadata === 'object' && payment.metadata ? payment.metadata as Record<string, unknown> : {};
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: result.status, providerTransactionId: result.providerReference, paidAt: result.status === 'SUCCESS' ? new Date() : payment.paidAt, metadata: { ...previousMetadata, ...(result.metadata || {}), verifiedAt: new Date().toISOString() } } }),
      prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: result.status, status: result.status === 'SUCCESS' ? 'CONFIRMED' : ['FAILED', 'CANCELLED', 'EXPIRED'].includes(result.status) ? 'CANCELLED' : payment.order.status } })
    ]);
    const destination = result.status === 'SUCCESS' ? `tracking/${encodeURIComponent(payment.order.orderNumber)}` : 'checkout';
    return response.redirect(`${appUrl}/index.html#${destination}`);
  } catch (error) { return next(error); }
});

router.post('/initialize', requireAuth, async (request, response, next) => {
  const parsedInput = providerInput.safeParse(request.body);
  if (!parsedInput.success) return response.status(400).json({ error: 'Invalid payment initialization request', message: parsedInput.error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ') });
  let paymentCurrency = '';
  try {
    const input = parsedInput.data;
    let payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { order: { include: { user: { select: { email: true } } } } } });
    if (!payment || (request.user!.role === 'CUSTOMER' && payment.order.userId !== request.user!.id)) return response.status(404).json({ error: 'Payment not found' });
    paymentCurrency = payment.currency;
    const reference = payment.status === 'SUCCESS' ? payment.reference : `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const provider = providers[input.provider];
    if (provider.configure) { const rows = await prisma.appSetting.findMany({ where: { key: { in: ['paystackSecretKey', 'paystackPublicKey', 'paymentGateways'] } } }); const settings = Object.fromEntries(rows.map((row) => [row.key, row.value])); const gateway = Array.isArray(settings.paymentGateways) ? settings.paymentGateways.find((entry) => entry && typeof entry === 'object' && (entry as { id?: string }).id === input.provider) as Record<string, string> | undefined : undefined; provider.configure({ secretKey: gateway?.secretKey || String(settings.paystackSecretKey || ''), publicKey: gateway?.publicKey || String(settings.paystackPublicKey || ''), clientId: gateway?.clientId, clientSecret: gateway?.clientSecret, merchantAccount: gateway?.merchantAccount, apiUrl: gateway?.apiUrl, callbackUrl: gateway?.callbackUrl, webhookSecret: gateway?.webhookSecret }); }
    const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata) ? payment.metadata as Record<string, unknown> : {};
    const email = String(input.email || payment.order.user.email || metadata.email || '').replace(/[^\x20-\x7E]/g, '').trim().toLowerCase();
    if (!z.string().email().safeParse(email).success) return response.status(400).json({ error: 'A valid customer email is required to initialize this payment' });
    const result = await provider.initialize({ reference, amount: Number(payment.amount), currency: payment.currency, email, metadata });
    const providerMetadata = JSON.parse(JSON.stringify(result.metadata || {})) as Prisma.InputJsonValue;
    const updated = await prisma.$transaction(async (transaction) => {
      const savedPayment = await transaction.payment.update({ where: { id: payment.id }, data: { reference, provider: provider.name, providerTransactionId: result.providerReference, status: result.status, paidAt: null, metadata: providerMetadata } });
      await transaction.order.update({ where: { id: payment.orderId }, data: { status: 'PENDING', paymentStatus: result.status } });
      return savedPayment;
    });
    return response.json({ data: updated, provider: result });
  } catch (error) { console.error('Payment initialization failed:', error); return response.status(502).json({ error: 'Payment provider initialization failed', message: paymentInitializationErrorMessage(error, parsedInput.data.provider, paymentCurrency) }); }
});

router.post('/:paymentId/verify', requireAuth, async (request, response, next) => {
  try {
    const paymentId = request.params.paymentId;
    if (typeof paymentId !== 'string') return response.status(400).json({ error: 'Invalid payment ID' });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment || (request.user!.role === 'CUSTOMER' && payment.order.userId !== request.user!.id) || !providers[payment.provider]) return response.status(404).json({ error: 'Payment not found' });
    const provider = providers[payment.provider];
    if (provider.configure) { const rows = await prisma.appSetting.findMany({ where: { key: { in: ['paystackSecretKey', 'paystackPublicKey', 'paymentGateways'] } } }); const settings = Object.fromEntries(rows.map((row) => [row.key, row.value])); const gateway = Array.isArray(settings.paymentGateways) ? settings.paymentGateways.find((entry) => entry && typeof entry === 'object' && (entry as { id?: string }).id === payment.provider) as Record<string, string> | undefined : undefined; provider.configure({ secretKey: gateway?.secretKey || String(settings.paystackSecretKey || ''), publicKey: gateway?.publicKey || String(settings.paystackPublicKey || ''), clientId: gateway?.clientId, clientSecret: gateway?.clientSecret, merchantAccount: gateway?.merchantAccount, apiUrl: gateway?.apiUrl, callbackUrl: gateway?.callbackUrl, webhookSecret: gateway?.webhookSecret }); }
    const result = await provider.verify(payment.reference);
    const previousMetadata = typeof payment.metadata === 'object' && payment.metadata ? payment.metadata as Record<string, unknown> : {};
    const updated = await prisma.$transaction([prisma.payment.update({ where: { id: payment.id }, data: { status: result.status, providerTransactionId: result.providerReference, paidAt: result.status === 'SUCCESS' ? new Date() : payment.paidAt, metadata: { ...previousMetadata, ...(result.metadata || {}), verifiedAt: new Date().toISOString() } } }), prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: result.status, status: result.status === 'SUCCESS' ? 'CONFIRMED' : ['FAILED', 'CANCELLED', 'EXPIRED'].includes(result.status) ? 'CANCELLED' : payment.order.status } })]);
    return response.json({ data: updated[0], provider: result });
  } catch (error) { return next(error); }
});

router.post('/:provider/webhook', async (request, response, next) => {
  try {
    const providerName = request.params.provider;
    if (typeof providerName !== 'string' || !providers[providerName]) return response.status(404).json({ error: 'Payment provider not supported' });
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody?.toString('utf8') || JSON.stringify(request.body);
    const signature = request.header('x-paystack-signature') || request.header('x-webhook-signature') || request.header('x-signature');
    if (!providers[providerName].verifyWebhookSignature(rawBody, signature)) return response.status(401).json({ error: 'Invalid webhook signature' });
    const input = webhookInput.parse(request.body);
    const existing = await prisma.paymentWebhook.findUnique({ where: { provider_eventId: { provider: providerName, eventId: input.eventId } } });
    if (existing) return response.json({ received: true, duplicate: true });
    const payment = await prisma.payment.findUnique({ where: { reference: input.reference } });
    if (!payment) return response.status(404).json({ error: 'Payment not found' });
    await prisma.$transaction([prisma.paymentWebhook.create({ data: { provider: providerName, eventId: input.eventId, payload: input } }), prisma.payment.update({ where: { id: payment.id }, data: { status: input.status, paidAt: input.status === 'SUCCESS' ? new Date() : undefined } }), prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: input.status, ...(input.status === 'SUCCESS' ? { status: 'CONFIRMED' } : ['FAILED', 'CANCELLED', 'EXPIRED'].includes(input.status) ? { status: 'CANCELLED' } : {}) } })]);
    return response.json({ received: true });
  } catch (error) { return next(error); }
});

router.post('/:paymentId/refund', requireAuth, requirePermission('orders.refund'), async (request, response, next) => {
  try {
    const paymentId = request.params.paymentId;
    if (typeof paymentId !== 'string') return response.status(400).json({ error: 'Invalid payment ID' });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || !providers[payment.provider]) return response.status(404).json({ error: 'Refundable payment not found' });
    const result = await providers[payment.provider].refund(payment.reference, request.body.amount);
    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: result.status, metadata: result.metadata as Prisma.InputJsonValue } });
    return response.json({ data: updated });
  } catch (error) { return next(error); }
});

export default router;