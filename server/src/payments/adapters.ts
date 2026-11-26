import crypto from 'node:crypto';
import type { PaymentProvider, PaymentRequest, ProviderResult } from './provider';

abstract class ConfiguredProvider implements PaymentProvider {
  abstract readonly name: string;
  protected abstract readonly signingSecret: string | undefined;

  async initialize(request: PaymentRequest): Promise<ProviderResult> {
    return { providerReference: `${this.name.toUpperCase()}-${request.reference}`, status: 'PENDING', metadata: { mode: 'adapter-ready' } };
  }

  async verify(reference: string): Promise<ProviderResult> {
    return { providerReference: reference, status: 'PENDING', metadata: { mode: 'adapter-ready' } };
  }

  async refund(reference: string, _amount?: number): Promise<ProviderResult> {
    return { providerReference: reference, status: 'REFUNDED', metadata: { mode: 'adapter-ready' } };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!this.signingSecret || !signature) return false;
    const expected = crypto.createHmac('sha512', this.signingSecret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }
}

export class PaystackProvider extends ConfiguredProvider {
  readonly name = 'paystack';
  protected signingSecret = process.env.PAYSTACK_SECRET_KEY;
  private publicKey = process.env.PAYSTACK_PUBLIC_KEY;

  configure(settings: { secretKey?: string; publicKey?: string }) { const clean = (value?: string) => { let cleaned = String(value || '').replace(/[^\x20-\x7E]/g, '').trim().replace(/^['"]+|['"]+$/g, '').trim(); const key = cleaned.match(/(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+/i)?.[0]; return key || cleaned; }; this.signingSecret = clean(settings.secretKey || process.env.PAYSTACK_SECRET_KEY) || undefined; this.publicKey = clean(settings.publicKey || process.env.PAYSTACK_PUBLIC_KEY) || undefined; }

  private async request(path: string, init: RequestInit) {
    if (!this.signingSecret) return null;
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${this.signingSecret}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    } catch (error) {
      throw new Error(`Unable to reach Paystack: ${error instanceof Error ? error.message : String(error)}`);
    }
    const body = await response.text();
    let payload: { status?: boolean; message?: string; data?: Record<string, unknown> } = {};
    try { payload = JSON.parse(body) as typeof payload; } catch { throw new Error(`Paystack returned an invalid response (HTTP ${response.status}).`); }
    if (!response.ok || !payload.status) throw new Error(`Paystack request failed (HTTP ${response.status}): ${payload.message || 'Unknown provider error'}`);
    return payload.data || {};
  }

  async initialize(request: PaymentRequest): Promise<ProviderResult> {
    if (!this.signingSecret) return super.initialize(request);
    const callbackUrl = `${process.env.APP_URL || 'http://localhost:4000'}/api/v1/payments/paystack/callback`;
    const data = (await this.request('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: request.email, amount: Math.round(request.amount * 100), currency: request.currency, reference: request.reference, callback_url: callbackUrl, metadata: request.metadata ? JSON.stringify(request.metadata) : undefined }) })) || {};
    const metadata: Record<string, unknown> = { provider: 'paystack' };
    if (data.access_code) metadata.accessCode = data.access_code;
    if (this.publicKey) metadata.publicKey = this.publicKey;
    return { providerReference: String(data.reference || request.reference), redirectUrl: String(data.authorization_url || ''), status: 'PENDING', metadata };
  }

  async verify(reference: string): Promise<ProviderResult> {
    if (!this.signingSecret) return super.verify(reference);
    const data = (await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' })) || {};
    const status = data.status === 'success' ? 'SUCCESS' : data.status === 'failed' ? 'FAILED' : 'PROCESSING';
    return { providerReference: String(data.reference || reference), status, metadata: { transactionId: data.id, channel: data.channel, gatewayResponse: data.gateway_response } };
  }

  async refund(reference: string, amount?: number): Promise<ProviderResult> {
    if (!this.signingSecret) return super.refund(reference, amount);
    const data = (await this.request(`/refund`, { method: 'POST', body: JSON.stringify({ transaction: reference, ...(amount === undefined ? {} : { amount: Math.round(amount * 100) }) }) })) || {};
    return { providerReference: String(data.transaction || reference), status: 'REFUNDED', metadata: { refundId: data.id, status: data.status } };
  }
}
export const providers: Record<string, PaymentProvider> = { paystack: new PaystackProvider() };