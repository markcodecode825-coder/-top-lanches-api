import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Top Lanches API',
        description: 'API REST oficial e open source da Top Lanches.',
        version: '1.3.0',
        license: { name: 'MIT' }
      },
      tags: [
        { name: 'system', description: 'Saúde e metadados da API' },
        { name: 'business', description: 'Estabelecimento, horários e atendimento' },
        { name: 'categories', description: 'Categorias públicas' },
        { name: 'products', description: 'Produtos públicos' },
        { name: 'search', description: 'Pesquisa do cardápio' },
        { name: 'menu', description: 'Payload otimizado do cardápio' },
        { name: 'orders', description: 'Criação e integração de pedidos' },
        { name: 'whatsapp', description: 'WhatsApp Business Platform / Cloud API' },
        { name: 'admin-auth', description: 'Autenticação administrativa' },
        { name: 'admin', description: 'Administração protegida por JWT' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: {
          Error: {
            type: 'object',
            required: ['error'],
            properties: {
              error: {
                type: 'object',
                required: ['code', 'message', 'statusCode'],
                properties: {
                  code: { type: 'string', example: 'PRODUCT_NOT_FOUND' },
                  message: { type: 'string', example: 'Produto não encontrado' },
                  statusCode: { type: 'integer', example: 404 },
                  requestId: { type: 'string', example: 'f5ef10de-2e6e-4f2a-bb11-f9bb2680190f' },
                  details: { nullable: true }
                }
              }
            }
          },
          PaginationMeta: {
            type: 'object',
            required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 68 },
              totalPages: { type: 'integer', example: 4 },
              hasNextPage: { type: 'boolean', example: true },
              hasPreviousPage: { type: 'boolean', example: false }
            }
          },
          BusinessStatus: {
            type: 'object',
            required: ['isOpen', 'status', 'message', 'closesAt', 'nextOpeningAt'],
            properties: {
              isOpen: { type: 'boolean', example: true },
              status: { type: 'string', enum: ['OPEN', 'CLOSED'], example: 'OPEN' },
              message: { type: 'string', example: 'Aberto agora' },
              closesAt: { type: 'string', nullable: true, example: '16:00' },
              nextOpeningAt: { type: 'string', nullable: true, example: null }
            }
          }
        },
        responses: {
          ValidationError: {
            description: 'Entrada inválida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Dados inválidos',
                    statusCode: 422,
                    requestId: 'f5ef10de-2e6e-4f2a-bb11-f9bb2680190f'
                  }
                }
              }
            }
          },
          Unauthorized: {
            description: 'JWT ausente ou inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Autenticação necessária',
                    statusCode: 401
                  }
                }
              }
            }
          },
          NotFound: {
            description: 'Recurso não encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          Conflict: {
            description: 'Conflito com o estado atual do recurso ou negócio',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          RateLimited: {
            description: 'Limite de requisições excedido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          InternalError: {
            description: 'Erro interno sem exposição de stack trace em produção',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true
    }
  });
};

export default fp(swaggerPlugin, { name: 'swagger' });
