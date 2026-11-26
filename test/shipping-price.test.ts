import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCheckoutShippingPrice, calculateShippingPrice } from '../server/src/lib/shipping-price';

test('flat-rate shipping does not depend on shipment weight', () => {
  assert.equal(calculateShippingPrice('FLAT', 12, 3, 5), 12);
});

test('weight-based shipping uses the base rate and rounds to cents', () => {
  assert.equal(calculateShippingPrice('WEIGHT_BASED', 20, 2.35, 1.5), 23.53);
});

test('courier-quoted delivery is excluded from the checkout charge', () => {
  assert.equal(calculateCheckoutShippingPrice('WEIGHT_BASED', 20, 2.35, 1.5, true), 0);
  assert.equal(calculateCheckoutShippingPrice('WEIGHT_BASED', 20, 2.35, 1.5, false), 23.53);
});
