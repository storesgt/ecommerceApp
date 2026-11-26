import assert from 'node:assert/strict';
import test from 'node:test';
import { safeBody } from '../server/src/middleware/activity-log';
import { isPublicCoupon, redactSingleUseCoupon } from '../server/src/modules/coupons';

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

test('coupon codes are not retained in activity audit payloads', () => {
  const body = safeBody({ code: 'PRIVATE-123', couponCode: 'PRIVATE-123', note: 'manual campaign' }, true);

  assert.deepEqual(body, { code: '[REDACTED]', couponCode: '[REDACTED]', note: 'manual campaign' });
});
