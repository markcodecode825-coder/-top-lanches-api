import { z } from 'zod';
import { MAX_MONEY_IN_CENTS } from '../../utils/money';

const moneyQuery = z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, 'Valor monetário inválido');
const nullableUrl = z.union([z.string().url(), z.null()]);

export const productsQuerySchema = z.object({
  category: z.string().trim().min(1).max(140).optional(),
  available: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  featured: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  minPrice: moneyQuery.optional(),
  maxPrice: moneyQuery.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z
    .enum(['priority', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'newest'])
    .default('priority'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20)
});

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(180).optional(),
    categoryId: z.string().uuid(),
    description: z.union([z.string().trim().max(2000), z.null()]).optional(),
    priceInCents: z.number().int().min(0).max(MAX_MONEY_IN_CENTS),
    promotionalPriceInCents: z.union([z.number().int().min(0).max(MAX_MONEY_IN_CENTS), z.null()]).optional(),
    imageUrl: nullableUrl.optional(),
    volume: z.union([z.string().trim().max(50), z.null()]).optional(),
    unit: z.union([z.string().trim().max(50), z.null()]).optional(),
    searchTerms: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    available: z.boolean().default(true),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    priority: z.number().int().min(0).max(100000).default(100)
  })
  .strict();

export const productPatchSchema = productCreateSchema.partial().strict();

export const adminProductsQuerySchema = z.object({
  category: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  available: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20)
});
