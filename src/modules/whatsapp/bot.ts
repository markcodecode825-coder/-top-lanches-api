import { randomUUID } from 'node:crypto';
import type {
  PaymentMethodCode,
  Prisma,
  ServiceModeCode
} from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors/app-error';
import { decimalInputToCents, formatCents } from '../../utils/money';
import { normalizeText } from '../../utils/normalize-text';
import {
  getBusinessStatus,
  isAcceptingOrdersWhenClosed
} from '../business/service';
import { createOrder } from '../orders/service';
import { effectivePriceInCents } from '../products/presenter';
import { persistOutboundMessage } from './persistence';
import {
  sendTextMessage,
  type WhatsAppSendResult,
  type WhatsAppWebhookMessage
} from './service';
import { env } from '../../config/env';

type BotState =
  | 'CHOOSE_SERVICE_MODE'
  | 'CHOOSE_CATEGORY'
  | 'CHOOSE_PRODUCT'
  | 'CHOOSE_QUANTITY'
  | 'CHOOSE_CART_ACTION'
  | 'CHOOSE_PAYMENT'
  | 'ASK_CASH_CHANGE'
  | 'ASK_NAME'
  | 'ASK_STREET'
  | 'ASK_NUMBER'
  | 'ASK_NEIGHBORHOOD'
  | 'ASK_COMPLEMENT'
  | 'ASK_REFERENCE'
  | 'CONFIRM_ORDER';

interface CartItem {
  productId: string;
  quantity: number;
}

interface BotData {
  serviceMode?: ServiceModeCode;
  categoryId?: string;
  productId?: string;
  cart?: CartItem[];
  paymentMethod?: PaymentMethodCode;
  cashChangeFor?: string;
  customerName?: string;
  address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    complement?: string;
    reference?: string;
  };
}

type BotSender = (to: string, text: string) => Promise<WhatsAppSendResult>;

const BOT_STATES = new Set<BotState>([
  'CHOOSE_SERVICE_MODE',
  'CHOOSE_CATEGORY',
  'CHOOSE_PRODUCT',
  'CHOOSE_QUANTITY',
  'CHOOSE_CART_ACTION',
  'CHOOSE_PAYMENT',
  'ASK_CASH_CHANGE',
  'ASK_NAME',
  'ASK_STREET',
  'ASK_NUMBER',
  'ASK_NEIGHBORHOOD',
  'ASK_COMPLEMENT',
  'ASK_REFERENCE',
  'CONFIRM_ORDER'
]);

const SERVICE_LABELS: Record<ServiceModeCode, string> = {
  delivery: 'Delivery',
  pickup: 'Retirada',
  dine_in: 'Presencial'
};

const PAYMENT_LABELS: Record<PaymentMethodCode, string> = {
  PIX: 'Pix',
  CASH: 'Dinheiro'
};

function isBotState(value: string): value is BotState {
  return BOT_STATES.has(value as BotState);
}

function isSkipText(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === '-' || normalized === 'nao' || normalized === 'nenhum' || normalized === 'sem';
}

function isCancelText(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === 'cancelar' || normalized === 'cancelar pedido';
}

function expiresAt(): Date {
  return new Date(Date.now() + env.WHATSAPP_BOT_SESSION_TTL_MINUTES * 60_000);
}

function asBotData(value: Prisma.JsonValue): BotData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as unknown as BotData;
}

function toJson(data: BotData): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}

async function saveConversation(
  app: FastifyInstance,
  phone: string,
  state: BotState,
  data: BotData,
  lastMessageId: string
): Promise<void> {
  await app.prisma.whatsappConversation.upsert({
    where: { phone },
    create: {
      phone,
      state,
      data: toJson(data),
      lastMessageId,
      expiresAt: expiresAt()
    },
    update: {
      state,
      data: toJson(data),
      lastMessageId,
      expiresAt: expiresAt()
    }
  });
}

async function clearConversation(app: FastifyInstance, phone: string): Promise<void> {
  await app.prisma.whatsappConversation.deleteMany({ where: { phone } });
}

function splitMessage(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxLength) {
      current = line;
      continue;
    }
    for (let index = 0; index < line.length; index += maxLength) {
      chunks.push(line.slice(index, index + maxLength));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendBotText(
  app: FastifyInstance,
  phone: string,
  text: string,
  sender: BotSender
): Promise<void> {
  for (const chunk of splitMessage(text)) {
    const result = await sender(phone, chunk);
    try {
      await persistOutboundMessage(app.prisma, {
        providerMessageId: result.messageId,
        phone: result.recipientWaId ?? phone,
        type: 'text',
        text: chunk
      });
    } catch (error) {
      const errorType = error instanceof Error ? error.name : typeof error;
      app.log.error({ errorType }, 'Automatic WhatsApp reply sent but local persistence failed');
    }
  }
}

function chooseNumber(text: string, count: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= count ? value - 1 : null;
}

function chooseNamedOption<T extends { name: string }>(text: string, options: T[]): T | null {
  const numbered = chooseNumber(text, options.length);
  if (numbered !== null) return options[numbered] ?? null;

  const normalized = normalizeText(text);
  const exact = options.find((option) => normalizeText(option.name) === normalized);
  if (exact) return exact;

  const matches = options.filter((option) => normalizeText(option.name).includes(normalized));
  return matches.length === 1 ? matches[0] ?? null : null;
}

async function startConversation(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  sender: BotSender
): Promise<void> {
  const [status, acceptWhenClosed, modes] = await Promise.all([
    getBusinessStatus(app.prisma),
    isAcceptingOrdersWhenClosed(app.prisma),
    app.prisma.serviceMode.findMany({
      where: { enabled: true },
      orderBy: { code: 'asc' }
    })
  ]);

  if (!status.isOpen && !acceptWhenClosed) {
    await clearConversation(app, message.from);
    await sendBotText(
      app,
      message.from,
      'Top Lanches está fechada no momento. Envie Oi quando o atendimento estiver aberto para iniciar um pedido.',
      sender
    );
    return;
  }

  const orderedCodes: ServiceModeCode[] = ['delivery', 'pickup', 'dine_in'];
  const enabled = orderedCodes.filter((code) => modes.some((mode) => mode.code === code));
  if (enabled.length === 0) {
    await sendBotText(
      app,
      message.from,
      'As modalidades de atendimento estão indisponíveis no momento.',
      sender
    );
    return;
  }

  await saveConversation(app, message.from, 'CHOOSE_SERVICE_MODE', { cart: [] }, message.id);
  await sendBotText(
    app,
    message.from,
    [
      'Top Lanches',
      'Escolha a modalidade de atendimento:',
      ...enabled.map((code, index) => `${index + 1}. ${SERVICE_LABELS[code]}`),
      '',
      'Responda com o número da opção.'
    ].join('\n'),
    sender
  );
}

async function sendCategories(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  const categories = await app.prisma.category.findMany({
    where: {
      active: true,
      products: { some: { active: true, available: true } }
    },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
  });

  if (categories.length === 0) {
    await sendBotText(app, message.from, 'O cardápio está sem produtos disponíveis no momento.', sender);
    return;
  }

  await saveConversation(app, message.from, 'CHOOSE_CATEGORY', data, message.id);
  await sendBotText(
    app,
    message.from,
    [
      'Escolha uma categoria:',
      ...categories.map((category, index) => `${index + 1}. ${category.name}`),
      '',
      'Responda com o número ou nome da categoria. Digite cancelar para encerrar.'
    ].join('\n'),
    sender
  );
}

async function sendProducts(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  if (!data.categoryId) {
    await sendCategories(app, message, data, sender);
    return;
  }

  const category = await app.prisma.category.findUnique({
    where: { id: data.categoryId },
    include: {
      products: {
        where: { active: true, available: true },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }]
      }
    }
  });

  if (!category || !category.active || category.products.length === 0) {
    const next = { ...data };
    delete next.categoryId;
    await sendCategories(app, message, next, sender);
    return;
  }

  await saveConversation(app, message.from, 'CHOOSE_PRODUCT', data, message.id);
  await sendBotText(
    app,
    message.from,
    [
      category.name,
      ...category.products.map((product, index) => {
        const volume = product.volume ? ` ${product.volume}` : '';
        return `${index + 1}. ${product.name}${volume} — ${formatCents(effectivePriceInCents(product))}`;
      }),
      '',
      'Responda com o número ou nome do produto.'
    ].join('\n'),
    sender
  );
}

async function getCartSummary(app: FastifyInstance, data: BotData): Promise<{
  text: string;
  totalInCents: number;
}> {
  const cart = data.cart ?? [];
  if (cart.length === 0) return { text: 'Carrinho vazio.', totalInCents: 0 };

  const products = await app.prisma.product.findMany({
    where: { id: { in: cart.map((item) => item.productId) } }
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  let totalInCents = 0;
  const lines = ['Seu pedido:'];

  for (const item of cart) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const subtotal = effectivePriceInCents(product) * item.quantity;
    totalInCents += subtotal;
    lines.push(`${item.quantity}x ${product.name} — ${formatCents(subtotal)}`);
  }

  lines.push(`Total: ${formatCents(totalInCents)}`);
  return { text: lines.join('\n'), totalInCents };
}

async function sendCartAction(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  const summary = await getCartSummary(app, data);
  await saveConversation(app, message.from, 'CHOOSE_CART_ACTION', data, message.id);
  await sendBotText(
    app,
    message.from,
    [
      summary.text,
      '',
      'O que deseja fazer?',
      '1. Adicionar outro produto',
      '2. Finalizar pedido',
      '3. Ver carrinho novamente'
    ].join('\n'),
    sender
  );
}

async function sendPaymentOptions(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  const methods = await app.prisma.paymentMethod.findMany({ where: { enabled: true } });
  const orderedCodes: PaymentMethodCode[] = ['PIX', 'CASH'];
  const enabled = orderedCodes.filter((code) => methods.some((method) => method.code === code));

  if (enabled.length === 0) {
    await sendBotText(app, message.from, 'As formas de pagamento estão indisponíveis no momento.', sender);
    return;
  }

  await saveConversation(app, message.from, 'CHOOSE_PAYMENT', data, message.id);
  await sendBotText(
    app,
    message.from,
    [
      'Escolha a forma de pagamento:',
      ...enabled.map((code, index) => `${index + 1}. ${PAYMENT_LABELS[code]}`),
      '',
      'Responda com o número da opção.'
    ].join('\n'),
    sender
  );
}

async function sendConfirmation(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  if (!data.serviceMode || !data.paymentMethod || !data.customerName) {
    await clearConversation(app, message.from);
    await startConversation(app, message, sender);
    return;
  }

  const cart = await getCartSummary(app, data);
  const lines = [
    'Confirme o pedido:',
    `Cliente: ${data.customerName}`,
    `Atendimento: ${SERVICE_LABELS[data.serviceMode]}`,
    cart.text.replace('Seu pedido:\n', ''),
    `Pagamento: ${PAYMENT_LABELS[data.paymentMethod]}`
  ];

  if (data.paymentMethod === 'CASH' && data.cashChangeFor) {
    const changeInCents = decimalInputToCents(data.cashChangeFor);
    lines.push(`Troco para: ${formatCents(changeInCents)}`);
  }

  if (data.serviceMode === 'delivery' && data.address) {
    const complement = data.address.complement ? `, ${data.address.complement}` : '';
    const reference = data.address.reference ? ` | Referência: ${data.address.reference}` : '';
    lines.push(
      `Endereço: ${data.address.street ?? ''}, ${data.address.number ?? ''}${complement} — ${data.address.neighborhood ?? ''}${reference}`
    );
  }

  lines.push('', '1. Confirmar', '2. Cancelar');

  await saveConversation(app, message.from, 'CONFIRM_ORDER', data, message.id);
  await sendBotText(app, message.from, lines.join('\n'), sender);
}

async function finishOrder(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  data: BotData,
  sender: BotSender
): Promise<void> {
  if (
    !data.serviceMode ||
    !data.paymentMethod ||
    !data.customerName ||
    !data.cart?.length
  ) {
    await clearConversation(app, message.from);
    await startConversation(app, message, sender);
    return;
  }

  if (
    data.serviceMode === 'delivery' &&
    (!data.address?.street || !data.address.number || !data.address.neighborhood)
  ) {
    await saveConversation(app, message.from, 'ASK_STREET', data, message.id);
    await sendBotText(app, message.from, 'Informe a rua do endereço de entrega.', sender);
    return;
  }

  try {
    const result = await createOrder(
      app.prisma,
      {
        customer: {
          name: data.customerName,
          phone: message.from
        },
        serviceMode: data.serviceMode,
        paymentMethod: data.paymentMethod,
        ...(data.paymentMethod === 'CASH' && data.cashChangeFor
          ? { cashChangeFor: data.cashChangeFor }
          : {}),
        items: data.cart,
        ...(data.serviceMode === 'delivery'
          ? {
              address: {
                street: data.address?.street ?? '',
                number: data.address?.number ?? '',
                neighborhood: data.address?.neighborhood ?? '',
                ...(data.address?.complement ? { complement: data.address.complement } : {}),
                ...(data.address?.reference ? { reference: data.address.reference } : {})
              }
            }
          : {})
      },
      `whatsapp:${message.id}`
    );

    await clearConversation(app, message.from);
    await sendBotText(
      app,
      message.from,
      [
        `Pedido ${result.order.orderNumber} confirmado.`,
        `Total: ${formatCents(result.order.totalInCents)}`,
        `Atendimento: ${SERVICE_LABELS[result.order.serviceMode]}`,
        `Pagamento: ${PAYMENT_LABELS[result.order.paymentMethod]}`,
        '',
        'Para iniciar outro pedido, envie Oi.'
      ].join('\n'),
      sender
    );
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'BUSINESS_CLOSED') {
        await clearConversation(app, message.from);
      }
      if (error.code === 'PRODUCT_UNAVAILABLE' || error.code === 'PRODUCT_NOT_FOUND') {
        const next = { ...data, cart: [] };
        delete next.productId;
        delete next.categoryId;
        await sendBotText(
          app,
          message.from,
          `${error.message}\nO carrinho foi reiniciado para evitar um pedido com item indisponível.`,
          sender
        );
        await sendCategories(app, message, next, sender);
        return;
      }
      await sendBotText(app, message.from, error.message, sender);
      return;
    }
    throw error;
  }
}

function chooseServiceMode(text: string, enabled: ServiceModeCode[]): ServiceModeCode | null {
  const numbered = chooseNumber(text, enabled.length);
  if (numbered !== null) return enabled[numbered] ?? null;

  const normalized = normalizeText(text);
  if (normalized === 'delivery' || normalized === 'entrega') {
    return enabled.includes('delivery') ? 'delivery' : null;
  }
  if (normalized === 'retirada' || normalized === 'pickup') {
    return enabled.includes('pickup') ? 'pickup' : null;
  }
  if (normalized === 'presencial' || normalized === 'local') {
    return enabled.includes('dine_in') ? 'dine_in' : null;
  }
  return null;
}

function choosePayment(text: string, enabled: PaymentMethodCode[]): PaymentMethodCode | null {
  const numbered = chooseNumber(text, enabled.length);
  if (numbered !== null) return enabled[numbered] ?? null;

  const normalized = normalizeText(text);
  if (normalized === 'pix') return enabled.includes('PIX') ? 'PIX' : null;
  if (normalized === 'dinheiro' || normalized === 'cash') {
    return enabled.includes('CASH') ? 'CASH' : null;
  }
  return null;
}

export async function processWhatsAppOrderBotMessage(
  app: FastifyInstance,
  message: WhatsAppWebhookMessage,
  sender: BotSender = (to, text) => sendTextMessage(to, text, false)
): Promise<void> {
  if (!message.from) return;

  if (message.type !== 'text' || !message.text?.trim()) {
    await sendBotText(
      app,
      message.from,
      'Envie uma mensagem de texto para fazer seu pedido.',
      sender
    );
    return;
  }

  const text = message.text.trim();
  let conversation = await app.prisma.whatsappConversation.findUnique({
    where: { phone: message.from }
  });

  if (conversation?.lastMessageId === message.id) return;

  if (conversation && conversation.expiresAt.getTime() <= Date.now()) {
    await clearConversation(app, message.from);
    conversation = null;
  }

  if (isCancelText(text)) {
    await clearConversation(app, message.from);
    await sendBotText(
      app,
      message.from,
      'Pedido cancelado. Para iniciar novamente, envie Oi.',
      sender
    );
    return;
  }

  if (!conversation || !isBotState(conversation.state)) {
    await startConversation(app, message, sender);
    return;
  }

  const state = conversation.state;
  const data = asBotData(conversation.data);

  switch (state) {
    case 'CHOOSE_SERVICE_MODE': {
      const modes = await app.prisma.serviceMode.findMany({ where: { enabled: true } });
      const ordered: ServiceModeCode[] = ['delivery', 'pickup', 'dine_in'];
      const enabled = ordered.filter((code) => modes.some((mode) => mode.code === code));
      const selected = chooseServiceMode(text, enabled);
      if (!selected) {
        await sendBotText(app, message.from, 'Opção inválida. Responda com o número da modalidade.', sender);
        return;
      }
      const next = { ...data, serviceMode: selected };
      await sendCategories(app, message, next, sender);
      return;
    }

    case 'CHOOSE_CATEGORY': {
      const categories = await app.prisma.category.findMany({
        where: {
          active: true,
          products: { some: { active: true, available: true } }
        },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }]
      });
      const selected = chooseNamedOption(text, categories);
      if (!selected) {
        await sendBotText(app, message.from, 'Categoria não encontrada. Responda com o número ou nome exibido.', sender);
        return;
      }
      const next = { ...data, categoryId: selected.id };
      await sendProducts(app, message, next, sender);
      return;
    }

    case 'CHOOSE_PRODUCT': {
      if (!data.categoryId) {
        await sendCategories(app, message, data, sender);
        return;
      }
      const products = await app.prisma.product.findMany({
        where: {
          categoryId: data.categoryId,
          active: true,
          available: true
        },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }]
      });
      const selected = chooseNamedOption(text, products);
      if (!selected) {
        await sendBotText(app, message.from, 'Produto não encontrado. Responda com o número ou nome exibido.', sender);
        return;
      }
      const next = { ...data, productId: selected.id };
      await saveConversation(app, message.from, 'CHOOSE_QUANTITY', next, message.id);
      await sendBotText(
        app,
        message.from,
        `Quantas unidades de ${selected.name}? Digite um número de 1 a 99.`,
        sender
      );
      return;
    }

    case 'CHOOSE_QUANTITY': {
      const quantity = Number(text);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !data.productId) {
        await sendBotText(app, message.from, 'Quantidade inválida. Digite um número de 1 a 99.', sender);
        return;
      }

      const cart = [...(data.cart ?? [])];
      const existing = cart.find((item) => item.productId === data.productId);
      if (existing) {
        if (existing.quantity + quantity > 99) {
          await sendBotText(app, message.from, 'A quantidade total desse produto não pode ultrapassar 99.', sender);
          return;
        }
        existing.quantity += quantity;
      } else {
        cart.push({ productId: data.productId, quantity });
      }

      const next: BotData = { ...data, cart };
      delete next.productId;
      delete next.categoryId;
      await sendCartAction(app, message, next, sender);
      return;
    }

    case 'CHOOSE_CART_ACTION': {
      const option = chooseNumber(text, 3);
      if (option === 0) {
        await sendCategories(app, message, data, sender);
        return;
      }
      if (option === 1) {
        await sendPaymentOptions(app, message, data, sender);
        return;
      }
      if (option === 2) {
        await sendCartAction(app, message, data, sender);
        return;
      }
      await sendBotText(app, message.from, 'Opção inválida. Responda 1, 2 ou 3.', sender);
      return;
    }

    case 'CHOOSE_PAYMENT': {
      const methods = await app.prisma.paymentMethod.findMany({ where: { enabled: true } });
      const ordered: PaymentMethodCode[] = ['PIX', 'CASH'];
      const enabled = ordered.filter((code) => methods.some((method) => method.code === code));
      const selected = choosePayment(text, enabled);
      if (!selected) {
        await sendBotText(app, message.from, 'Forma de pagamento inválida. Responda com o número da opção.', sender);
        return;
      }

      const next: BotData = { ...data, paymentMethod: selected };
      delete next.cashChangeFor;
      if (selected === 'CASH') {
        await saveConversation(app, message.from, 'ASK_CASH_CHANGE', next, message.id);
        await sendBotText(
          app,
          message.from,
          'Precisa de troco? Digite o valor em reais para o troco ou responda não.',
          sender
        );
        return;
      }

      await saveConversation(app, message.from, 'ASK_NAME', next, message.id);
      await sendBotText(app, message.from, 'Informe o nome do cliente.', sender);
      return;
    }

    case 'ASK_CASH_CHANGE': {
      const next: BotData = { ...data };
      if (!isSkipText(text)) {
        try {
          const cents = decimalInputToCents(text);
          const cart = await getCartSummary(app, data);
          if (cents < cart.totalInCents) {
            await sendBotText(
              app,
              message.from,
              `O valor para troco precisa ser pelo menos ${formatCents(cart.totalInCents)}. Digite outro valor ou responda não.`,
              sender
            );
            return;
          }
          next.cashChangeFor = text.replace(',', '.');
        } catch {
          await sendBotText(app, message.from, 'Valor inválido. Exemplo: 50 ou 50,00. Se não precisar de troco, responda não.', sender);
          return;
        }
      }
      await saveConversation(app, message.from, 'ASK_NAME', next, message.id);
      await sendBotText(app, message.from, 'Informe o nome do cliente.', sender);
      return;
    }

    case 'ASK_NAME': {
      if (text.length > 120) {
        await sendBotText(app, message.from, 'O nome está muito longo. Informe um nome com até 120 caracteres.', sender);
        return;
      }
      const next = { ...data, customerName: text };
      if (data.serviceMode === 'delivery') {
        await saveConversation(app, message.from, 'ASK_STREET', next, message.id);
        await sendBotText(app, message.from, 'Informe a rua do endereço de entrega.', sender);
        return;
      }
      await sendConfirmation(app, message, next, sender);
      return;
    }

    case 'ASK_STREET': {
      if (text.length > 180) {
        await sendBotText(app, message.from, 'A rua está muito longa. Informe em até 180 caracteres.', sender);
        return;
      }
      const next = { ...data, address: { ...(data.address ?? {}), street: text } };
      await saveConversation(app, message.from, 'ASK_NUMBER', next, message.id);
      await sendBotText(app, message.from, 'Informe o número do endereço.', sender);
      return;
    }

    case 'ASK_NUMBER': {
      if (text.length > 30) {
        await sendBotText(app, message.from, 'O número está muito longo. Informe em até 30 caracteres.', sender);
        return;
      }
      const next = { ...data, address: { ...(data.address ?? {}), number: text } };
      await saveConversation(app, message.from, 'ASK_NEIGHBORHOOD', next, message.id);
      await sendBotText(app, message.from, 'Informe o bairro.', sender);
      return;
    }

    case 'ASK_NEIGHBORHOOD': {
      if (text.length > 120) {
        await sendBotText(app, message.from, 'O bairro está muito longo. Informe em até 120 caracteres.', sender);
        return;
      }
      const next = { ...data, address: { ...(data.address ?? {}), neighborhood: text } };
      await saveConversation(app, message.from, 'ASK_COMPLEMENT', next, message.id);
      await sendBotText(
        app,
        message.from,
        'Informe o complemento. Se não houver, responda não.',
        sender
      );
      return;
    }

    case 'ASK_COMPLEMENT': {
      if (text.length > 180) {
        await sendBotText(app, message.from, 'O complemento está muito longo. Informe em até 180 caracteres.', sender);
        return;
      }
      const address = { ...(data.address ?? {}) };
      if (!isSkipText(text)) address.complement = text;
      const next = { ...data, address };
      await saveConversation(app, message.from, 'ASK_REFERENCE', next, message.id);
      await sendBotText(
        app,
        message.from,
        'Informe um ponto de referência. Se não houver, responda não.',
        sender
      );
      return;
    }

    case 'ASK_REFERENCE': {
      if (text.length > 250) {
        await sendBotText(app, message.from, 'A referência está muito longa. Informe em até 250 caracteres.', sender);
        return;
      }
      const address = { ...(data.address ?? {}) };
      if (!isSkipText(text)) address.reference = text;
      const next = { ...data, address };
      await sendConfirmation(app, message, next, sender);
      return;
    }

    case 'CONFIRM_ORDER': {
      const option = chooseNumber(text, 2);
      if (option === 0) {
        await finishOrder(app, message, data, sender);
        return;
      }
      if (option === 1) {
        await clearConversation(app, message.from);
        await sendBotText(
          app,
          message.from,
          'Pedido cancelado. Para iniciar novamente, envie Oi.',
          sender
        );
        return;
      }
      await sendBotText(app, message.from, 'Responda 1 para confirmar ou 2 para cancelar.', sender);
      return;
    }
  }
}

export function createTestBotMessage(
  from: string,
  text: string,
  id = randomUUID()
): WhatsAppWebhookMessage {
  return {
    id,
    from,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'text',
    text
  };
}
