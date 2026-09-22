import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';

const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    hook: 'onRequest',
    errorResponseBuilder: (request, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Limite de requisições excedido.',
        statusCode: 429,
        retryAfter: context.after,
        requestId: request.id
      }
    })
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
