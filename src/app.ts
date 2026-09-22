import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { API_PREFIX } from './config/constants';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { registerErrorHandler } from './errors/error-handler';
import authPlugin from './plugins/auth';
import cachePlugin from './plugins/cache';
import corsPlugin from './plugins/cors';
import rateLimitPlugin from './plugins/rate-limit';
import securityPlugin from './plugins/security';
import swaggerPlugin from './plugins/swagger';
import authRoutes from './modules/auth/routes';
import adminBusinessRoutes from './modules/business/admin-routes';
import publicBusinessRoutes from './modules/business/routes';
import adminCategoryRoutes from './modules/categories/admin-routes';
import publicCategoryRoutes from './modules/categories/routes';
import { apiRootRoutes, healthRoutes } from './modules/core/routes';
import menuRoutes from './modules/menu/routes';
import adminOrderRoutes from './modules/orders/admin-routes';
import orderRoutes from './modules/orders/routes';
import adminProductRoutes from './modules/products/admin-routes';
import publicProductRoutes from './modules/products/routes';
import searchRoutes from './modules/search/routes';
import adminSettingsRoutes from './modules/settings/admin-routes';
import adminWhatsAppRoutes from './modules/whatsapp/admin-routes';
import whatsappRoutes from './modules/whatsapp/routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]'
      }
    },
    bodyLimit: 1024 * 1024,
    ignoreTrailingSlash: true,
    trustProxy: env.TRUST_PROXY,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    disableRequestLogging: true
  });

  app.decorate('prisma', prisma);
  registerErrorHandler(app);

  await app.register(cachePlugin);
  await app.register(corsPlugin);
  await app.register(securityPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);
  await app.register(authPlugin);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id);
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        route: request.routeOptions.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime
      },
      'request completed'
    );
  });

  await app.register(healthRoutes);
  await app.register(apiRootRoutes, { prefix: API_PREFIX });
  await app.register(publicBusinessRoutes, { prefix: API_PREFIX });
  await app.register(publicCategoryRoutes, { prefix: API_PREFIX });
  await app.register(publicProductRoutes, { prefix: API_PREFIX });
  await app.register(searchRoutes, { prefix: API_PREFIX });
  await app.register(menuRoutes, { prefix: API_PREFIX });
  await app.register(orderRoutes, { prefix: API_PREFIX });
  await app.register(whatsappRoutes, { prefix: API_PREFIX });

  const adminPrefix = `${API_PREFIX}/admin`;
  await app.register(authRoutes, { prefix: adminPrefix });
  await app.register(adminBusinessRoutes, { prefix: adminPrefix });
  await app.register(adminCategoryRoutes, { prefix: adminPrefix });
  await app.register(adminProductRoutes, { prefix: adminPrefix });
  await app.register(adminOrderRoutes, { prefix: adminPrefix });
  await app.register(adminSettingsRoutes, { prefix: adminPrefix });
  await app.register(adminWhatsAppRoutes, { prefix: adminPrefix });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
