import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env';
import { createOrderBodyJsonSchema, idParamsSchema, idempotencyHeadersJsonSchema } from '../../docs/request-schemas';
import { orderResponseJsonSchema, standardErrorResponses, whatsappResponseJsonSchema } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../../utils/whatsapp';
import { parseInput } from '../../utils/zod';
import { getBusiness } from '../business/service';
import { createOrderSchema } from './schemas';
import { createOrder, getOrderById, presentOrder } from './service';

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/orders', {
    config: { rateLimit: { max: env.ORDER_RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW } },
    schema: { tags: ['orders'], summary: 'Cria pedido calculando todos os preços no backend', headers: idempotencyHeadersJsonSchema, body: createOrderBodyJsonSchema, response: { 200: orderResponseJsonSchema, 201: orderResponseJsonSchema, ...standardErrorResponses } }
  }, async (request, reply) => {
    const input = parseInput(createOrderSchema, request.body);
    const rawKey = request.headers['idempotency-key'];
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;
    if (idempotencyKey !== undefined && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
      throw new AppError('VALIDATION_ERROR', 422, 'Idempotency-Key deve ter entre 8 e 200 caracteres');
    }
    const result = await createOrder(app.prisma, input, idempotencyKey);
    return reply.status(result.reused ? 200 : 201).send(presentOrder(result.order));
  });

  app.get('/orders/:id/whatsapp', {
    schema: { tags: ['orders'], summary: 'Gera mensagem e URL do WhatsApp sem enviar automaticamente', params: idParamsSchema, response: { 200: whatsappResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const [order, business] = await Promise.all([getOrderById(app.prisma, id), getBusiness(app.prisma)]);
    const message = buildWhatsAppMessage(order, business.name);
    return { message, url: buildWhatsAppUrl(business.whatsapp, message) };
  });
};

export default orderRoutes;
