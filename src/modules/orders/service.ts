import {
  Prisma,
  type PaymentMethodCode,
  type ServiceModeCode,
  type Order,
  type OrderAddress,
  type OrderItem,
  type PrismaClient
} from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { MAX_MONEY_IN_CENTS, decimalInputToCents, formatCents } from '../../utils/money';
import { getBusiness, getBusinessStatus, isAcceptingOrdersWhenClosed } from '../business/service';
import { effectivePriceInCents } from '../products/presenter';
import type { CreateOrderInput } from './schemas';

export type OrderWithRelations = Order & { items: OrderItem[]; address: OrderAddress | null };

function isServiceModeCode(value: string): value is ServiceModeCode {
  return value === 'delivery' || value === 'pickup' || value === 'dine_in';
}

function isPaymentMethodCode(value: string): value is PaymentMethodCode {
  return value === 'PIX' || value === 'CASH';
}

export function presentOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: { name: order.customerName, phone: order.customerPhone },
    serviceMode: order.serviceMode,
    paymentMethod: order.paymentMethod,
    cashChangeForInCents: order.cashChangeForInCents,
    cashChangeForFormatted:
      order.cashChangeForInCents === null ? null : formatCents(order.cashChangeForInCents),
    status: order.status,
    notes: order.notes,
    subtotalInCents: order.subtotalInCents,
    subtotal: Number((order.subtotalInCents / 100).toFixed(2)),
    subtotalFormatted: formatCents(order.subtotalInCents),
    deliveryFeeInCents: order.deliveryFeeInCents,
    totalInCents: order.totalInCents,
    total: Number((order.totalInCents / 100).toFixed(2)),
    totalFormatted: formatCents(order.totalInCents),
    address: order.address,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      quantity: item.quantity,
      unitPriceInCents: item.unitPriceInCents,
      unitPriceFormatted: formatCents(item.unitPriceInCents),
      subtotalInCents: item.subtotalInCents,
      subtotalFormatted: formatCents(item.subtotalInCents)
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

export async function getOrderById(prisma: PrismaClient, id: string): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, address: true }
  });
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, 'Pedido não encontrado');
  return order;
}

export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput,
  idempotencyKey?: string
): Promise<{ order: OrderWithRelations; reused: boolean }> {
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: { items: true, address: true }
    });
    if (existing) return { order: existing, reused: true };
  }

  if (!isServiceModeCode(input.serviceMode)) {
    throw new AppError('INVALID_SERVICE_MODE', 422, 'Modalidade de atendimento inválida');
  }
  if (!isPaymentMethodCode(input.paymentMethod)) {
    throw new AppError('INVALID_PAYMENT_METHOD', 422, 'Forma de pagamento inválida');
  }

  const [serviceMode, paymentMethod, status, acceptWhenClosed] = await Promise.all([
    prisma.serviceMode.findUnique({ where: { code: input.serviceMode } }),
    prisma.paymentMethod.findUnique({ where: { code: input.paymentMethod } }),
    getBusinessStatus(prisma),
    isAcceptingOrdersWhenClosed(prisma)
  ]);

  if (!serviceMode?.enabled) {
    throw new AppError('INVALID_SERVICE_MODE', 422, 'Modalidade de atendimento indisponível');
  }
  if (!paymentMethod?.enabled) {
    throw new AppError('INVALID_PAYMENT_METHOD', 422, 'Forma de pagamento indisponível');
  }
  if (!status.isOpen && !acceptWhenClosed) {
    const business = await getBusiness(prisma);
    throw new AppError('BUSINESS_CLOSED', 409, `${business.name} está fechada no momento.`);
  }

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  for (const quantity of quantities.values()) {
    if (quantity > 99) {
      throw new AppError('VALIDATION_ERROR', 422, 'Quantidade máxima por produto é 99');
    }
  }

  const productIds = [...quantities.keys()];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true }
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const productId of productIds) {
    if (!productById.has(productId)) {
      throw new AppError('PRODUCT_NOT_FOUND', 404, 'Produto não encontrado', { productId });
    }
  }

  const snapshots = productIds.map((productId) => {
    const product = productById.get(productId);
    if (!product) throw new AppError('PRODUCT_NOT_FOUND', 404, 'Produto não encontrado');
    if (!product.active || !product.available || !product.category.active) {
      throw new AppError('PRODUCT_UNAVAILABLE', 409, `Produto indisponível: ${product.name}`, {
        productId: product.id
      });
    }
    const quantity = quantities.get(productId) ?? 0;
    const unitPriceInCents = effectivePriceInCents(product);
    const subtotalInCents = unitPriceInCents * quantity;
    if (!Number.isSafeInteger(subtotalInCents) || subtotalInCents > MAX_MONEY_IN_CENTS) {
      throw new AppError('VALIDATION_ERROR', 422, 'Valor do pedido excede o limite suportado');
    }
    return {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      quantity,
      unitPriceInCents,
      subtotalInCents
    };
  });

  const subtotalInCents = snapshots.reduce((sum, item) => sum + item.subtotalInCents, 0);
  const deliveryFeeInCents: number | null = null;
  const totalInCents = subtotalInCents;
  if (!Number.isSafeInteger(totalInCents) || totalInCents > MAX_MONEY_IN_CENTS) {
    throw new AppError('VALIDATION_ERROR', 422, 'Valor total do pedido excede o limite suportado');
  }

  let cashChangeForInCents: number | null = null;
  if (input.paymentMethod === 'CASH' && input.cashChangeFor !== undefined) {
    if (typeof input.cashChangeFor !== 'number' && typeof input.cashChangeFor !== 'string') {
      throw new AppError('VALIDATION_ERROR', 422, 'Valor de troco inválido');
    }
    try {
      cashChangeForInCents = decimalInputToCents(input.cashChangeFor);
    } catch {
      throw new AppError('VALIDATION_ERROR', 422, 'Valor de troco inválido');
    }
    if (cashChangeForInCents < totalInCents) {
      throw new AppError('VALIDATION_ERROR', 422, 'cashChangeFor deve ser maior ou igual ao total do pedido');
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const counter = await tx.orderCounter.upsert({
        where: { id: 'orders' },
        update: { value: { increment: 1 } },
        create: { id: 'orders', value: 1 }
      });
      const orderNumber = `TL-${String(counter.value).padStart(6, '0')}`;
      return tx.order.create({
        data: {
          orderNumber,
          idempotencyKey: idempotencyKey ?? null,
          customerName: input.customer.name,
          customerPhone: input.customer.phone ?? null,
          serviceMode: input.serviceMode,
          paymentMethod: input.paymentMethod,
          cashChangeForInCents: input.paymentMethod === 'CASH' ? cashChangeForInCents : null,
          notes: input.notes ?? null,
          subtotalInCents,
          deliveryFeeInCents,
          totalInCents,
          items: { create: snapshots },
          ...(input.serviceMode === 'delivery' && input.address
            ? {
                address: {
                  create: {
                    street: input.address.street,
                    number: input.address.number,
                    complement: input.address.complement ?? null,
                    neighborhood: input.address.neighborhood,
                    reference: input.address.reference ?? null
                  }
                }
              }
            : {})
        },
        include: { items: true, address: true }
      });
    });
    return { order, reused: false };
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true, address: true }
      });
      if (existing) return { order: existing, reused: true };
    }
    throw error;
  }
}
