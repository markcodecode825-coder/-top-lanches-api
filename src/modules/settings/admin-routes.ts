import type { FastifyPluginAsync } from 'fastify';
import { ACCEPT_ORDERS_WHEN_CLOSED_KEY } from '../../config/constants';
import { settingsBodyJsonSchema } from '../../docs/request-schemas';
import { settingsResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { parseInput } from '../../utils/zod';
import { settingsPatchSchema } from './schemas';
import { getSettings } from './service';

const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/settings', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Retorna configurações administrativas',
      response: { 200: settingsResponseJsonSchema, ...standardErrorResponses }
    }
  }, async () => getSettings(app.prisma));

  app.patch('/settings', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Atualiza configurações administrativas',
      body: settingsBodyJsonSchema,
      response: { 200: settingsResponseJsonSchema, ...standardErrorResponses }
    }
  }, async (request) => {
    const input = parseInput(settingsPatchSchema, request.body);
    if (input.acceptOrdersWhenClosed !== undefined) {
      await app.prisma.setting.upsert({
        where: { key: ACCEPT_ORDERS_WHEN_CLOSED_KEY },
        update: { value: input.acceptOrdersWhenClosed },
        create: { key: ACCEPT_ORDERS_WHEN_CLOSED_KEY, value: input.acceptOrdersWhenClosed }
      });
    }
    app.cache.clear();
    return getSettings(app.prisma);
  });
};

export default adminSettingsRoutes;
