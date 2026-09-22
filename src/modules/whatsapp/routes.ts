import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env';
import { errorResponseJsonSchema } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { parseInput } from '../../utils/zod';
import { getWhatsAppRawBody, registerWhatsAppJsonParser } from './raw-json';
import { persistWebhookSummary } from './persistence';
import { webhookVerificationQuerySchema } from './schemas';
import { summarizeWebhook, verifyWebhookChallenge, verifyWebhookSignature } from './service';

const verificationQueryJsonSchema = {
  type: 'object',
  required: ['hub.mode', 'hub.verify_token', 'hub.challenge'],
  properties: {
    'hub.mode': { type: 'string' },
    'hub.verify_token': { type: 'string' },
    'hub.challenge': { type: 'string' }
  }
} as const;

const webhookBodyJsonSchema = {
  type: 'object',
  additionalProperties: true
} as const;

const whatsappRoutes: FastifyPluginAsync = async (app) => {
  registerWhatsAppJsonParser(app);

  app.get('/whatsapp/webhook', {
    schema: {
      tags: ['whatsapp'],
      summary: 'Verificação do webhook pela Meta',
      querystring: verificationQueryJsonSchema,
      response: {
        200: { type: 'string' },
        403: errorResponseJsonSchema,
        503: errorResponseJsonSchema
      }
    }
  }, async (request, reply) => {
    const query = parseInput(webhookVerificationQuerySchema, request.query);
    if (!verifyWebhookChallenge(query['hub.mode'], query['hub.verify_token'])) {
      throw new AppError('FORBIDDEN', 403, 'Falha na verificação do webhook');
    }
    return reply.type('text/plain').send(query['hub.challenge']);
  });

  app.post('/whatsapp/webhook', {
    config: { rateLimit: { max: env.WHATSAPP_WEBHOOK_RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW } },
    schema: {
      tags: ['whatsapp'],
      summary: 'Recebe eventos da WhatsApp Cloud API',
      headers: {
        type: 'object',
        properties: {
          'x-hub-signature-256': { type: 'string', description: 'Assinatura HMAC SHA-256 enviada pela Meta' }
        }
      },
      body: webhookBodyJsonSchema,
      response: {
        200: {
          type: 'object',
          required: ['received'],
          properties: { received: { type: 'boolean' } }
        },
        401: errorResponseJsonSchema,
        503: errorResponseJsonSchema
      }
    }
  }, async (request) => {
    const rawBody = getWhatsAppRawBody(request.body);
    const rawSignature = request.headers['x-hub-signature-256'];
    const signature = typeof rawSignature === 'string' ? rawSignature : undefined;

    if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('WHATSAPP_SIGNATURE_INVALID', 401, 'Assinatura do webhook inválida');
    }

    const summary = summarizeWebhook(request.body);
    const persistence = await persistWebhookSummary(app.prisma, rawBody, summary);
    request.log.info(
      {
        requestId: request.id,
        whatsappObject: summary.object,
        inboundMessageCount: summary.messages.length,
        statusUpdateCount: summary.statuses.length,
        inboundTypes: [...new Set(summary.messages.map((message) => message.type))],
        statuses: [...new Set(summary.statuses.map((status) => status.status))],
        duplicateDelivery: persistence.duplicate
      },
      'WhatsApp webhook received'
    );

    return { received: true };
  });
};

export default whatsappRoutes;
