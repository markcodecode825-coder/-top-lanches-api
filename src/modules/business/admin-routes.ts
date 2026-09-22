import type { FastifyPluginAsync } from 'fastify';
import { DEFAULT_BUSINESS_ID } from '../../config/constants';
import { businessPatchBodyJsonSchema, codeParamsSchema, enableBodyJsonSchema, hoursBodyJsonSchema } from '../../docs/request-schemas';
import {
  businessResponseJsonSchema,
  hoursResponseJsonSchema,
  paymentMethodsResponseJsonSchema,
  serviceModesResponseJsonSchema,
  standardErrorResponses
} from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { timeToMinutes } from '../../utils/time';
import { parseInput } from '../../utils/zod';
import { businessPatchSchema, enablePatchSchema, hoursPutSchema } from './schemas';
import { getBusiness, getGroupedHours } from './service';

const adminBusinessRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/business', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Dados administrativos do estabelecimento', response: { 200: businessResponseJsonSchema, ...standardErrorResponses } }
  }, async () => getBusiness(app.prisma));

  app.patch('/business', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Atualiza os dados do estabelecimento', body: businessPatchBodyJsonSchema, response: { 200: businessResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const input = parseInput(businessPatchSchema, request.body);
    await getBusiness(app.prisma);
    const business = await app.prisma.business.update({
      where: { id: DEFAULT_BUSINESS_ID },
      data: input
    });
    app.cache.clear();
    return business;
  });

  app.get('/hours', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Lista horários administrativos', response: { 200: hoursResponseJsonSchema, ...standardErrorResponses } }
  }, async () => getGroupedHours(app.prisma));

  app.put('/hours', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Substitui todos os horários de funcionamento', body: hoursBodyJsonSchema, response: { 200: hoursResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const days = parseInput(hoursPutSchema, request.body);
    await getBusiness(app.prisma);
    await app.prisma.$transaction(async (tx) => {
      await tx.operatingHour.deleteMany({ where: { businessId: DEFAULT_BUSINESS_ID } });
      const data = days.flatMap((day) =>
        [...day.periods]
          .sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open))
          .map((period, index) => ({
            businessId: DEFAULT_BUSINESS_ID,
            dayOfWeek: day.dayOfWeek,
            open: period.open,
            close: period.close,
            priority: index + 1
          }))
      );
      if (data.length > 0) await tx.operatingHour.createMany({ data });
    });
    app.cache.clear();
    return getGroupedHours(app.prisma);
  });

  app.patch('/service-modes/:code', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Ativa ou desativa modalidade de atendimento', params: codeParamsSchema, body: enableBodyJsonSchema, response: { 200: { ...serviceModesResponseJsonSchema.items }, ...standardErrorResponses } }
  }, async (request) => {
    const { code } = request.params as { code: string };
    if (!['delivery', 'pickup', 'dine_in'].includes(code)) {
      throw new AppError('INVALID_SERVICE_MODE', 422, 'Modalidade de atendimento inválida');
    }
    const input = parseInput(enablePatchSchema, request.body);
    const serviceMode = await app.prisma.serviceMode.update({
      where: { code: code as 'delivery' | 'pickup' | 'dine_in' },
      data: { enabled: input.enabled },
      select: { code: true, name: true, enabled: true }
    });
    app.cache.clear();
    return serviceMode;
  });

  app.patch('/payment-methods/:code', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Ativa ou desativa forma de pagamento', params: codeParamsSchema, body: enableBodyJsonSchema, response: { 200: { ...paymentMethodsResponseJsonSchema.items }, ...standardErrorResponses } }
  }, async (request) => {
    const { code } = request.params as { code: string };
    if (!['PIX', 'CASH'].includes(code)) {
      throw new AppError('INVALID_PAYMENT_METHOD', 422, 'Forma de pagamento inválida');
    }
    const input = parseInput(enablePatchSchema, request.body);
    const method = await app.prisma.paymentMethod.update({
      where: { code: code as 'PIX' | 'CASH' },
      data: { enabled: input.enabled },
      select: { code: true, name: true, enabled: true }
    });
    app.cache.clear();
    return method;
  });
};

export default adminBusinessRoutes;
