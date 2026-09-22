import type { FastifyPluginAsync } from 'fastify';
import { productsQueryJsonSchema, slugParamsSchema } from '../../docs/request-schemas';
import { paginatedProductsResponseJsonSchema, productResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { parseInput } from '../../utils/zod';
import { productsQuerySchema } from './schemas';
import { getPublicProductBySlug, listPublicProducts } from './service';

const publicProductRoutes: FastifyPluginAsync = async (app) => {
  app.get('/products', {
    schema: { tags: ['products'], summary: 'Lista produtos com filtros, ordenação e paginação', querystring: productsQueryJsonSchema, response: { 200: paginatedProductsResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const query = parseInput(productsQuerySchema, request.query);
    return listPublicProducts(app.prisma, query);
  });

  app.get('/products/featured', {
    schema: { tags: ['products'], summary: 'Lista produtos em destaque disponíveis', response: { 200: paginatedProductsResponseJsonSchema, ...standardErrorResponses } }
  }, async () => listPublicProducts(app.prisma, {
    featured: true,
    available: true,
    sort: 'priority',
    page: 1,
    limit: 100
  }));

  app.get('/products/:slug', {
    schema: { tags: ['products'], summary: 'Retorna um produto pelo slug', params: slugParamsSchema, response: { 200: productResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const { slug } = request.params as { slug: string };
    return getPublicProductBySlug(app.prisma, slug);
  });
};

export default publicProductRoutes;
