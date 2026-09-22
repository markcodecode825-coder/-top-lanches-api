import type { z } from 'zod';
import { AppError } from '../errors/app-error';

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new AppError(
    'VALIDATION_ERROR',
    422,
    'Dados inválidos',
    result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  );
}
