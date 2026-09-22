import type { FastifyPluginAsync } from 'fastify';
import { productsQueryJsonSchema, slugParamsSchema } from '../../docs/request-schemas';
import {
  categoriesResponseJsonSchema,
  categoryResponseJsonSchema,
  paginatedProductsResponseJsonSchema,
  standardErrorResponses
} from '../../docs/response-schemas';
import { parseInput } from '../../utils/zod';
import { productsQuerySchema } from '../products/schemas';
import { listPublicProducts } from '../products/service';
import { getPublicCategoryBySlug, listPublicCategories } from './service';

const publicCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/categories', {
    schema: { tags: ['categories'], summary: 'Lista categorias ativas por prioridade e nome', response: { 200: categoriesResponseJsonSchema, ...standardErrorResponses } }
  }, async () => {
    const cached = app.cache.get<Awaited<ReturnType<typeof listPublicCategories>>>('categories');
    if (cached) return cached;
    const categories = await listPublicCategories(app.prisma);
    app.cache.set('categories', categories);
    return categories;
  });

  app.get('/categories/:slug', {
    schema: { tags: ['categories'], summary: 'Retorna uma categoria pelo slug', params: slugParamsSchema, response: { 200: categoryResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { slug } = request.params as { slug: string };
    return getPublicCategoryBySlug(app.prisma, slug);
  });

  app.get('/categories/:slug/products', {
    schema: { tags: ['categories', 'products'], summary: 'Lista produtos de uma categoria', params: slugParamsSchema, querystring: productsQueryJsonSchema, response: { 200: paginatedProductsResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { slug } = request.params as { slug: string };
    await getPublicCategoryBySlug(app.prisma, slug);
    const query = parseInput(productsQuerySchema.omit({ category: true }), request.query);
    return listPublicProducts(app.prisma, { ...query, category: slug });
  });
};

export default publicCategoryRoutes;
