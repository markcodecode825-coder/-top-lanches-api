import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { corsOrigins, env } from '../config/env';

const corsPlugin: FastifyPluginAsync = async (app) => {
  if (env.NODE_ENV === 'production' && corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS não pode conter * em produção.');
  }

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      callback(null, corsOrigins.includes(origin));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id']
  });
};

export default fp(corsPlugin, { name: 'cors' });
