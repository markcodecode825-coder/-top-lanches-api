import type { Category, Product } from '@prisma/client';
import { centsToApi, formatCents } from '../../utils/money';

type ProductWithCategory = Product & { category?: Category };

export function presentProduct(product: ProductWithCategory) {
  const base = centsToApi(product.priceInCents);
  const promotional = product.promotionalPriceInCents;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    ...(product.category ? { category: { id: product.category.id, name: product.category.name, slug: product.category.slug } } : {}),
    description: product.description,
    ...base,
    promotionalPrice: promotional === null ? null : Number((promotional / 100).toFixed(2)),
    promotionalPriceInCents: promotional,
    promotionalPriceFormatted: promotional === null ? null : formatCents(promotional),
    imageUrl: product.imageUrl,
    volume: product.volume,
    unit: product.unit,
    available: product.available,
    active: product.active,
    featured: product.featured,
    priority: product.priority,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export function effectivePriceInCents(product: Pick<Product, 'priceInCents' | 'promotionalPriceInCents'>): number {
  return product.promotionalPriceInCents ?? product.priceInCents;
}
