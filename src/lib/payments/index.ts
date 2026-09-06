import { SimulatedPaymentProvider } from './simulated';
import type { PaymentProvider } from './types';

export * from './types';
export * from './luhn';
export { SimulatedPaymentProvider, TEST_CARDS } from './simulated';

let provider: PaymentProvider | undefined;

/** The only provider today is simulated. Swap here when a real gateway lands. */
export function getPaymentProvider(): PaymentProvider {
  provider ??= new SimulatedPaymentProvider();
  return provider;
}
