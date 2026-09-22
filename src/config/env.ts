import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
    JWT_EXPIRES_IN: z.string().min(1).default('1h'),
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL deve ser um e-mail válido'),
    ADMIN_PASSWORD: z.string().min(6, 'ADMIN_PASSWORD deve ter pelo menos 6 caracteres'),
    ADMIN_NAME: z.string().min(1).default('Administrador'),
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS é obrigatória'),
    BUSINESS_TIMEZONE: z.string().min(1, 'BUSINESS_TIMEZONE é obrigatória'),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    ORDER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    SEARCH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    MAX_PAGE_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(30),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: booleanString,
    WHATSAPP_CLOUD_ENABLED: booleanString,
    WHATSAPP_BOT_ENABLED: booleanString,
    WHATSAPP_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, 'WHATSAPP_GRAPH_API_VERSION deve seguir o formato vXX.X').default('v26.0'),
    WHATSAPP_VERIFY_TOKEN: z.string().default(''),
    WHATSAPP_APP_SECRET: z.string().default(''),
    WHATSAPP_ACCESS_TOKEN: z.string().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_WABA_ID: z.string().default(''),
    WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/).default('55'),
    WHATSAPP_WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
    WHATSAPP_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000)
  })
  .superRefine((value, ctx) => {
    if (value.WHATSAPP_CLOUD_ENABLED) {
      const requiredWhatsAppFields = [
        ['WHATSAPP_VERIFY_TOKEN', value.WHATSAPP_VERIFY_TOKEN],
        ['WHATSAPP_APP_SECRET', value.WHATSAPP_APP_SECRET],
        ['WHATSAPP_ACCESS_TOKEN', value.WHATSAPP_ACCESS_TOKEN],
        ['WHATSAPP_PHONE_NUMBER_ID', value.WHATSAPP_PHONE_NUMBER_ID],
        ['WHATSAPP_WABA_ID', value.WHATSAPP_WABA_ID]
      ] as const;

      for (const [field, fieldValue] of requiredWhatsAppFields) {
        if (!fieldValue.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} é obrigatória quando WHATSAPP_CLOUD_ENABLED=true`
          });
        }
      }
    }

    if (value.NODE_ENV !== 'production') return;

    if (value.JWT_SECRET.toLowerCase().includes('change-me')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET padrão não é permitido em produção'
      });
    }

    if (value.ADMIN_PASSWORD === 'change-me') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_PASSWORD'],
        message: 'ADMIN_PASSWORD padrão não é permitido em produção'
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
}

export const env = result.data;
export const corsOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
