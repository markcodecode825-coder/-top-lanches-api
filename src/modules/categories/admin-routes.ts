import type { FastifyPluginAsync } from 'fastify';
import { categoryBodyJsonSchema, categoryCreateBodyJsonSchema, idParamsSchema } from '../../docs/request-schemas';
import { categoriesResponseJsonSchema, categoryResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import { slugify } from '../../utils/slug';
import { parseInput } from '../../utils/zod';
import { categoryCreateSchema, categoryPatchSchema } from './schemas';

const adminCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/categories', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Lista todas as categorias, inclusive inativas', response: { 200: categoriesResponseJsonSchema, ...standardErrorResponses } }
  }, async () => app.prisma.category.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }));

  app.post('/categories', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Cria uma categoria', body: categoryCreateBodyJsonSchema, response: { 201: categoryResponseJsonSchema, ...standardErrorResponses } }
  }, async (request, reply) => {
    const input = parseInput(categoryCreateSchema, request.body);
    const category = await app.prisma.category.create({
      data: { ...input, slug: input.slug ? slugify(input.slug) : slugify(input.name) }
    });
    app.cache.clear();
    return reply.status(201).send(category);
  });

  app.patch('/categories/:id', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Atualiza uma categoria', params: idParamsSchema, body: categoryBodyJsonSchema, response: { 200: categoryResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(categoryPatchSchema, request.body);
    const existing = await app.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new AppError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
    const category = await app.prisma.category.update({
      where: { id },
      data: {
        ...input,
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {})
      }
    });
    app.cache.clear();
    return category;
  });

  app.delete('/categories/:id', {
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }], summary: 'Desativa logicamente uma categoria', params: idParamsSchema, response: { ...standardErrorResponses } }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new AppError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
    await app.prisma.category.update({ where: { id }, data: { active: false } });
    app.cache.clear();
    return reply.status(204).send();
  });
};

export default adminCategoryRoutes;
