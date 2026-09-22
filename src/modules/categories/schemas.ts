import { z } from 'zod';

const nullableUrl = z.union([z.string().url(), z.null()]);

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(140).optional(),
    description: z.union([z.string().trim().max(1000), z.null()]).optional(),
    imageUrl: nullableUrl.optional(),
    bannerUrl: nullableUrl.optional(),
    searchTerms: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    priority: z.number().int().min(0).max(10000).default(100),
    active: z.boolean().default(true)
  })
  .strict();

export const categoryPatchSchema = categoryCreateSchema.partial().strict();
