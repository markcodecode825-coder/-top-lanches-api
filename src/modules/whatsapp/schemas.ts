import { z } from 'zod';

export const webhookVerificationQuerySchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string()
});

export const sendTextMessageSchema = z.object({
  to: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/, 'Telefone deve conter entre 10 e 15 dígitos'),
  text: z.string().min(1).max(4096),
  previewUrl: z.boolean().optional().default(false)
});

export const sendTemplateMessageSchema = z.object({
  to: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/, 'Telefone deve conter entre 10 e 15 dígitos'),
  templateName: z.string().trim().min(1).max(512),
  languageCode: z.string().trim().min(2).max(20),
  components: z.array(z.record(z.unknown())).optional()
});

export const sendOrderMessageParamsSchema = z.object({
  id: z.string().uuid()
});

export const registerPhoneSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN deve conter exatamente 6 dígitos')
});

export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>;
export type SendTemplateMessageInput = z.infer<typeof sendTemplateMessageSchema>;
