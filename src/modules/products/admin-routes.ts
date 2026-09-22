import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import {
  adminProductsQueryJsonSchema,
  idParamsSchema,
  productBodyJsonSchema,
  productCreateBodyJsonSchema
} from '../../docs/request-schemas';
import {
  noContentResponseJsonSchema,
  paginatedProductsResponseJsonSchema,
  productResponseJsonSchema,
  standardErrorResponses
} from '../../docs/response-schemas';
import { AppError } from '../../errors/app-error';
import {
  clampLimit,
  paginationMeta
} from '../../utils/pagination';
import { slugify } from '../../utils/slug';
import { parseInput } from '../../utils/zod';
import { presentProduct } from './presenter';
import {
  adminProductsQuerySchema,
  productCreateSchema,
  productPatchSchema
} from './schemas';

const adminProductRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/products', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Lista administrativa de produtos',
      querystring: adminProductsQueryJsonSchema,
      response: {
        200: paginatedProductsResponseJsonSchema,
        ...standardErrorResponses
      }
    }
  }, async (request) => {
    const query = parseInput(
      adminProductsQuerySchema,
      request.query
    );
    const limit = clampLimit(query.limit);

    const where = {
      ...(query.category
        ? { categoryId: query.category }
        : {}),
      ...(query.active === undefined
        ? {}
        : { active: query.active }),
      ...(query.available === undefined
        ? {}
        : { available: query.available })
    };

    const [total, data] = await app.prisma.$transaction([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [
          { priority: 'asc' },
          { name: 'asc' }
        ],
        skip: (query.page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data: data.map(presentProduct),
      meta: paginationMeta(query.page, limit, total)
    };
  });

  app.post('/products', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Cria produto',
      body: productCreateBodyJsonSchema,
      response: {
        201: productResponseJsonSchema,
        ...standardErrorResponses
      }
    }
  }, async (request, reply) => {
    const input = parseInput(productCreateSchema, request.body);

    const category = await app.prisma.category.findUnique({
      where: { id: input.categoryId }
    });
    if (!category) {
      throw new AppError(
        'CATEGORY_NOT_FOUND',
        404,
        'Categoria não encontrada'
      );
    }

    const data: Prisma.ProductUncheckedCreateInput = {
      name: input.name,
      slug: input.slug
        ? slugify(input.slug)
        : slugify(input.name),
      categoryId: input.categoryId,
      description: input.description ?? null,
      priceInCents: input.priceInCents,
      promotionalPriceInCents:
        input.promotionalPriceInCents ?? null,
      imageUrl: input.imageUrl ?? null,
      volume: input.volume ?? null,
      unit: input.unit ?? null,
      searchTerms: input.searchTerms,
      available: input.available,
      active: input.active,
      featured: input.featured,
      priority: input.priority
    };

    const product = await app.prisma.product.create({ data });
    app.cache.clear();

    return reply.status(201).send(presentProduct(product));
  });

  app.patch('/products/:id', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Atualiza produto, preço e disponibilidade',
      params: idParamsSchema,
      body: productBodyJsonSchema,
      response: {
        200: productResponseJsonSchema,
        ...standardErrorResponses
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(productPatchSchema, request.body);

    const existing = await app.prisma.product.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new AppError(
        'PRODUCT_NOT_FOUND',
        404,
        'Produto não encontrado'
      );
    }

    if (input.categoryId !== undefined) {
      const category = await app.prisma.category.findUnique({
        where: { id: input.categoryId }
      });
      if (!category) {
        throw new AppError(
          'CATEGORY_NOT_FOUND',
          404,
          'Categoria não encontrada'
        );
      }
    }

    const data: Prisma.ProductUncheckedUpdateInput = {
      ...(input.name !== undefined
        ? { name: input.name }
        : {}),
      ...(input.slug !== undefined
        ? { slug: slugify(input.slug) }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.priceInCents !== undefined
        ? { priceInCents: input.priceInCents }
        : {}),
      ...(input.promotionalPriceInCents !== undefined
        ? {
            promotionalPriceInCents:
              input.promotionalPriceInCents
          }
        : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl }
        : {}),
      ...(input.volume !== undefined
        ? { volume: input.volume }
        : {}),
      ...(input.unit !== undefined
        ? { unit: input.unit }
        : {}),
      ...(input.searchTerms !== undefined
        ? { searchTerms: input.searchTerms }
        : {}),
      ...(input.available !== undefined
        ? { available: input.available }
        : {}),
      ...(input.active !== undefined
        ? { active: input.active }
        : {}),
      ...(input.featured !== undefined
        ? { featured: input.featured }
        : {}),
      ...(input.priority !== undefined
        ? { priority: input.priority }
        : {})
    };

    const product = await app.prisma.product.update({
      where: { id },
      data
    });

    app.cache.clear();
    return presentProduct(product);
  });

  app.delete('/products/:id', {
    schema: {
      tags: ['admin'],
      security: [{ bearerAuth: [] }],
      summary: 'Desativa logicamente um produto',
      params: idParamsSchema,
      response: {
        204: noContentResponseJsonSchema,
        ...standardErrorResponses
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.product.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new AppError(
        'PRODUCT_NOT_FOUND',
        404,
        'Produto não encontrado'
      );
    }

    await app.prisma.product.update({
      where: { id },
      data: {
        active: false,
        available: false
      }
    });

    app.cache.clear();
    return reply.status(204).send();
  });
};

export default adminProductRoutes;
