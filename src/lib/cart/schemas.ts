import { z } from 'zod';
import { GRINDS, PURCHASE_TYPES } from '@/lib/db/schema/values';

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const addToCartSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(10).default(1),
    grind: z.preprocess(emptyToNull, z.enum(GRINDS).nullable().default(null)),
    purchaseType: z.enum(PURCHASE_TYPES).default('one_time'),
    subscriptionIntervalWeeks: z.preprocess(
      emptyToNull,
      z.coerce
        .number()
        .int()
        .refine((n) => [2, 4, 6].includes(n), 'Choose 2, 4 or 6 weeks')
        .nullable()
        .default(null),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.purchaseType === 'subscription' && v.subscriptionIntervalWeeks === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subscriptionIntervalWeeks'],
        message: 'Choose a delivery interval.',
      });
    }
  })
  .transform((v) => ({
    ...v,
    subscriptionIntervalWeeks:
      v.purchaseType === 'subscription' ? v.subscriptionIntervalWeeks : null,
  }));

export type AddLineInput = z.infer<typeof addToCartSchema>;

export const updateQuantitySchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(10),
});

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter a code.')
    .max(32)
    .transform((s) => s.toUpperCase()),
});
