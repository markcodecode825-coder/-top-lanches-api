import type { FastifyPluginAsync } from 'fastify';
import {
  businessResponseJsonSchema,
  businessStatusResponseJsonSchema,
  hoursResponseJsonSchema,
  paymentMethodsResponseJsonSchema,
  serviceModesResponseJsonSchema,
  standardErrorResponses
} from '../../docs/response-schemas';
import { getBusiness, getBusinessStatus, getGroupedHours } from './service';

const publicBusinessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/business', {
    schema: { tags: ['business'], summary: 'Retorna os dados públicos do estabelecimento', response: { 200: businessResponseJsonSchema, ...standardErrorResponses } }
  }, async () => {
    const cached = app.cache.get<Awaited<ReturnType<typeof getBusiness>>>('business');
    if (cached) return cached;
    const business = await getBusiness(app.prisma);
    app.cache.set('business', business);
    return business;
  });

  app.get('/business/status', {
    schema: { tags: ['business'], summary: 'Retorna se o estabelecimento está aberto no momento', response: { 200: businessStatusResponseJsonSchema, ...standardErrorResponses } }
  }, async () => getBusinessStatus(app.prisma));

  app.get('/hours', {
    schema: { tags: ['business'], summary: 'Retorna os horários agrupados por dia da semana', response: { 200: hoursResponseJsonSchema, ...standardErrorResponses } }
  }, async () => getGroupedHours(app.prisma));

  app.get('/service-modes', {
    schema: {
      tags: ['business'],
      summary: 'Retorna modalidades de atendimento e seus estados',
      response: { 200: serviceModesResponseJsonSchema, ...standardErrorResponses }
    }
  }, async () => {
    const modes = await app.prisma.serviceMode.findMany({
      select: { code: true, name: true, enabled: true }
    });
    const order = new Map([['delivery', 1], ['pickup', 2], ['dine_in', 3]]);
    return modes.sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99));
  });

  app.get('/payment-methods', {
    schema: {
      tags: ['business'],
      summary: 'Retorna formas de pagamento e seus estados',
      response: { 200: paymentMethodsResponseJsonSchema, ...standardErrorResponses }
    }
  }, async () => {
    const methods = await app.prisma.paymentMethod.findMany({
      select: { code: true, name: true, enabled: true }
    });
    const order = new Map([['PIX', 1], ['CASH', 2]]);
    return methods.sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99));
  });
};

export default publicBusinessRoutes;
