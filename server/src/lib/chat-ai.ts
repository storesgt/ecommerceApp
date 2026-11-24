import { prisma } from './prisma';

type ChatContext = {
    userId: string;
    message: string;
};

type ChatAiResult = {
    body: string;
    handoff: boolean;
};

const handoffBody = 'I do not have enough verified information to answer that accurately, so I have transferred your message to staff. Someone from the team will reply here as soon as possible.';
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const hasAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));
const formatPrice = (value: unknown, currency: string) => `${currency} ${Number(value).toFixed(2)}`;

export async function generateChatAiReply({ userId, message }: ChatContext): Promise<ChatAiResult> {
    const normalized = normalize(message);
    const greeting = normalized.replace(/^[^a-z]+/, ' ').trim();

    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|how are you)(?:\b|$)/.test(greeting)) {
        return { body: 'Hello. I can help you find products, compare options, understand delivery, check an order, or explain checkout. What would you like to solve?', handoff: false };
    }

    const trainedSetting = await prisma.appSetting.findUnique({ where: { key: 'chatAiFaqs' }, select: { value: true } });
    const trainedFaqs = Array.isArray(trainedSetting?.value) ? trainedSetting.value.filter((entry): entry is { question: string; response: string; enabled?: boolean } => Boolean(entry && typeof entry === 'object' && typeof (entry as { question?: unknown }).question === 'string' && typeof (entry as { response?: unknown }).response === 'string' && (entry as { enabled?: unknown }).enabled !== false)) : [];
    const trainedMatch = trainedFaqs.map((faq) => {
        const terms = normalize(faq.question).split(' ').filter((term) => term.length > 3);
        const score = terms.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0);
        return { faq, score, termCount: terms.length };
    }).filter((entry) => entry.score > 0 && (entry.score >= 2 || entry.termCount === 1)).sort((left, right) => right.score - left.score)[0];
    if (trainedMatch) return { body: trainedMatch.faq.response, handoff: false };

    if (hasAny(normalized, ['order', 'track', 'parcel', 'package'])) {
        const orderNumber = message.match(/ord[-\s]?[a-z0-9-]+/i)?.[0]?.replace(/\s/g, '').toUpperCase();
        const orders = await prisma.order.findMany({
            where: { userId, ...(orderNumber ? { orderNumber } : {}) },
            select: { orderNumber: true, status: true, createdAt: true, currency: true, total: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const order = orders[0];
        if (order) {
            return { body: `Your order ${order.orderNumber} is currently ${String(order.status).toLowerCase().replaceAll('_', ' ')}. Open Track order from your Orders page for the full timeline.`, handoff: false };
        }
        return { body: orderNumber ? `I could not find ${orderNumber} in your orders. Please check the number and try again, or I can transfer this to staff for a manual lookup.` : 'I can check that for you. Please include your order number, such as ORD-20260917-AB12, and I will look for it.', handoff: !orderNumber };
    }

    if (hasAny(normalized, ['return', 'refund', 'exchange', 'wrong item', 'damaged'])) {
        return { body: 'I can help start a return or refund request. Please share the order number and tell me whether the item is damaged, incorrect, or simply unwanted. A staff member will confirm eligibility before any refund is issued.', handoff: false };
    }

    if (hasAny(normalized, ['delivery', 'shipping', 'ship', 'arrive', 'how long'])) {
        const shippingMethods = await prisma.shippingMethod.findMany({ where: { active: true, zone: { active: true } }, select: { name: true, flatRate: true, minDays: true, maxDays: true }, orderBy: { flatRate: 'asc' }, take: 4 });
        if (shippingMethods.length) {
            const options = shippingMethods.map((method) => `${method.name}: ${formatPrice(method.flatRate, 'GHS')} (${method.minDays}-${method.maxDays} days)`).join('; ');
            return { body: `Available delivery options are ${options}. The final choice and fee depend on your destination and appear during checkout.`, handoff: false };
        }
        return { body: 'Delivery choices and fees are calculated at checkout from your destination. Standard delivery timing can vary by country and stock status; share your country and I can narrow this down.', handoff: false };
    }

    if (hasAny(normalized, ['pay', 'payment', 'card', 'checkout', 'coupon', 'discount'])) {
        return { body: 'Checkout calculates your final total from item prices, shipping, tax, service fees, and any valid coupon before payment is confirmed. The available payment methods are shown for your region at checkout.', handoff: false };
    }

    if (hasAny(normalized, ['recommend', 'looking for', 'find me', 'suggest', 'product', 'price', 'cost', 'available', 'stock', 'buy'])) {
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE', visibility: true, deletedAt: null },
            select: { name: true, description: true, shortDescription: true, features: true, price: true, category: { select: { name: true } }, inventory: { select: { available: true } } },
            orderBy: { featured: 'desc' },
            take: 100
        });
        const terms = normalize(message).split(' ').filter((term) => term.length > 2 && !['please', 'can', 'you', 'have', 'the', 'for', 'with', 'show', 'me', 'need'].includes(term));
        const matches = products.map((product) => {
            const searchable = normalize([product.name, product.category?.name, product.description, product.shortDescription, product.features].filter(Boolean).join(' '));
            const score = terms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0);
            return { product, score };
        }).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score || Number(left.product.price) - Number(right.product.price)).slice(0, 3);
        if (matches.length) {
            const suggestions = matches.map(({ product }) => `${product.name} (${formatPrice(product.price, 'GHS')}, ${product.inventory?.available ? `${product.inventory.available} available` : 'currently out of stock'})`).join('; ');
            return { body: `Based on your request, I recommend: ${suggestions}. I can compare any of these products if you tell me what matters most to you.`, handoff: false };
        }
        const categories = [...new Set(products.map((product) => product.category?.name).filter(Boolean))].slice(0, 6).join(', ');
        if (categories) return { body: `I can help you browse ${categories}. Tell me your preferred category, budget, or use case and I will narrow the options.`, handoff: false };
    }

    if (hasAny(normalized, ['account', 'sign in', 'login', 'profile'])) {
        return { body: 'You can manage your profile, saved addresses, orders, and notifications from the account menu. I can guide you to the right page, but I cannot change account details for you.', handoff: false };
    }

    return { body: handoffBody, handoff: true };
}
