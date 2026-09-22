import { describe, expect, it } from 'vitest';
import { MAX_MONEY_IN_CENTS, decimalInputToCents, formatCents } from '../../src/utils/money';

describe('dinheiro em centavos', () => {
  it('converte entrada decimal sem usar o valor do frontend como preço oficial', () => {
    expect(decimalInputToCents('2.50')).toBe(250);
    expect(decimalInputToCents(50)).toBe(5000);
    expect(formatCents(1500)).toBe('R$ 15,00');
  });

  it('rejeita valores acima do limite monetário persistível', () => {
    expect(decimalInputToCents('21474836.47')).toBe(MAX_MONEY_IN_CENTS);
    expect(() => decimalInputToCents('21474836.48')).toThrow('Valor monetário fora do limite suportado');
  });
});
