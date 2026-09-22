import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { standardErrorResponses } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { buildWhatsAppMessage } from '../../utils/whatsapp';
import { parseInput } from '../../utils/zod';
import { getBusiness } from '../business/service';
import { getOrderById } from '../orders/service';
import { persistOutboundMessage } from './persistence';
import {
  registerPhoneSchema,
  sendOrderMessageParamsSchema,
  sendTemplateMessageSchema,
  sendTextMessageSchema
} from './schemas';
import {
  getWhatsAppConfigurationStatus,
  normalizePhoneForWhatsApp,
  registerPhoneNumber,
  sendTemplateMessage,
  sendTextMessage,
  subscribeAppToWaba
} from './service';

const sendTextBodyJsonSchema = {
  type: 'object',
  required: ['to', 'text'],
  additionalProperties: false,
  properties: {
    to: { type: 'string' },
    text: { type: 'string', minLength: 1, maxLength: 4096 },
    previewUrl: { type: 'boolean', default: false }
  }
} as const;

const sendTemplateBodyJsonSchema = {
  type: 'object',
  required: ['to', 'templateName', 'languageCode'],
  additionalProperties: false,
  properties: {
    to: { type: 'string' },
    templateName: { type: 'string' },
    languageCode: { type: 'string' },
    components: { type: 'array', items: { type: 'object', additionalProperties: true } }
  }
} as const;

const registerPhoneBodyJsonSchema = {
  type: 'object',
  required: ['pin'],
  additionalProperties: false,
  properties: {
    pin: {
      type: 'string',
      pattern: '^\\d{6}$',
      description: 'PIN de verificação em duas etapas do número. Nunca é persistido pela API.'
    }
  }
} as const;

const sendResponseSchema = {
  type: 'object',
  required: ['messageId', 'recipientWaId'],
  properties: {
    messageId: { type: 'string', nullable: true },
    recipientWaId: { type: 'string', nullable: true }
  }
} as const;

const successResponseSchema = {
  type: 'object',
  required: ['success'],
  properties: { success: { type: 'boolean' } }
} as const;

async function persistSentMessageSafely(
  app: FastifyInstance,
  requestId: string,
  input: Parameters<typeof persistOutboundMessage>[1]
): Promise<void> {
  try {
    await persistOutboundMessage(app.prisma, input);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : typeof error;
    app.log.error({ requestId, errorType }, 'WhatsApp message accepted by Meta but local persistence failed');
  }
}

const adminWhatsAppRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/whatsapp/status', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Mostra se a integração do WhatsApp está configurada sem expor segredos',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          required: [
            'enabled',
            'botEnabled',
            'botSessionTtlMinutes',
            'graphApiVersion',
            'httpTimeoutMs',
            'phoneNumberIdConfigured',
            'wabaIdConfigured',
            'accessTokenConfigured',
            'appSecretConfigured',
            'verifyTokenConfigured'
          ],
          properties: {
            enabled: { type: 'boolean' },
            botEnabled: { type: 'boolean' },
            botSessionTtlMinutes: { type: 'integer' },
            graphApiVersion: { type: 'string' },
            httpTimeoutMs: { type: 'integer' },
            phoneNumberIdConfigured: { type: 'boolean' },
            wabaIdConfigured: { type: 'boolean' },
            accessTokenConfigured: { type: 'boolean' },
            appSecretConfigured: { type: 'boolean' },
            verifyTokenConfigured: { type: 'boolean' }
          }
        },
        ...standardErrorResponses
      }
    }
  }, async () => getWhatsAppConfigurationStatus());

  app.post('/whatsapp/subscriptions', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Assina o aplicativo na WABA configurada',
      security: [{ bearerAuth: [] }],
      response: { 200: successResponseSchema, ...standardErrorResponses }
    }
  }, async () => ({ success: await subscribeAppToWaba() }));

  app.post('/whatsapp/phone/register', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Registra o Phone Number ID configurado na Cloud API',
      description: 'O PIN é enviado diretamente à Meta e não é persistido.',
      security: [{ bearerAuth: [] }],
      body: registerPhoneBodyJsonSchema,
      response: { 200: successResponseSchema, ...standardErrorResponses }
    }
  }, async (request) => {
    const { pin } = parseInput(registerPhoneSchema, request.body);
    return { success: await registerPhoneNumber(pin) };
  });

  app.post('/whatsapp/messages/text', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Envia uma mensagem de texto pela WhatsApp Cloud API',
      description: 'Use texto livre apenas quando permitido pelas regras de mensageria da Meta. Fora da janela aplicável, use template aprovado.',
      security: [{ bearerAuth: [] }],
      body: sendTextBodyJsonSchema,
      response: { 200: sendResponseSchema, ...standardErrorResponses }
    }
  }, async (request) => {
    const input = parseInput(sendTextMessageSchema, request.body);
    const result = await sendTextMessage(input.to, input.text, input.previewUrl);
    await persistSentMessageSafely(app, request.id, {
      providerMessageId: result.messageId,
      phone: result.recipientWaId ?? normalizePhoneForWhatsApp(input.to),
      type: 'text',
      text: input.text
    });
    return result;
  });

  app.post('/whatsapp/messages/template', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Envia um template previamente aprovado pela Meta',
      security: [{ bearerAuth: [] }],
      body: sendTemplateBodyJsonSchema,
      response: { 200: sendResponseSchema, ...standardErrorResponses }
    }
  }, async (request) => {
    const input = parseInput(sendTemplateMessageSchema, request.body);
    const result = await sendTemplateMessage(input.to, input.templateName, input.languageCode, input.components);
    await persistSentMessageSafely(app, request.id, {
      providerMessageId: result.messageId,
      phone: result.recipientWaId ?? normalizePhoneForWhatsApp(input.to),
      type: 'template',
      templateName: input.templateName
    });
    return result;
  });

  app.post('/whatsapp/orders/:id/send', {
    schema: {
      tags: ['admin', 'whatsapp'],
      summary: 'Envia manualmente o resumo de um pedido ao telefone do cliente',
      description: 'Não é disparado automaticamente ao criar o pedido.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } }
      },
      response: { 200: sendResponseSchema, ...standardErrorResponses }
    }
  }, async (request) => {
    const { id } = parseInput(sendOrderMessageParamsSchema, request.params);
    const [order, business] = await Promise.all([getOrderById(app.prisma, id), getBusiness(app.prisma)]);
    if (!order.customerPhone) {
      throw new AppError('VALIDATION_ERROR', 422, 'O pedido não possui telefone do cliente');
    }
    const message = buildWhatsAppMessage(order, business.name);
    const result = await sendTextMessage(order.customerPhone, message, false);
    await persistSentMessageSafely(app, request.id, {
      providerMessageId: result.messageId,
      phone: result.recipientWaId ?? normalizePhoneForWhatsApp(order.customerPhone),
      type: 'text',
      text: message
    });
    return result;
  });
};

export default adminWhatsAppRoutes;
