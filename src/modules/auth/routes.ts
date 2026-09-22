import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env';
import { loginBodyJsonSchema } from '../../docs/request-schemas';
import { loginResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { parseInput } from '../../utils/zod';
import { loginSchema } from './schemas';
import { durationToSeconds, validateAdminCredentials } from './service';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', {
    config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW } },
    schema: { tags: ['admin-auth'], summary: 'Autentica um administrador e retorna JWT', body: loginBodyJsonSchema, response: { 200: loginResponseJsonSchema, ...standardErrorResponses } }
  }, async (request, reply) => {
    const input = parseInput(loginSchema, request.body);
    const admin = await validateAdminCredentials(app.prisma, input.email, input.password);
    const accessToken = await reply.jwtSign(
      { sub: admin.id, email: admin.email, name: admin.name },
      { expiresIn: env.JWT_EXPIRES_IN }
    );
    return {
      accessToken,
      expiresIn: durationToSeconds(env.JWT_EXPIRES_IN)
    };
  });
};

export default authRoutes;
