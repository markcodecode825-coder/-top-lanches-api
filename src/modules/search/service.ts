import { Prisma, type PrismaClient } from '@prisma/client';
import { escapeSqlLike, normalizeSearchQuery } from '../../utils/normalize-text';

interface SearchRow {
  id: string;
  score: number;
}

export async function findMatchingProductIds(
  prisma: PrismaClient,
  query: string,
  limit = 500
): Promise<string[]> {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  const like = `%${escapeSqlLike(q)}%`;

  const rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT
      p."id",
      GREATEST(
        similarity(immutable_unaccent(lower(p."name")), ${q}),
        similarity(immutable_unaccent(lower(c."name")), ${q}),
        similarity(immutable_unaccent(lower(COALESCE(p."volume", ''))), ${q})
      ) AS score
    FROM "Product" p
    INNER JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."active" = true
      AND c."active" = true
      AND (
        immutable_unaccent(lower(p."name")) LIKE ${like} ESCAPE '\\'
        OR immutable_unaccent(lower(c."name")) LIKE ${like} ESCAPE '\\'
        OR immutable_unaccent(lower(COALESCE(p."volume", ''))) LIKE ${like} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM unnest(p."searchTerms") AS term
          WHERE immutable_unaccent(lower(term)) LIKE ${like} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(c."searchTerms") AS term
          WHERE immutable_unaccent(lower(term)) LIKE ${like} ESCAPE '\\'
        )
        OR similarity(immutable_unaccent(lower(p."name")), ${q}) >= 0.25
        OR similarity(immutable_unaccent(lower(c."name")), ${q}) >= 0.35
      )
    ORDER BY score DESC, p."priority" ASC, p."name" ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => row.id);
}
