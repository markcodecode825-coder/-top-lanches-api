import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (request) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Autenticação necessária');
    }

    const admin = await app.prisma.admin.findUnique({
      where: { id: request.user.sub },
      select: { active: true }
    });

    if (!admin?.active) {
      throw new AppError('FORBIDDEN', 403, 'Administrador inativo ou inexistente');
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
