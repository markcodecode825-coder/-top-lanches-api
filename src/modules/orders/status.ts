import type { OrderStatus, ServiceModeCode } from '@prisma/client';
import { AppError } from '../../errors/app-error';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['PREPARING', 'CANCELED'],
  PREPARING: ['READY', 'CANCELED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: []
};

export function assertStatusTransition(current: OrderStatus, next: OrderStatus, mode: ServiceModeCode): void {
  if (next === 'OUT_FOR_DELIVERY' && mode !== 'delivery') {
    throw new AppError('INVALID_STATUS_TRANSITION', 409, 'OUT_FOR_DELIVERY só é válido para Delivery');
  }
  if (!transitions[current].includes(next)) {
    throw new AppError('INVALID_STATUS_TRANSITION', 409, `Transição inválida: ${current} -> ${next}`);
  }
}
