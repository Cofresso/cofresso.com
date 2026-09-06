import { z } from 'zod';
import { luhnCheck } from '@/lib/payments/luhn';

const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(120).optional(),
);

export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

export const shippingSchema = z.object({
  shippingName: z.string().trim().min(2, 'Enter the recipient name.').max(120),
  address1: z.string().trim().min(3, 'Enter a street address.').max(120),
  address2: optionalText,
  city: z.string().trim().min(2, 'Enter a city.').max(80),
  state: z.string().trim().min(2, 'Enter a state or region.').max(40),
  postalCode: z.string().trim().min(3, 'Enter a postal code.').max(12),
  country: z
    .string()
    .trim()
    .length(2, 'Use a two-letter country code.')
    .toUpperCase()
    .default('US'),
});

export const paymentSchema = z.object({
  cardNumber: z.string().refine((s) => luhnCheck(s), 'Enter a valid card number.'),
  cardName: z.string().trim().min(2, 'Enter the name on the card.').max(120),
  expMonth: z.coerce.number().int().min(1, 'Enter a valid month.').max(12, 'Enter a valid month.'),
  expYear: z.coerce.number().int().min(2024).max(2100),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, 'Enter the 3 or 4 digit code.'),
});

export const checkoutSchema = contactSchema.merge(shippingSchema).merge(paymentSchema).extend({
  idempotencyKey: z.string().uuid(),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ShippingInput = z.infer<typeof shippingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
