import assert from 'node:assert/strict';
import test from 'node:test';
import { safeBody } from '../server/src/middleware/activity-log';
import { isPublicCoupon, publicCouponWhere, redactSingleUseCoupon } from '../server/src/modules/coupons';

test('one-time coupon codes are hidden from admin listings and public offers', () => {
  const coupon = { code: 'PRIVATE-123', usageLimit: 1, usedCount: 0 };

  assert.equal(redactSingleUseCoupon(coupon).code, null);
  assert.equal(isPublicCoupon(coupon), false);
});

test('coupons with multiple or unlimited uses retain their normal visibility', () => {
  const availableLimitedCoupon = { code: 'SAVE-10', usageLimit: 5, usedCount: 4 };
  const exhaustedCoupon = { code: 'SOLD-OUT', usageLimit: 5, usedCount: 5 };
  const unlimitedCoupon = { code: 'WELCOME', usageLimit: null, usedCount: 9 };

  assert.equal(redactSingleUseCoupon(availableLimitedCoupon).code, 'SAVE-10');
  assert.equal(isPublicCoupon(availableLimitedCoupon), true);
  assert.equal(isPublicCoupon(exhaustedCoupon), false);
  assert.equal(redactSingleUseCoupon(unlimitedCoupon).code, 'WELCOME');
  assert.equal(isPublicCoupon(unlimitedCoupon), true);
});

test('public offer lookup excludes coupons redeemed by the signed-in customer', () => {
  const now = new Date('2026-11-26T00:00:00.000Z');

  assert.deepEqual(publicCouponWhere(now, 'customer-123'), {
    active: true,
    published: true,
    OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    redemptions: { none: { userId: 'customer-123' } }
  });
  assert.equal('redemptions' in publicCouponWhere(now), false);
});

test('coupon codes are not retained in activity audit payloads', () => {
  const body = safeBody({ code: 'PRIVATE-123', couponCode: 'PRIVATE-123', note: 'manual campaign' }, true);

  assert.deepEqual(body, { code: '[REDACTED]', couponCode: '[REDACTED]', note: 'manual campaign' });
});
