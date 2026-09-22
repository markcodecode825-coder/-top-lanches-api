import { describe, expect, it } from 'vitest';
import { normalizeText } from '../../src/utils/normalize-text';
import { slugify } from '../../src/utils/slug';

describe('normalização de texto', () => {
  it('remove acentos e normaliza caixa', () => {
    expect(normalizeText('Água Coração')).toBe('agua coracao');
  });

  it('gera slug compacto para volumes', () => {
    expect(slugify('Coca-Cola 2 L')).toBe('coca-cola-2l');
    expect(slugify('Coca-Cola KS 290 ml')).toBe('coca-cola-ks-290ml');
  });
});
