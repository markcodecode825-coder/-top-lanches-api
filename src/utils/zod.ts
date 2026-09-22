import type { z } from 'zod';
import { AppError } from '../errors/app-error';

export function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data as z.output<TSchema>;

  throw new AppError(
    'VALIDATION_ERROR',
    422,
    'Dados inválidos',
    result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  );
}
