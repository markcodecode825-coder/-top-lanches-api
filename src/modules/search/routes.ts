import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env';
import { searchQueryJsonSchema } from '../../docs/request-schemas';
import { searchResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { parseInput } from '../../utils/zod';
import { presentProduct } from '../products/presenter';
import { searchQuerySchema } from './schemas';
import { findMatchingProductIds } from './service';

const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get('/search', {
    config: { rateLimit: { max: env.SEARCH_RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW } },
    schema: { tags: ['search'], summary: 'Pesquisa tolerante a acentos e pequenas diferenças de escrita', querystring: searchQueryJsonSchema, response: { 200: searchResponseJsonSchema, ...standardErrorResponses } }
  }, async (request) => {
    const query = parseInput(searchQuerySchema, request.query);
    const ids = await findMatchingProductIds(app.prisma, query.q, query.limit);
    if (ids.length === 0) return { data: [], meta: { query: query.q, total: 0 } };
    const products = await app.prisma.product.findMany({
      where: { id: { in: ids }, active: true, category: { active: true } },
      include: { category: true }
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const ordered = ids.flatMap((id) => {
      const product = byId.get(id);
      return product ? [presentProduct(product)] : [];
    });
    return { data: ordered, meta: { query: query.q, total: ordered.length } };
  });
};

export default searchRoutes;
