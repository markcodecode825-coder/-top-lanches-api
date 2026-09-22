import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error';

export async function listPublicCategories(prisma: PrismaClient) {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
  });
}

export async function getPublicCategoryBySlug(prisma: PrismaClient, slug: string) {
  const category = await prisma.category.findFirst({ where: { slug, active: true } });
  if (!category) throw new AppError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
  return category;
}
