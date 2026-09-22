import type { Order, OrderItem, PaymentMethodCode, ServiceModeCode } from '@prisma/client';
import { formatCents } from './money';

const serviceModeLabels: Record<ServiceModeCode, string> = {
  delivery: 'Delivery',
  pickup: 'Retirada',
  dine_in: 'Presencial'
};

const paymentLabels: Record<PaymentMethodCode, string> = {
  PIX: 'Pix',
  CASH: 'Dinheiro'
};

type OrderWithItems = Order & { items: OrderItem[] };

export function buildWhatsAppMessage(order: OrderWithItems, businessName: string): string {
  const lines = [
    `Pedido ${businessName}`,
    `Pedido: ${order.orderNumber}`,
    `Cliente: ${order.customerName}`,
    `Atendimento: ${serviceModeLabels[order.serviceMode]}`,
    ...order.items.map(
      (item) => `${item.quantity}x ${item.productName} — ${formatCents(item.subtotalInCents)}`
    ),
    `Total: ${formatCents(order.totalInCents)}`,
    `Pagamento: ${paymentLabels[order.paymentMethod]}`
  ];

  if (order.paymentMethod === 'CASH' && order.cashChangeForInCents !== null) {
    lines.push(`Troco para: ${formatCents(order.cashChangeForInCents)}`);
  }

  if (order.notes) lines.push(`Observações: ${order.notes}`);
  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsapp: string, message: string): string {
  const digits = whatsapp.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
