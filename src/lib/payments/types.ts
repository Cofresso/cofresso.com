export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  name: string;
}

export interface AuthorizeInput {
  amountCents: number;
  currency: 'USD';
  card: CardInput;
  idempotencyKey: string;
}

export type PaymentDeclineCode =
  'declined' | 'insufficient_funds' | 'invalid_card' | 'processing_error';

export type AuthorizeResult =
  | { ok: true; reference: string; last4: string }
  | { ok: false; code: PaymentDeclineCode; message: string };

export interface PaymentProvider {
  readonly name: string;
  authorize(input: AuthorizeInput): Promise<AuthorizeResult>;
}
