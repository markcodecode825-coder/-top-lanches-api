import { normalizeText } from './normalize-text';

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/(\d+)\s+(ml|l)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
