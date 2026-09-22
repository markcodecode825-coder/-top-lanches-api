import type { Prisma, PrismaClient, Product } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { decimalInputToCents, formatCents } from '../../utils/money';
import { createOrder } from '../orders/service';
import { effectivePriceInCents } from '../products/presenter';
import { persistOutboundMessage } from './persistence';
import {
  normalizePhoneForWhatsApp,
  sendTextMessage,
  type WhatsAppWebhookMessage
} from './service';

type BotStep =
  | 'SERVICE_MODE'
  | 'CUSTOMER_NAME'
  | 'CATEGORY'
  | 'PRODUCT'
  | 'QUANTITY'
  | 'CART_ACTION'
  | 'REMOVE_ITEM'
  | 'PAYMENT'
  | 'CASH_CHANGE'
  | 'ADDRESS_STREET'
  | 'ADDRESS_NUMBER'
  | 'ADDRESS_NEIGHBORHOOD'
  | 'ADDRESS_COMPLEMENT'
  | 'ADDRESS_REFERENCE'
  | 'CONFIRM';

type ServiceMode = 'delivery' | 'pickup' | 'dine_in';
type PaymentMethod = 'PIX' | 'CASH';

interface BotCartItem {
  productId: string;
  quantity: number;
}

interface BotAddress {
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  reference?: string;
}

interface BotState {
  cart: BotCartItem[];
  serviceMode?: ServiceMode;
  customerName?: string;
  categoryId?: string;
  selectedProductId?: string;
  productPage?: number;
  paymentMethod?: PaymentMethod;
  cashChangeFor?: string;
  address?: BotAddress;
}

interface CartSnapshotLine {
  productId: string;
  name: string;
  quantity: number;
  unitPriceInCents: number;
  subtotalInCents: number;
}

const PRODUCT_PAGE_SIZE = 8;

function emptyState(): BotState {
  return { cart: [], productPage: 0, address: {} };
}

function stateToJson(state: BotState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}

function readState(value: Prisma.JsonValue): BotState {
  const raw = value as unknown as Partial<BotState>;
  const cart = Array.isArray(raw.cart)
    ? raw.cart.filter(
        (item): item is BotCartItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.productId === 'string' &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
      )
    : [];

  return {
    ...raw,
    cart,
    productPage: Number.isInteger(raw.productPage) && Number(raw.productPage) >= 0 ? Number(raw.productPage) : 0,
    address: raw.address && typeof raw.address === 'object' ? raw.address : {}
  };
}

function normalizeCommand(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function isResetCommand(text: string): boolean {
  const command = normalizeCommand(text);
  return command === 'cancelar' || command === 'reiniciar' || command === 'menu' || command === 'inicio';
}

export function parseMenuChoice(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

export function parseCashChangeText(text: string): { skip: true } | { skip: false; value: string } | null {
  const normalized = normalizeCommand(text);
  if (['0', 'nao', 'sem troco', 'nao precisa', 'sem'].includes(normalized)) return { skip: true };

  const cleaned = text.trim().replace(/^r\$\s*/i, '').replace(/\s/g, '');
  try {
    decimalInputToCents(cleaned);
    return { skip: false, value: cleaned.replace(',', '.') };
  } catch {
    return null;
  }
}

function serviceModePrompt(): string {
  return [
    'TOP LANCHES',
    '',
    'Escolha como deseja receber o pedido:',
    '1 - Delivery',
    '2 - Retirada',
    '3 - Presencial',
    '',
    'Digite o número da opção.',
    'Para começar novamente, digite CANCELAR.'
  ].join('\n');
}

function paymentPrompt(): string {
  return ['Forma de pagamento:', '1 - Pix', '2 - Dinheiro', '', 'Digite o número da opção.'].join('\n');
}

function cartActionPrompt(): string {
  return [
    'O que deseja fazer agora?',
    '1 - Adicionar outro produto',
    '2 - Finalizar pedido',
    '3 - Ver carrinho',
    '4 - Remover um item',
    '',
    'Digite o número da opção.'
  ].join('\n');
}

function splitMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? current + '\n' + line : line;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxLength) {
      current = line;
      continue;
    }
    for (let start = 0; start < line.length; start += maxLength) {
      chunks.push(line.slice(start, start + maxLength));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendBotText(prisma: PrismaClient, phone: string, text: string): Promise<void> {
  for (const chunk of splitMessage(text)) {
    const result = await sendTextMessage(phone, chunk, false);
    await persistOutboundMessage(prisma, {
      providerMessageId: result.messageId,
      phone: result.recipientWaId ?? normalizePhoneForWhatsApp(phone),
      type: 'text',
      text: chunk
    });
  }
}

async function saveConversation(
  prisma: PrismaClient,
  phone: string,
  step: BotStep,
  state: BotState,
  messageId: string
): Promise<void> {
  await prisma.whatsappConversation.update({
    where: { phone },
    data: {
      step,
      state: stateToJson(state),
      lastInboundMessageId: messageId,
      lastInteractionAt: new Date()
    }
  });
}

async function resetConversation(prisma: PrismaClient, phone: string, messageId: string): Promise<void> {
  await prisma.whatsappConversation.upsert({
    where: { phone },
    create: {
      phone,
      step: 'SERVICE_MODE',
      state: stateToJson(emptyState()),
      lastInboundMessageId: messageId,
      lastInteractionAt: new Date()
    },
    update: {
      step: 'SERVICE_MODE',
      state: stateToJson(emptyState()),
      lastInboundMessageId: messageId,
      lastInteractionAt: new Date()
    }
  });
}

async function categoryPrompt(prisma: PrismaClient): Promise<string> {
  const categories = await prisma.category.findMany({
    where: {
      active: true,
      products: { some: { active: true, available: true } }
    },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
  });

  if (categories.length === 0) return 'Nenhuma categoria está disponível no momento.';

  return [
    'Escolha uma categoria:',
    ...categories.map((category, index) => String(index + 1) + ' - ' + category.name),
    '',
    'Digite o número da categoria.'
  ].join('\n');
}

async function productPrompt(
  prisma: PrismaClient,
  categoryId: string,
  page: number
): Promise<{ text: string; products: Product[]; page: number; totalPages: number }> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category?.active) {
    return { text: 'Essa categoria não está disponível. Digite MENU para recomeçar.', products: [], page: 0, totalPages: 0 };
  }

  const total = await prisma.product.count({
    where: { categoryId, active: true, available: true }
  });
  const totalPages = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const products = await prisma.product.findMany({
    where: { categoryId, active: true, available: true },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    skip: safePage * PRODUCT_PAGE_SIZE,
    take: PRODUCT_PAGE_SIZE
  });

  const lines = products.map((product, index) => {
    const price = formatCents(effectivePriceInCents(product));
    const volume = product.volume ? ' - ' + product.volume : '';
    return String(index + 1) + ' - ' + product.name + volume + ' - ' + price;
  });

  return {
    products,
    page: safePage,
    totalPages,
    text: [
      category.name,
      '',
      ...lines,
      '',
      '0 - Voltar às categorias',
      ...(safePage + 1 < totalPages ? ['MAIS - Próxima página'] : []),
      ...(safePage > 0 ? ['ANTERIOR - Página anterior'] : []),
      '',
      'Digite o número do produto.'
    ].join('\n')
  };
}

async function getCartSnapshot(prisma: PrismaClient, state: BotState): Promise<CartSnapshotLine[]> {
  if (state.cart.length === 0) return [];

  const ids = [...new Set(state.cart.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((product) => [product.id, product]));

  return state.cart.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new AppError('PRODUCT_NOT_FOUND', 404, 'Um produto do carrinho não foi encontrado');
    const unitPriceInCents = effectivePriceInCents(product);
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPriceInCents,
      subtotalInCents: unitPriceInCents * item.quantity
    };
  });
}

async function cartSummary(prisma: PrismaClient, state: BotState): Promise<string> {
  const lines = await getCartSnapshot(prisma, state);
  if (lines.length === 0) return 'Seu carrinho está vazio.';
  const total = lines.reduce((sum, line) => sum + line.subtotalInCents, 0);

  return [
    'Seu carrinho:',
    ...lines.map(
      (line, index) =>
        String(index + 1) +
        ' - ' +
        String(line.quantity) +
        'x ' +
        line.name +
        ' - ' +
        formatCents(line.subtotalInCents)
    ),
    '',
    'Total: ' + formatCents(total)
  ].join('\n');
}

function serviceModeName(mode: ServiceMode | undefined): string {
  if (mode === 'delivery') return 'Delivery';
  if (mode === 'pickup') return 'Retirada';
  if (mode === 'dine_in') return 'Presencial';
  return '';
}

function paymentName(method: PaymentMethod | undefined): string {
  return method === 'CASH' ? 'Dinheiro' : 'Pix';
}

async function confirmationPrompt(prisma: PrismaClient, state: BotState): Promise<string> {
  const summary = await cartSummary(prisma, state);
  const address = state.address ?? {};
  const addressLines =
    state.serviceMode === 'delivery'
      ? [
          'Endereço: ' +
            [address.street, address.number, address.neighborhood].filter(Boolean).join(', '),
          ...(address.complement ? ['Complemento: ' + address.complement] : []),
          ...(address.reference ? ['Referência: ' + address.reference] : [])
        ]
      : [];

  return [
    'Confirme seu pedido:',
    '',
    'Nome: ' + (state.customerName ?? ''),
    'Atendimento: ' + serviceModeName(state.serviceMode),
    'Pagamento: ' + paymentName(state.paymentMethod),
    ...(state.paymentMethod === 'CASH'
      ? ['Troco: ' + (state.cashChangeFor ? 'para R$ ' + state.cashChangeFor.replace('.', ',') : 'sem troco')]
      : []),
    ...addressLines,
    '',
    summary,
    '',
    '1 - Confirmar pedido',
    '2 - Cancelar',
    '',
    'Digite o número da opção.'
  ].join('\n');
}

async function advanceToAddressOrConfirm(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  messageId: string
): Promise<void> {
  if (state.serviceMode === 'delivery') {
    await saveConversation(prisma, phone, 'ADDRESS_STREET', state, messageId);
    await sendBotText(prisma, phone, 'Digite o nome da rua do endereço de entrega.');
    return;
  }

  await saveConversation(prisma, phone, 'CONFIRM', state, messageId);
  await sendBotText(prisma, phone, await confirmationPrompt(prisma, state));
}

async function handleServiceMode(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const choice = parseMenuChoice(text, 3);
  const mode: ServiceMode | undefined =
    choice === 1 ? 'delivery' : choice === 2 ? 'pickup' : choice === 3 ? 'dine_in' : undefined;

  if (!mode) {
    await saveConversation(prisma, phone, 'SERVICE_MODE', state, messageId);
    await sendBotText(prisma, phone, serviceModePrompt());
    return;
  }

  const configured = await prisma.serviceMode.findUnique({ where: { code: mode } });
  if (!configured?.enabled) {
    await saveConversation(prisma, phone, 'SERVICE_MODE', state, messageId);
    await sendBotText(prisma, phone, 'Essa modalidade está indisponível no momento.\n\n' + serviceModePrompt());
    return;
  }

  state.serviceMode = mode;
  await saveConversation(prisma, phone, 'CUSTOMER_NAME', state, messageId);
  await sendBotText(prisma, phone, 'Qual é o seu nome?');
}

async function handleCustomerName(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const name = text.trim();
  if (name.length < 1 || name.length > 120) {
    await saveConversation(prisma, phone, 'CUSTOMER_NAME', state, messageId);
    await sendBotText(prisma, phone, 'Digite um nome válido com até 120 caracteres.');
    return;
  }

  state.customerName = name;
  await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
  await sendBotText(prisma, phone, await categoryPrompt(prisma));
}

async function handleCategory(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { active: true, products: { some: { active: true, available: true } } },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
  });
  const choice = parseMenuChoice(text, categories.length);
  if (!choice || choice < 1) {
    await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
    await sendBotText(prisma, phone, await categoryPrompt(prisma));
    return;
  }

  const category = categories[choice - 1];
  if (!category) return;

  state.categoryId = category.id;
  state.productPage = 0;
  await saveConversation(prisma, phone, 'PRODUCT', state, messageId);
  const prompt = await productPrompt(prisma, category.id, 0);
  await sendBotText(prisma, phone, prompt.text);
}

async function handleProduct(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  if (!state.categoryId) {
    await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
    await sendBotText(prisma, phone, await categoryPrompt(prisma));
    return;
  }

  const command = normalizeCommand(text);
  const current = await productPrompt(prisma, state.categoryId, state.productPage ?? 0);

  if (command === 'mais' && current.page + 1 < current.totalPages) {
    state.productPage = current.page + 1;
    const next = await productPrompt(prisma, state.categoryId, state.productPage);
    await saveConversation(prisma, phone, 'PRODUCT', state, messageId);
    await sendBotText(prisma, phone, next.text);
    return;
  }

  if (command === 'anterior' && current.page > 0) {
    state.productPage = current.page - 1;
    const previous = await productPrompt(prisma, state.categoryId, state.productPage);
    await saveConversation(prisma, phone, 'PRODUCT', state, messageId);
    await sendBotText(prisma, phone, previous.text);
    return;
  }

  const choice = parseMenuChoice(text, current.products.length);
  if (choice === 0) {
    state.categoryId = undefined;
    state.productPage = 0;
    await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
    await sendBotText(prisma, phone, await categoryPrompt(prisma));
    return;
  }

  if (!choice || choice < 1) {
    await saveConversation(prisma, phone, 'PRODUCT', state, messageId);
    await sendBotText(prisma, phone, current.text);
    return;
  }

  const product = current.products[choice - 1];
  if (!product) return;

  state.selectedProductId = product.id;
  await saveConversation(prisma, phone, 'QUANTITY', state, messageId);
  await sendBotText(prisma, phone, 'Quantas unidades de ' + product.name + ' você deseja? Digite de 1 a 99.');
}

async function handleQuantity(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const quantity = parseMenuChoice(text, 99);
  if (!quantity || quantity < 1 || !state.selectedProductId) {
    await saveConversation(prisma, phone, 'QUANTITY', state, messageId);
    await sendBotText(prisma, phone, 'Digite uma quantidade entre 1 e 99.');
    return;
  }

  const product = await prisma.product.findUnique({ where: { id: state.selectedProductId } });
  if (!product?.active || !product.available) {
    state.selectedProductId = undefined;
    await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
    await sendBotText(prisma, phone, 'Esse produto ficou indisponível. Escolha outra opção.\n\n' + (await categoryPrompt(prisma)));
    return;
  }

  const existing = state.cart.find((item) => item.productId === product.id);
  if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
  else state.cart.push({ productId: product.id, quantity });

  state.selectedProductId = undefined;
  await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
  await sendBotText(prisma, phone, (await cartSummary(prisma, state)) + '\n\n' + cartActionPrompt());
}

async function handleCartAction(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const choice = parseMenuChoice(text, 4);

  if (choice === 1) {
    state.categoryId = undefined;
    state.productPage = 0;
    await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
    await sendBotText(prisma, phone, await categoryPrompt(prisma));
    return;
  }

  if (choice === 2) {
    if (state.cart.length === 0) {
      await saveConversation(prisma, phone, 'CATEGORY', state, messageId);
      await sendBotText(prisma, phone, 'Seu carrinho está vazio.\n\n' + (await categoryPrompt(prisma)));
      return;
    }
    await saveConversation(prisma, phone, 'PAYMENT', state, messageId);
    await sendBotText(prisma, phone, paymentPrompt());
    return;
  }

  if (choice === 3) {
    await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
    await sendBotText(prisma, phone, (await cartSummary(prisma, state)) + '\n\n' + cartActionPrompt());
    return;
  }

  if (choice === 4) {
    if (state.cart.length === 0) {
      await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
      await sendBotText(prisma, phone, 'Seu carrinho está vazio.\n\n' + cartActionPrompt());
      return;
    }

    await saveConversation(prisma, phone, 'REMOVE_ITEM', state, messageId);
    await sendBotText(
      prisma,
      phone,
      (await cartSummary(prisma, state)) + '\n\nDigite o número do item que deseja remover.\n0 - Voltar'
    );
    return;
  }

  await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
  await sendBotText(prisma, phone, cartActionPrompt());
}

async function handleRemoveItem(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const choice = parseMenuChoice(text, state.cart.length);
  if (choice === 0) {
    await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
    await sendBotText(prisma, phone, cartActionPrompt());
    return;
  }
  if (!choice || choice < 1) {
    await saveConversation(prisma, phone, 'REMOVE_ITEM', state, messageId);
    await sendBotText(
      prisma,
      phone,
      (await cartSummary(prisma, state)) + '\n\nDigite o número do item que deseja remover.\n0 - Voltar'
    );
    return;
  }

  state.cart.splice(choice - 1, 1);
  await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
  await sendBotText(prisma, phone, (await cartSummary(prisma, state)) + '\n\n' + cartActionPrompt());
}

async function handlePayment(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const choice = parseMenuChoice(text, 2);
  const method: PaymentMethod | undefined = choice === 1 ? 'PIX' : choice === 2 ? 'CASH' : undefined;
  if (!method) {
    await saveConversation(prisma, phone, 'PAYMENT', state, messageId);
    await sendBotText(prisma, phone, paymentPrompt());
    return;
  }

  const configured = await prisma.paymentMethod.findUnique({ where: { code: method } });
  if (!configured?.enabled) {
    await saveConversation(prisma, phone, 'PAYMENT', state, messageId);
    await sendBotText(prisma, phone, 'Essa forma de pagamento está indisponível.\n\n' + paymentPrompt());
    return;
  }

  state.paymentMethod = method;
  if (method === 'CASH') {
    await saveConversation(prisma, phone, 'CASH_CHANGE', state, messageId);
    await sendBotText(
      prisma,
      phone,
      'Precisa de troco? Digite o valor que vai pagar, por exemplo 50 ou 50,00. Se não precisar, digite SEM TROCO.'
    );
    return;
  }

  state.cashChangeFor = undefined;
  await advanceToAddressOrConfirm(prisma, phone, state, messageId);
}

async function handleCashChange(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const parsed = parseCashChangeText(text);
  if (!parsed) {
    await saveConversation(prisma, phone, 'CASH_CHANGE', state, messageId);
    await sendBotText(prisma, phone, 'Valor inválido. Digite, por exemplo, 50 ou 50,00. Para não pedir troco, digite SEM TROCO.');
    return;
  }

  if (parsed.skip) {
    state.cashChangeFor = undefined;
    await advanceToAddressOrConfirm(prisma, phone, state, messageId);
    return;
  }

  const total = (await getCartSnapshot(prisma, state)).reduce((sum, line) => sum + line.subtotalInCents, 0);
  const changeForInCents = decimalInputToCents(parsed.value);
  if (changeForInCents < total) {
    await saveConversation(prisma, phone, 'CASH_CHANGE', state, messageId);
    await sendBotText(
      prisma,
      phone,
      'O valor informado é menor que o total de ' + formatCents(total) + '. Informe um valor igual ou maior, ou digite SEM TROCO.'
    );
    return;
  }

  state.cashChangeFor = parsed.value;
  await advanceToAddressOrConfirm(prisma, phone, state, messageId);
}

function skippedOptionalField(text: string): boolean {
  return ['0', 'nao', 'pular', 'sem'].includes(normalizeCommand(text));
}

async function handleAddress(
  prisma: PrismaClient,
  phone: string,
  step: BotStep,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  state.address ??= {};
  const value = text.trim();

  if (step === 'ADDRESS_STREET') {
    if (!value || value.length > 180) {
      await saveConversation(prisma, phone, step, state, messageId);
      await sendBotText(prisma, phone, 'Digite uma rua válida com até 180 caracteres.');
      return;
    }
    state.address.street = value;
    await saveConversation(prisma, phone, 'ADDRESS_NUMBER', state, messageId);
    await sendBotText(prisma, phone, 'Digite o número do endereço.');
    return;
  }

  if (step === 'ADDRESS_NUMBER') {
    if (!value || value.length > 30) {
      await saveConversation(prisma, phone, step, state, messageId);
      await sendBotText(prisma, phone, 'Digite um número válido com até 30 caracteres.');
      return;
    }
    state.address.number = value;
    await saveConversation(prisma, phone, 'ADDRESS_NEIGHBORHOOD', state, messageId);
    await sendBotText(prisma, phone, 'Digite o bairro.');
    return;
  }

  if (step === 'ADDRESS_NEIGHBORHOOD') {
    if (!value || value.length > 120) {
      await saveConversation(prisma, phone, step, state, messageId);
      await sendBotText(prisma, phone, 'Digite um bairro válido com até 120 caracteres.');
      return;
    }
    state.address.neighborhood = value;
    await saveConversation(prisma, phone, 'ADDRESS_COMPLEMENT', state, messageId);
    await sendBotText(prisma, phone, 'Digite o complemento. Se não houver, digite 0.');
    return;
  }

  if (step === 'ADDRESS_COMPLEMENT') {
    state.address.complement = skippedOptionalField(value) ? undefined : value.slice(0, 180);
    await saveConversation(prisma, phone, 'ADDRESS_REFERENCE', state, messageId);
    await sendBotText(prisma, phone, 'Digite um ponto de referência. Se não houver, digite 0.');
    return;
  }

  state.address.reference = skippedOptionalField(value) ? undefined : value.slice(0, 250);
  await saveConversation(prisma, phone, 'CONFIRM', state, messageId);
  await sendBotText(prisma, phone, await confirmationPrompt(prisma, state));
}

async function handleConfirm(
  prisma: PrismaClient,
  phone: string,
  state: BotState,
  text: string,
  messageId: string
): Promise<void> {
  const choice = parseMenuChoice(text, 2);
  if (choice === 2) {
    await resetConversation(prisma, phone, messageId);
    await sendBotText(prisma, phone, 'Pedido cancelado.\n\n' + serviceModePrompt());
    return;
  }

  if (choice !== 1) {
    await saveConversation(prisma, phone, 'CONFIRM', state, messageId);
    await sendBotText(prisma, phone, await confirmationPrompt(prisma, state));
    return;
  }

  if (!state.customerName || !state.serviceMode || !state.paymentMethod || state.cart.length === 0) {
    await resetConversation(prisma, phone, messageId);
    await sendBotText(prisma, phone, 'A conversa perdeu informações necessárias. Vamos começar novamente.\n\n' + serviceModePrompt());
    return;
  }

  if (
    state.serviceMode === 'delivery' &&
    (!state.address?.street || !state.address.number || !state.address.neighborhood)
  ) {
    await saveConversation(prisma, phone, 'ADDRESS_STREET', state, messageId);
    await sendBotText(prisma, phone, 'Precisamos confirmar o endereço. Digite o nome da rua.');
    return;
  }

  try {
    const result = await createOrder(
      prisma,
      {
        customer: { name: state.customerName, phone },
        serviceMode: state.serviceMode,
        paymentMethod: state.paymentMethod,
        ...(state.paymentMethod === 'CASH' && state.cashChangeFor
          ? { cashChangeFor: state.cashChangeFor }
          : {}),
        items: state.cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        ...(state.serviceMode === 'delivery'
          ? {
              address: {
                street: state.address?.street ?? '',
                number: state.address?.number ?? '',
                neighborhood: state.address?.neighborhood ?? '',
                complement: state.address?.complement ?? null,
                reference: state.address?.reference ?? null
              }
            }
          : {})
      },
      'whatsapp-' + messageId
    );

    await resetConversation(prisma, phone, messageId);
    await sendBotText(
      prisma,
      phone,
      [
        'Pedido confirmado.',
        'Número: ' + result.order.orderNumber,
        'Total: ' + formatCents(result.order.totalInCents),
        '',
        'A Top Lanches recebeu seu pedido.'
      ].join('\n')
    );
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'PRODUCT_UNAVAILABLE' || error.code === 'PRODUCT_NOT_FOUND') {
        await saveConversation(prisma, phone, 'CART_ACTION', state, messageId);
        await sendBotText(
          prisma,
          phone,
          'Um item do pedido não está mais disponível. Revise o carrinho antes de continuar.\n\n' +
            (await cartSummary(prisma, state)) +
            '\n\n' +
            cartActionPrompt()
        );
        return;
      }

      if (error.code === 'BUSINESS_CLOSED') {
        await saveConversation(prisma, phone, 'CONFIRM', state, messageId);
        await sendBotText(prisma, phone, error.message + '\nO pedido ficou salvo nesta conversa para você tentar novamente depois.');
        return;
      }

      await saveConversation(prisma, phone, 'CONFIRM', state, messageId);
      await sendBotText(prisma, phone, 'Não foi possível concluir o pedido: ' + error.message + '\nDigite 1 para tentar novamente ou 2 para cancelar.');
      return;
    }
    throw error;
  }
}

export async function handleWhatsAppBotMessage(
  prisma: PrismaClient,
  message: WhatsAppWebhookMessage
): Promise<void> {
  const phone = normalizePhoneForWhatsApp(message.from);
  const text = message.text?.trim();

  if (!text) {
    await sendBotText(
      prisma,
      phone,
      'No momento, o atendimento automático aceita mensagens de texto. Digite MENU para iniciar.'
    );
    return;
  }

  const existing = await prisma.whatsappConversation.findUnique({ where: { phone } });

  if (!existing || isResetCommand(text)) {
    await resetConversation(prisma, phone, message.id);
    await sendBotText(prisma, phone, serviceModePrompt());
    return;
  }

  if (existing.lastInboundMessageId === message.id) return;

  const state = readState(existing.state);
  const step = existing.step as BotStep;

  if (step === 'SERVICE_MODE') return handleServiceMode(prisma, phone, state, text, message.id);
  if (step === 'CUSTOMER_NAME') return handleCustomerName(prisma, phone, state, text, message.id);
  if (step === 'CATEGORY') return handleCategory(prisma, phone, state, text, message.id);
  if (step === 'PRODUCT') return handleProduct(prisma, phone, state, text, message.id);
  if (step === 'QUANTITY') return handleQuantity(prisma, phone, state, text, message.id);
  if (step === 'CART_ACTION') return handleCartAction(prisma, phone, state, text, message.id);
  if (step === 'REMOVE_ITEM') return handleRemoveItem(prisma, phone, state, text, message.id);
  if (step === 'PAYMENT') return handlePayment(prisma, phone, state, text, message.id);
  if (step === 'CASH_CHANGE') return handleCashChange(prisma, phone, state, text, message.id);
  if (
    step === 'ADDRESS_STREET' ||
    step === 'ADDRESS_NUMBER' ||
    step === 'ADDRESS_NEIGHBORHOOD' ||
    step === 'ADDRESS_COMPLEMENT' ||
    step === 'ADDRESS_REFERENCE'
  ) {
    return handleAddress(prisma, phone, step, state, text, message.id);
  }
  if (step === 'CONFIRM') return handleConfirm(prisma, phone, state, text, message.id);

  await resetConversation(prisma, phone, message.id);
  await sendBotText(prisma, phone, serviceModePrompt());
}
