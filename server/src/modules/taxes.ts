import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();
const defaultRates: Record<string, number> = { GH: 15, GHANA: 15, US: 0, GB: 20 };

router.post('/quote', async (request, response, next) => { try { const input = z.object({ country: z.string().min(2), subtotal: z.coerce.number().nonnegative() }).parse(request.body); const country = input.country.toUpperCase(); const settings = await prisma.appSetting.findMany({ where: { key: { in: ['taxCountries', `taxRate${country === 'GHANA' ? 'GH' : country}`] } } }); const data = Object.fromEntries(settings.map((setting) => [setting.key, setting.value])); const countries = (Array.isArray(data.taxCountries) ? data.taxCountries : []) as Array<{ code?: unknown; rate?: unknown }>; const configuredCountry = countries.find((entry) => String(entry.code || '').toUpperCase() === country); const configuredRate = Number(configuredCountry?.rate ?? data[`taxRate${country === 'GHANA' ? 'GH' : country}`]); const rate = Number.isFinite(configuredRate) ? configuredRate : (defaultRates[country] ?? 0); return response.json({ data: { country, rate: rate / 100, amount: Number((input.subtotal * rate / 100).toFixed(2)) } }); } catch (error) { return next(error); } });

export default router;