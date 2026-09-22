import type { FastifyPluginAsync } from 'fastify';
import { apiRootResponseJsonSchema, errorResponseJsonSchema, healthResponseJsonSchema } from '../../docs/response-schemas';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    config: { rateLimit: false },
    schema: { tags: ['system'], summary: 'Verifica API e conexão com PostgreSQL', response: { 200: healthResponseJsonSchema, 503: healthResponseJsonSchema } }
  }, async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      app.log.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        'Database health check failed'
      );
      return reply.status(503).send({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  });
};

export const apiRootRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: { tags: ['system'], summary: 'Metadados da API', response: { 200: apiRootResponseJsonSchema, 500: errorResponseJsonSchema } }
  }, async () => ({
    name: 'Top Lanches API',
    version: '1.1.0',
    docs: '/docs',
    health: '/health'
  }));
};
