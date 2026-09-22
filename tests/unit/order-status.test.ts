import { describe, expect, it } from 'vitest';
import { assertStatusTransition } from '../../src/modules/orders/status';

describe('transições de status', () => {
  it('bloqueia regressão de pedido concluído', () => {
    expect(() => assertStatusTransition('COMPLETED', 'PREPARING', 'pickup')).toThrow();
  });

  it('bloqueia OUT_FOR_DELIVERY para retirada', () => {
    expect(() => assertStatusTransition('READY', 'OUT_FOR_DELIVERY', 'pickup')).toThrow();
  });
});
