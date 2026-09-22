import { z } from 'zod';

export const createOrderSchema = z
  .object({
    customer: z
      .object({
        name: z.string().trim().min(1).max(120),
        phone: z.union([z.string().trim().min(8).max(30), z.null()]).optional()
      })
      .strict(),
    serviceMode: z.string().trim().min(1).max(30),
    paymentMethod: z.string().trim().min(1).max(30),
    cashChangeFor: z.unknown().optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            quantity: z.number().int().min(1).max(99)
          })
          .passthrough()
      )
      .min(1)
      .max(100),
    address: z
      .object({
        street: z.string().trim().min(1).max(180),
        number: z.string().trim().min(1).max(30),
        complement: z.union([z.string().trim().max(180), z.null()]).optional(),
        neighborhood: z.string().trim().min(1).max(120),
        reference: z.union([z.string().trim().max(250), z.null()]).optional()
      })
      .strict()
      .optional(),
    notes: z.union([z.string().trim().max(1000), z.null()]).optional()
  })
  .passthrough();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusPatchSchema = z.object({
  status: z.string().trim().min(1).max(40)
});

export const adminOrdersQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20)
});
