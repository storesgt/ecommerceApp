export type PaymentState = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type PaymentRequest = { reference: string; amount: number; currency: string; email: string; metadata?: Record<string, unknown> };
export type ProviderResult = { providerReference: string; redirectUrl?: string; status: PaymentState; metadata?: Record<string, unknown> };

export interface PaymentProvider {
  readonly name: string;
  configure?(settings: { secretKey?: string; publicKey?: string; clientId?: string; clientSecret?: string; merchantAccount?: string; apiUrl?: string; callbackUrl?: string; webhookSecret?: string }): void;
  initialize(request: PaymentRequest): Promise<ProviderResult>;
  verify(reference: string): Promise<ProviderResult>;
  refund(reference: string, amount?: number): Promise<ProviderResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}