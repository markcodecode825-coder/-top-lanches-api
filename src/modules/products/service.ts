import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { clampLimit, paginationMeta } from '../../utils/pagination';
import { decimalInputToCents } from '../../utils/money';
import { findMatchingProductIds } from '../search/service';
import { presentProduct } from './presenter';

export interface PublicProductsFilters {
  category?: string;
  available?: boolean;
  featured?: boolean;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  sort: 'priority' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest';
  page: number;
  limit: number;
}

function orderByFor(sort: PublicProductsFilters['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'name_asc':
      return [{ name: 'asc' }];
    case 'name_desc':
      return [{ name: 'desc' }];
    case 'price_asc':
      return [{ priceInCents: 'asc' }, { name: 'asc' }];
    case 'price_desc':
      return [{ priceInCents: 'desc' }, { name: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'priority':
    default:
      return [{ priority: 'asc' }, { name: 'asc' }];
  }
}

export async function listPublicProducts(prisma: PrismaClient, filters: PublicProductsFilters) {
  const limit = clampLimit(filters.limit);
  const matchingIds = filters.search ? await findMatchingProductIds(prisma, filters.search) : undefined;
  if (matchingIds && matchingIds.length === 0) {
    return { data: [], meta: paginationMeta(filters.page, limit, 0) };
  }

  const price: Prisma.IntFilter = {};
  if (filters.minPrice !== undefined) price.gte = decimalInputToCents(filters.minPrice);
  if (filters.maxPrice !== undefined) price.lte = decimalInputToCents(filters.maxPrice);

  const where: Prisma.ProductWhereInput = {
    active: true,
    category: { active: true, ...(filters.category ? { slug: filters.category } : {}) },
    ...(filters.available === undefined ? {} : { available: filters.available }),
    ...(filters.featured === undefined ? {} : { featured: filters.featured }),
    ...(Object.keys(price).length === 0 ? {} : { priceInCents: price }),
    ...(matchingIds ? { id: { in: matchingIds } } : {})
  };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: orderByFor(filters.sort),
      skip: (filters.page - 1) * limit,
      take: limit
    })
  ]);

  return { data: products.map(presentProduct), meta: paginationMeta(filters.page, limit, total) };
}

export async function getPublicProductBySlug(prisma: PrismaClient, slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, active: true, category: { active: true } },
    include: { category: true }
  });
  if (!product) throw new AppError('PRODUCT_NOT_FOUND', 404, 'Produto não encontrado');
  return presentProduct(product);
}
