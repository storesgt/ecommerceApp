import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { calculateShippingPrice } from '../lib/shipping-price';

const router = Router();
const quoteInput = z.object({ country: z.string().min(2).max(80), weightKg: z.coerce.number().nonnegative().default(0) });

router.get('/methods', async (_request, response, next) => { try { return response.json({ data: await prisma.shippingMethod.findMany({ where: { active: true, zone: { active: true } }, include: { zone: true }, orderBy: { flatRate: 'asc' } }) }); } catch (error) { return next(error); } });

router.post('/quote', async (request, response, next) => {
  try {
    const input = quoteInput.parse(request.body);
    const zones = await prisma.shippingZone.findMany({ where: { active: true }, include: { methods: { where: { active: true }, orderBy: { flatRate: 'asc' } } } });
    const country = input.country.toUpperCase();
    const zone = zones.find((candidate) => Array.isArray(candidate.countries) && candidate.countries.some((value) => String(value).toUpperCase() === country));
    if (!zone) return response.status(404).json({ error: 'No shipping methods available for this destination' });
    return response.json({ data: zone.methods.map((method) => ({ id: method.id, name: method.name, description: method.description, price: calculateShippingPrice(method.rateType, Number(method.flatRate), Number(method.perKgRate), input.weightKg), estimatedDays: { min: method.minDays, max: method.maxDays } })) });
  } catch (error) { return next(error); }
});

export default router;