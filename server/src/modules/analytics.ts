import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();
const dateInput = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

router.get('/dashboard', requireAuth, requirePermission('reports.read'), async (request, response, next) => {
  try {
    const input = dateInput.parse(request.query);
    const to = input.to || new Date();
    const from = input.from || new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const period = { gte: from, lte: to };
    const lowStockSetting = await prisma.appSetting.findUnique({ where: { key: 'lowStockThreshold' } });
    const lowStockThreshold = Number(lowStockSetting?.value ?? 10);
    const [orders, customers, products, lowStock, orderItems, inventories] = await Promise.all([
      prisma.order.findMany({ where: { createdAt: period }, select: { total: true, status: true, createdAt: true, payments: { select: { provider: true, amount: true, status: true } } } }),
      prisma.user.count({ where: { createdAt: period, role: 'CUSTOMER', deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.inventory.count({ where: { available: { lte: lowStockThreshold } } }),
      prisma.orderItem.findMany({ where: { order: { createdAt: period } }, select: { name: true, quantity: true, unitPrice: true } }),
      prisma.inventory.findMany({ where: { product: { deletedAt: null } }, select: { available: true, reserved: true, sold: true } })
    ]);
    const revenue = orders.filter((order) => !['CANCELLED', 'REFUNDED'].includes(order.status)).reduce((sum, order) => sum + Number(order.total), 0);
    const topProducts = Object.values(orderItems.reduce<Record<string, { name: string; units: number; revenue: number }>>((summary, item) => { const current = summary[item.name] || { name: item.name, units: 0, revenue: 0 }; current.units += item.quantity; current.revenue += Number(item.unitPrice) * item.quantity; summary[item.name] = current; return summary; }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const bucketCount = 12;
    const bucketSize = Math.max(1, (to.getTime() - from.getTime()) / bucketCount);
    const revenueTrend = Array.from({ length: bucketCount }, (_, index) => ({
      label: new Date(from.getTime() + index * bucketSize).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: 0,
      orders: 0
    }));
    const channelMap = new Map<string, { name: string; revenue: number; orders: number }>();
    orders.forEach((order) => {
      if (['CANCELLED', 'REFUNDED'].includes(order.status)) return;
      const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((order.createdAt.getTime() - from.getTime()) / bucketSize)));
      revenueTrend[bucketIndex].revenue += Number(order.total);
      revenueTrend[bucketIndex].orders += 1;
      const provider = order.payments.find((payment) => payment.status !== 'FAILED')?.provider?.trim() || 'Other';
      const channel = channelMap.get(provider) || { name: provider, revenue: 0, orders: 0 };
      channel.revenue += Number(order.total);
      channel.orders += 1;
      channelMap.set(provider, channel);
    });
    const channels = [...channelMap.values()].sort((a, b) => b.revenue - a.revenue).map((channel) => ({ ...channel, revenue: Number(channel.revenue.toFixed(2)), share: revenue ? Number((channel.revenue / revenue * 100).toFixed(1)) : 0 }));
    const inventory = inventories.reduce((summary, item) => ({ available: summary.available + item.available, reserved: summary.reserved + item.reserved, sold: summary.sold + item.sold }), { available: 0, reserved: 0, sold: 0 });
    const totalStock = inventory.available + inventory.reserved + inventory.sold;
    return response.json({ data: { period: { from, to }, revenue: Number(revenue.toFixed(2)), orders: orders.length, pendingOrders: orders.filter((order) => ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)).length, completedOrders: orders.filter((order) => order.status === 'DELIVERED').length, customers, products, lowStockProducts: lowStock, averageOrderValue: orders.length ? Number((revenue / orders.length).toFixed(2)) : 0, topProducts, revenueTrend: revenueTrend.map((bucket) => ({ ...bucket, revenue: Number(bucket.revenue.toFixed(2)) })), channels, inventory: { ...inventory, totalStock, sellThroughRate: totalStock ? Number((inventory.sold / totalStock * 100).toFixed(1)) : 0 } } });
  } catch (error) { return next(error); }
});

export default router;
