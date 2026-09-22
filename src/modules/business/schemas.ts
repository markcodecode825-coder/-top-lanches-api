import { IANAZone } from 'luxon';
import { z } from 'zod';
import { isValidTime, timeToMinutes } from '../../utils/time';

export const businessPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    whatsapp: z.string().trim().regex(/^\d{10,15}$/).optional(),
    whatsappFormatted: z.string().trim().min(8).max(30).optional(),
    instagram: z.string().trim().min(2).max(100).optional(),
    address: z.string().trim().min(1).max(250).optional(),
    timezone: z
      .string()
      .trim()
      .refine((value) => IANAZone.isValidZone(value), 'Timezone IANA inválido')
      .optional()
  })
  .strict();

const periodSchema = z
  .object({
    open: z.string().refine(isValidTime, 'Horário de abertura inválido'),
    close: z.string().refine(isValidTime, 'Horário de fechamento inválido')
  })
  .strict()
  .refine((period) => timeToMinutes(period.open) < timeToMinutes(period.close), {
    message: 'O horário de abertura deve ser anterior ao fechamento'
  });

export const hoursPutSchema = z
  .array(
    z
      .object({
        dayOfWeek: z.number().int().min(1).max(7),
        periods: z.array(periodSchema).max(8)
      })
      .strict()
  )
  .min(1)
  .max(7)
  .superRefine((days, ctx) => {
    const uniqueDays = new Set<number>();
    for (const day of days) {
      if (uniqueDays.has(day.dayOfWeek)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dia da semana duplicado' });
      }
      uniqueDays.add(day.dayOfWeek);
      const sorted = [...day.periods].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open));
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (previous && current && timeToMinutes(current.open) < timeToMinutes(previous.close)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Períodos sobrepostos no dia ${day.dayOfWeek}`
          });
        }
      }
    }
  });

export const enablePatchSchema = z.object({ enabled: z.boolean() }).strict();
