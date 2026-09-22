import { env } from '../config/env';

export function paginationMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

export function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), env.MAX_PAGE_LIMIT);
}
