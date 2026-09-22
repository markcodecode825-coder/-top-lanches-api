import { z } from 'zod';

export const settingsPatchSchema = z
  .object({
    acceptOrdersWhenClosed: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe pelo menos uma configuração');
