import { randomUUID } from 'node:crypto';
import { luhnCheck, normalizeCardNumber } from './luhn';
import type { AuthorizeInput, AuthorizeResult, PaymentDeclineCode, PaymentProvider } from './types';
import { TEST_CARDS } from './test-cards';

export { TEST_CARDS } from './test-cards';

const outcomes: Record<string, { code: PaymentDeclineCode; message: string }> = {
  [TEST_CARDS.declined]: { code: 'declined', message: 'Your card was declined.' },
  [TEST_CARDS.insufficientFunds]: {
    code: 'insufficient_funds',
    message: 'Your card has insufficient funds.',
  },
  [TEST_CARDS.processingError]: {
    code: 'processing_error',
    message: 'We could not process your card. Try again.',
  },
};

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    const number = normalizeCardNumber(input.card.number);
    const invalid = (message: string): AuthorizeResult => ({
      ok: false,
      code: 'invalid_card',
      message,
    });

    if (!luhnCheck(number)) return invalid('That card number does not look right.');
    if (!/^\d{3,4}$/.test(input.card.cvc)) return invalid('Enter the 3 or 4 digit security code.');
    if (
      !Number.isInteger(input.card.expMonth) ||
      input.card.expMonth < 1 ||
      input.card.expMonth > 12
    ) {
      return invalid('Enter a valid expiry month.');
    }
    const now = this.now();
    const expiresEnd = new Date(Date.UTC(input.card.expYear, input.card.expMonth, 1));
    if (expiresEnd <= now) return invalid('That card has expired.');
    if (input.card.name.trim().length < 2) return invalid('Enter the name on the card.');
    if (input.amountCents <= 0)
      return { ok: false, code: 'processing_error', message: 'Nothing to charge.' };

    const forced = outcomes[number];
    if (forced) return { ok: false, ...forced };

    return {
      ok: true,
      reference: `sim_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      last4: number.slice(-4),
    };
  }
}
