import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { mailDeliveryErrorMessage, MailDeliveryError, sendTestEmail } from '../lib/mailer';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const taxCountry = z.object({ code: z.string().trim().min(2).max(3).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(120), rate: z.coerce.number().nonnegative().max(100) });
const chatAiFaq = z.object({ question: z.string().trim().min(3).max(300), response: z.string().trim().min(3).max(2000), enabled: z.boolean().default(true) });
const paymentGateway = z.object({ id: z.literal('paystack'), name: z.literal('Paystack').optional(), enabled: z.boolean().optional(), serviceFee: z.coerce.number().nonnegative().max(100).default(0.2), publicKey: z.string().trim().max(500).optional(), secretKey: z.string().trim().max(500).optional() });
const settingsInput = z.object({
  storeStatus: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  lowStockThreshold: z.coerce.number().int().nonnegative().max(100000).optional(),
  storeName: z.string().trim().min(1).max(120).optional(),
  storeLogo: z.string().trim().max(500).optional(),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  supportEmail: z.union([z.string().email(), z.literal('')]).optional(),
  supportWhatsApp: z.string().trim().max(40).optional(),
  smtpHost: z.string().trim().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().trim().max(320).optional(),
  smtpPassword: z.string().max(500).optional(),
  smtpFrom: z.string().trim().max(320).optional(),
  defaultCurrency: z.string().length(3).toUpperCase().optional(),
  paymentProvider: z.literal('paystack').optional(),
  paystackPublicKey: z.string().trim().max(300).optional(),
  paystackSecretKey: z.string().trim().max(300).optional(),
  paymentGateways: z.array(paymentGateway).max(1).optional(),
  freeShippingThreshold: z.coerce.number().nonnegative().optional(),
  defaultShippingRate: z.coerce.number().nonnegative().optional(),
  taxEnabled: z.boolean().optional(),
  taxRateGH: z.coerce.number().nonnegative().max(100).optional(),
  taxRateUS: z.coerce.number().nonnegative().max(100).optional(),
  taxRateGB: z.coerce.number().nonnegative().max(100).optional(),
  taxCountries: z.array(taxCountry).max(250).optional(),
  chatAiFaqs: z.array(chatAiFaq).max(100).optional(),
});

const defaults = { storeStatus: true, lowStockAlerts: true, lowStockThreshold: 10, storeName: 'Ground', storeLogo: '', brandPrimaryColor: '#20211d', brandAccentColor: '#c7e86a', supportEmail: '', supportWhatsApp: '', smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpFrom: '', defaultCurrency: 'USD', paymentProvider: 'paystack', paystackPublicKey: '', paystackSecretKey: '', paymentGateways: [{ id: 'paystack', name: 'Paystack', enabled: true, serviceFee: 0.2, publicKey: '', secretKey: '' }], freeShippingThreshold: 0, defaultShippingRate: 12, taxEnabled: false, taxRateGH: 15, taxRateUS: 0, taxRateGB: 20, taxCountries: [{ code: 'GH', name: 'Ghana', rate: 15 }, { code: 'US', name: 'United States', rate: 0 }, { code: 'GB', name: 'United Kingdom', rate: 20 }], chatAiFaqs: [] };

router.get('/', requireAuth, requirePermission('settings.update'), async (_request, response, next) => { try { const rows = await prisma.appSetting.findMany(); const data = Object.fromEntries(rows.map((row) => [row.key, row.value])); const { smtpPassword, ...settings } = data; const storedGateways = Array.isArray(settings.paymentGateways) ? settings.paymentGateways : []; const paystack = storedGateways.find((gateway) => gateway && typeof gateway === 'object' && (gateway as { id?: string }).id === 'paystack') as Record<string, unknown> | undefined; return response.json({ data: { ...defaults, ...settings, paymentProvider: 'paystack', paymentGateways: [{ ...defaults.paymentGateways[0], ...(paystack || {}), id: 'paystack', name: 'Paystack', enabled: true }], smtpPasswordConfigured: typeof smtpPassword === 'string' && smtpPassword.length > 0 } }); } catch (error) { return next(error); } });
router.get('/public', async (_request, response, next) => { try { const rows = await prisma.appSetting.findMany({ where: { key: { in: ['storeStatus', 'storeName', 'storeLogo', 'brandPrimaryColor', 'brandAccentColor', 'supportEmail', 'supportWhatsApp', 'defaultCurrency', 'paystackPublicKey', 'defaultShippingRate', 'freeShippingThreshold', 'taxEnabled', 'taxRateGH', 'taxRateUS', 'taxRateGB', 'taxCountries', 'paymentGateways'] } } }); const data = Object.fromEntries(rows.map((row) => [row.key, row.value])); const storedGateways = Array.isArray(data.paymentGateways) ? data.paymentGateways : []; const paystack = storedGateways.find((gateway) => gateway && typeof gateway === 'object' && (gateway as { id?: string }).id === 'paystack') as { serviceFee?: number } | undefined; const gateways = [{ id: 'paystack', name: 'Paystack', serviceFee: Number(paystack?.serviceFee ?? 0.2) }]; const appName = String(process.env.APP_NAME || data.storeName || defaults.storeName).trim() || defaults.storeName; return response.json({ data: { appName, storeStatus: data.storeStatus ?? defaults.storeStatus, storeName: data.storeName ?? defaults.storeName, storeLogo: data.storeLogo ?? defaults.storeLogo, brandPrimaryColor: data.brandPrimaryColor ?? defaults.brandPrimaryColor, brandAccentColor: data.brandAccentColor ?? defaults.brandAccentColor, supportEmail: data.supportEmail ?? defaults.supportEmail, supportWhatsApp: data.supportWhatsApp ?? defaults.supportWhatsApp, defaultCurrency: data.defaultCurrency ?? defaults.defaultCurrency, paymentProvider: 'paystack', paymentGateways: gateways, paystackPublicKey: data.paystackPublicKey ?? defaults.paystackPublicKey, defaultShippingRate: data.defaultShippingRate ?? defaults.defaultShippingRate, freeShippingThreshold: data.freeShippingThreshold ?? defaults.freeShippingThreshold, taxEnabled: data.taxEnabled ?? defaults.taxEnabled, taxRateGH: data.taxRateGH ?? defaults.taxRateGH, taxRateUS: data.taxRateUS ?? defaults.taxRateUS, taxRateGB: data.taxRateGB ?? defaults.taxRateGB, taxCountries: data.taxCountries ?? defaults.taxCountries } }); } catch (error) { return next(error); } });
router.post('/test-smtp', requireAuth, requirePermission('settings.update'), async (request, response, next) => {
  try {
    const { recipient } = z.object({ recipient: z.string().email().max(320) }).parse(request.body);
    const sent = await sendTestEmail(recipient);
    if (!sent) {
      return response.status(400).json({ error: 'Configure and save the SMTP host, username, password, and sender address in Admin Settings before testing.' });
    }
    return response.json({ data: { accepted: true, recipient } });
  } catch (error) {
    if (error instanceof MailDeliveryError) {
      console.error('SMTP test email delivery failed', { code: error.code || undefined, responseCode: error.responseCode });
      return response.status(502).json({ error: mailDeliveryErrorMessage(error) });
    }
    return next(error);
  }
});
router.patch('/', requireAuth, requirePermission('settings.update'), async (request, response, next) => { try { const input = settingsInput.parse(request.body); const storedGateways = input.paymentGateways?.filter((gateway) => gateway.id === 'paystack') || []; const paystack = storedGateways[0]; const normalized = { ...input, paymentProvider: 'paystack', ...(input.paymentGateways ? { paymentGateways: [{ ...defaults.paymentGateways[0], ...(paystack || {}), id: 'paystack', name: 'Paystack', enabled: true }] } : {}) }; await prisma.$transaction(Object.entries(normalized).map(([key, value]) => prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } }))); const { smtpPassword, ...safeInput } = normalized; return response.json({ data: { ...safeInput, ...(smtpPassword !== undefined ? { smtpPasswordConfigured: smtpPassword.length > 0 } : {}) } }); } catch (error) { return next(error); } });

export default router;