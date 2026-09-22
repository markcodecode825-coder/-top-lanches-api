import type { FastifyPluginAsync } from 'fastify';
import { adminProductsQueryJsonSchema, idParamsSchema, productBodyJsonSchema, productCreateBodyJsonSchema } from '../../docs/request-schemas';
import { noContentResponseJsonSchema, paginatedProductsResponseJsonSchema, productResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { clampLimit, paginationMeta } from '../../utils/pagination';
import { slugify } from '../../utils/slug';
import { parseInput } from '../../utils/zod';
import { presentProduct } from './presenter';
import { adminProductsQuerySchema, productCreateSchema, productPatchSchema } from './schemas';

const adminProductRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/products', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Lista administrativa de produtos', querystring: adminProductsQueryJsonSchema, response: { 200: paginatedProductsResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const query = parseInput(adminProductsQuerySchema, request.query);
    const limit = clampLimit(query.limit);
    const where = {
      ...(query.category ? { categoryId: query.category } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.available === undefined ? {} : { available: query.available })
    };
    const [total, data] = await app.prisma.$transaction([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * limit,
        take: limit
      })
    ]);
    return { data: data.map(presentProduct), meta: paginationMeta(query.page, limit, total) };
  });

  app.post('/products', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Cria produto', body: productCreateBodyJsonSchema, response: { 201: productResponseJsonSchema, ...standardErrorResponses } }
  }, async (request, reply) => {
    const input = parseInput(productCreateSchema, request.body);
    const category = await app.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new AppError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
    const product = await app.prisma.product.create({
      data: { ...input, slug: input.slug ? slugify(input.slug) : slugify(input.name) }
    });
    app.cache.clear();
    return reply.status(201).send(presentProduct(product));
  });

  app.patch('/products/:id', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Atualiza produto, preço e disponibilidade', params: idParamsSchema, body: productBodyJsonSchema, response: { 200: productResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(productPatchSchema, request.body);
    const existing = await app.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('PRODUCT_NOT_FOUND', 404, 'Produto não encontrado');
    if (input.categoryId !== undefined) {
      const category = await app.prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new AppError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
    }
    const product = await app.prisma.product.update({
      where: { id },
      data: {
        ...input,
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {})
      }
    });
    app.cache.clear();
    return presentProduct(product);
  });

  app.delete('/products/:id', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Desativa logicamente um produto', params: idParamsSchema, response: { 204: noContentResponseJsonSchema, ...standardErrorResponses } }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('PRODUCT_NOT_FOUND', 404, 'Produto não encontrado');
    await app.prisma.product.update({ where: { id }, data: { active: false, available: false } });
    app.cache.clear();
    return reply.status(204).send();
  });
};

export default adminProductRoutes;
