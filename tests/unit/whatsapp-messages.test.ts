import { describe, expect, it } from 'vitest';
import {
  botMessage,
  businessClosedMessage,
  cashBelowTotalMessage,
  genericOrderErrorMessage,
  orderConfirmedMessage,
  quantityPrompt
} from '../../src/modules/whatsapp/messages';

describe('WhatsApp bot message library', () => {
  it('returns deterministic variants for the same seed', () => {
    expect(botMessage('askName', 'wamid.123')).toBe(botMessage('askName', 'wamid.123'));
    expect(botMessage('nonText', 'wamid.456')).toBe(botMessage('nonText', 'wamid.456'));
  });

  it('keeps dynamic product and money data in messages', () => {
    expect(quantityPrompt('Pastel de carne', 'seed')).toContain('Pastel de carne');
    expect(cashBelowTotalMessage('R$ 25,00', 'seed')).toContain('R$ 25,00');
  });

  it('keeps order and error context in dynamic messages', () => {
    const confirmed = orderConfirmedMessage('TL-000123', 'R$ 42,00', 'seed');
    expect(confirmed).toContain('TL-000123');
    expect(confirmed).toContain('R$ 42,00');

    expect(businessClosedMessage('Top Lanches está fechada no momento.', 'seed')).toContain(
      'Top Lanches está fechada no momento.'
    );
    expect(genericOrderErrorMessage('Produto indisponível', 'seed')).toContain('Produto indisponível');
  });
});
