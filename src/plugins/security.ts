import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const securityPlugin: FastifyPluginAsync = async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: false
  });
};

export default fp(securityPlugin, { name: 'security' });
