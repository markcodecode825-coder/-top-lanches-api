export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchQuery(
  value: string
): string {
  return normalizeText(value).slice(0, 100);
}

export function escapeSqlLike(
  value: string
): string {
  return value.replace(
    /[\\%_]/g,
    (character) => `\\${character}`
  );
}
