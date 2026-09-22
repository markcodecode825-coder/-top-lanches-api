import type { FastifyPluginAsync } from 'fastify';
import { menuResponseJsonSchema, standardErrorResponses } from '../../docs/response-schemas';
import { getMenu } from './service';

const menuRoutes: FastifyPluginAsync = async (app) => {
  app.get('/menu', {
    schema: { tags: ['menu'], summary: 'Retorna em uma única requisição os dados necessários ao cardápio', response: { 200: menuResponseJsonSchema, ...standardErrorResponses } }
  }, async () => getMenu(app));
};

export default menuRoutes;
