import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { normalizeKycSubmitBody } from '../server/src/modules/users';
import { PaystackProvider } from '../server/src/payments/adapters';

test('Paystack webhook signatures accept the exact HMAC digest', () => {
  const provider = new PaystackProvider();
  const payload = JSON.stringify({ eventId: 'evt-1', reference: 'PAY-1', status: 'SUCCESS' });
  const secret = process.env.PAYSTACK_SECRET_KEY || '';
  if (!secret) return;
  const signature = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  assert.equal(provider.verifyWebhookSignature(payload, signature), true);
});

test('webhook signatures reject missing, altered, and malformed signatures', () => {
  const provider = new PaystackProvider();
  const payload = JSON.stringify({ eventId: 'evt-2' });
  assert.equal(provider.verifyWebhookSignature(payload, undefined), false);
  assert.equal(provider.verifyWebhookSignature(payload, 'not-a-signature'), false);
});

test('profile KYC normalization turns the public form body into the server contract', () => {
  const normalized = normalizeKycSubmitBody({
    documentType: '  Passport  ',
    documentNumber: 'A-90210',
    documents: ['http://localhost:4000/uploads/doc.png'],
    documentUrl: 'http://localhost:4000/uploads/doc.png',
    notes: ' ',
    aliases: ' ',
    dateOfBirth: '2026-09-14',
    nationality: '  Ghana  ',
    currentAddress: 'House 12, Accra',
    previousAddresses: ['Old House 1, Accra'],
    proofOfAddressUrl: 'http://localhost:4000/uploads/proof.png',
    selfieUrl: 'http://localhost:4000/uploads/selfie.png',
    ndaSigned: true,
    acceptableUsePolicyAccepted: true,
    accessTier: 'LEVEL_1_SUPPORT'
  });

  assert.equal(normalized.documentType, 'Passport');
  assert.equal(normalized.documentNumber, 'A-90210');
  assert.deepEqual(normalized.documents, ['http://localhost:4000/uploads/doc.png']);
  assert.equal(normalized.documentUrl, 'http://localhost:4000/uploads/doc.png');
  assert.equal(normalized.aliases, undefined);
  assert.equal(normalized.dateOfBirth, '2026-09-14');
  assert.equal(normalized.nationality, 'Ghana');
  assert.equal(normalized.currentAddress, 'House 12, Accra');
  assert.deepEqual(normalized.previousAddresses, ['Old House 1, Accra']);
  assert.equal(normalized.proofOfAddressUrl, 'http://localhost:4000/uploads/proof.png');
  assert.equal(normalized.selfieUrl, 'http://localhost:4000/uploads/selfie.png');
  assert.equal(normalized.ndaSigned, true);
  assert.equal(normalized.acceptableUsePolicyAccepted, true);
  assert.equal(normalized.accessTier, 'LEVEL_1_SUPPORT');
});

test('provider adapters remain isolated behind the shared contract', async () => {
  const provider = new PaystackProvider();
  const initialized = await provider.initialize({ reference: 'PAY-TEST', amount: 12, currency: 'USD', email: 'test@example.com' });
  const refunded = await provider.refund('PAY-TEST');
  assert.equal(initialized.status, 'PENDING');
  assert.equal(refunded.status, 'REFUNDED');
  assert.match(initialized.providerReference, /^PAYSTACK-/);
});
