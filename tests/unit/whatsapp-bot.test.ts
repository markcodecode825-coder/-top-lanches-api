import { describe, expect, it } from 'vitest';
import {
  isResetCommand,
  parseCashChangeText,
  parseMenuChoice
} from '../../src/modules/whatsapp/bot';

describe('WhatsApp ordering bot helpers', () => {
  it('aceita escolhas numéricas dentro do intervalo', () => {
    expect(parseMenuChoice('1', 3)).toBe(1);
    expect(parseMenuChoice('3', 3)).toBe(3);
    expect(parseMenuChoice('4', 3)).toBeNull();
    expect(parseMenuChoice('abc', 3)).toBeNull();
  });

  it('reconhece comandos de reinício sem depender de acentos', () => {
    expect(isResetCommand('CANCELAR')).toBe(true);
    expect(isResetCommand('início')).toBe(true);
    expect(isResetCommand('menu')).toBe(true);
    expect(isResetCommand('continuar')).toBe(false);
  });

  it('interpreta troco e opção sem troco', () => {
    expect(parseCashChangeText('sem troco')).toEqual({ skip: true });
    expect(parseCashChangeText('R$ 50,00')).toEqual({ skip: false, value: '50.00' });
    expect(parseCashChangeText('abc')).toBeNull();
  });
});
