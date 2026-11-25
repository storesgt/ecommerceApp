import assert from 'node:assert/strict';
import test from 'node:test';
import { mailDeliveryErrorMessage, MailDeliveryError, renderBrandedEmail } from '../server/src/lib/mailer';

test('SMTP test email reports DNS failures as a hostname configuration issue', () => {
  const error = new MailDeliveryError({ code: 'EDNS' });
  assert.match(mailDeliveryErrorMessage(error), /SMTP host could not be resolved/);
});

test('SMTP test email reports authentication failures as a credential issue', () => {
  const error = new MailDeliveryError({ code: 'EAUTH', responseCode: 535 });
  assert.match(mailDeliveryErrorMessage(error), /rejected authentication/);
});

test('branded email includes logo, store header, footer, and preheader', () => {
  const html = renderBrandedEmail({
    host: 'mail.example.com', port: 465, secure: true, user: 'u', password: 'p', from: 'Store <u@example.com>',
    storeName: 'Acme Store', supportEmail: 'help@acme.test', logoUrl: 'https://cdn.example.com/logo.png', appUrl: 'https://acme.test', adminConfigured: true,
  }, '<p>Hello</p>', 'Preview text');
  assert.match(html, /Preview text/);
  assert.match(html, /Acme Store/);
  assert.match(html, /https:\/\/cdn\.example\.com\/logo\.png/);
  assert.match(html, /help@acme\.test/);
  assert.match(html, /Hello/);
});
