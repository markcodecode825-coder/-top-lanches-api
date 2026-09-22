import type { OrderStatus } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { adminOrdersQueryJsonSchema, idParamsSchema, orderStatusBodyJsonSchema } from '../../docs/request-schemas';
import { orderResponseJsonSchema, paginatedOrdersResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { clampLimit, paginationMeta } from '../../utils/pagination';
import { parseInput } from '../../utils/zod';
import { adminOrdersQuerySchema, orderStatusPatchSchema } from './schemas';
import { getOrderById, presentOrder } from './service';
import { assertStatusTransition } from './status';

const adminOrderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/orders', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Lista pedidos administrativos', querystring: adminOrdersQueryJsonSchema, response: { 200: paginatedOrdersResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const query = parseInput(adminOrdersQuerySchema, request.query);
    const limit = clampLimit(query.limit);
    const where = query.status ? { status: query.status } : {};
    const [total, orders] = await app.prisma.$transaction([
      app.prisma.order.count({ where }),
      app.prisma.order.findMany({
        where,
        include: { items: true, address: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * limit,
        take: limit
      })
    ]);
    return { data: orders.map(presentOrder), meta: paginationMeta(query.page, limit, total) };
  });

  app.get('/orders/:id', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Detalha um pedido', params: idParamsSchema, response: { 200: orderResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    return presentOrder(await getOrderById(app.prisma, id));
  });

  app.patch('/orders/:id/status', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Atualiza status validando a transição', params: idParamsSchema, body: orderStatusBodyJsonSchema, response: { 200: orderResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(orderStatusPatchSchema, request.body);
    const validStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'];
    if (!validStatuses.includes(input.status as OrderStatus)) {
      throw new AppError('INVALID_ORDER_STATUS', 422, 'Status de pedido inválido');
    }
    const nextStatus = input.status as OrderStatus;
    const order = await app.prisma.order.findUnique({ where: { id } });
    if (!order) throw new AppError('ORDER_NOT_FOUND', 404, 'Pedido não encontrado');
    assertStatusTransition(order.status, nextStatus, order.serviceMode);
    const updated = await app.prisma.order.update({
      where: { id },
      data: { status: nextStatus },
      include: { items: true, address: true }
    });
    return presentOrder(updated);
  });
};

export default adminOrderRoutes;
