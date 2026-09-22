import { MAX_MONEY_IN_CENTS } from '../utils/money';

export const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } }
} as const;

export const slugParamsSchema = {
  type: 'object',
  required: ['slug'],
  properties: { slug: { type: 'string', minLength: 1 } }
} as const;

export const codeParamsSchema = {
  type: 'object',
  required: ['code'],
  properties: { code: { type: 'string', minLength: 1 } }
} as const;

export const productsQueryJsonSchema = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    available: { type: 'string', enum: ['true', 'false'] },
    featured: { type: 'string', enum: ['true', 'false'] },
    minPrice: { type: 'string' },
    maxPrice: { type: 'string' },
    search: { type: 'string' },
    sort: {
      type: 'string',
      enum: ['priority', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'newest']
    },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  }
} as const;

export const searchQueryJsonSchema = {
  type: 'object',
  required: ['q'],
  properties: {
    q: { type: 'string', minLength: 1, maxLength: 100 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 }
  }
} as const;

export const loginBodyJsonSchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' }
  }
} as const;

export const createOrderBodyJsonSchema = {
  type: 'object',
  required: ['customer', 'serviceMode', 'paymentMethod', 'items'],
  additionalProperties: true,
  properties: {
    customer: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', nullable: true }
      }
    },
    serviceMode: { type: 'string', description: 'Valores aceitos: delivery, pickup, dine_in' },
    paymentMethod: { type: 'string', description: 'Valores aceitos: PIX, CASH' },
    cashChangeFor: {
      description: 'Valor de troco para CASH. É ignorado integralmente quando paymentMethod é PIX.',
    },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['productId', 'quantity'],
        additionalProperties: true,
        properties: {
          productId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1, maximum: 99 }
        }
      }
    },
    address: {
      type: 'object',
      required: ['street', 'number', 'neighborhood'],
      additionalProperties: false,
      properties: {
        street: { type: 'string' },
        number: { type: 'string' },
        complement: { type: 'string', nullable: true },
        neighborhood: { type: 'string' },
        reference: { type: 'string', nullable: true }
      }
    },
    notes: { type: 'string', nullable: true }
  }
} as const;

export const businessPatchBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    whatsapp: { type: 'string' },
    whatsappFormatted: { type: 'string' },
    instagram: { type: 'string' },
    address: { type: 'string' },
    timezone: { type: 'string' }
  }
} as const;

export const hoursBodyJsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['dayOfWeek', 'periods'],
    properties: {
      dayOfWeek: { type: 'integer', minimum: 1, maximum: 7 },
      periods: {
        type: 'array',
        items: {
          type: 'object',
          required: ['open', 'close'],
          properties: {
            open: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
            close: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
          }
        }
      }
    }
  }
} as const;

export const enableBodyJsonSchema = {
  type: 'object',
  required: ['enabled'],
  additionalProperties: false,
  properties: { enabled: { type: 'boolean' } }
} as const;

export const categoryBodyJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    bannerUrl: { type: 'string', nullable: true, format: 'uri' },
    searchTerms: { type: 'array', items: { type: 'string' } },
    priority: { type: 'integer', minimum: 0 },
    active: { type: 'boolean' }
  }
} as const;

export const productBodyJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    categoryId: { type: 'string', format: 'uuid' },
    description: { type: 'string', nullable: true },
    priceInCents: { type: 'integer', minimum: 0, maximum: MAX_MONEY_IN_CENTS },
    promotionalPriceInCents: { type: 'integer', nullable: true, minimum: 0, maximum: MAX_MONEY_IN_CENTS },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    volume: { type: 'string', nullable: true },
    unit: { type: 'string', nullable: true },
    searchTerms: { type: 'array', items: { type: 'string' } },
    available: { type: 'boolean' },
    active: { type: 'boolean' },
    featured: { type: 'boolean' },
    priority: { type: 'integer', minimum: 0 }
  }
} as const;

export const adminProductsQueryJsonSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', format: 'uuid' },
    active: { type: 'string', enum: ['true', 'false'] },
    available: { type: 'string', enum: ['true', 'false'] },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  }
} as const;

export const adminOrdersQueryJsonSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      description: 'Valores aceitos: PENDING, CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, COMPLETED, CANCELED'
    },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  }
} as const;

export const orderStatusBodyJsonSchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      description: 'Valores aceitos: PENDING, CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, COMPLETED, CANCELED'
    }
  }
} as const;

export const settingsBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { acceptOrdersWhenClosed: { type: 'boolean' } }
} as const;

export const categoryCreateBodyJsonSchema = {
  ...categoryBodyJsonSchema,
  required: ['name']
} as const;

export const productCreateBodyJsonSchema = {
  ...productBodyJsonSchema,
  required: ['name', 'categoryId', 'priceInCents']
} as const;

export const idempotencyHeadersJsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    'idempotency-key': {
      type: 'string',
      minLength: 8,
      maxLength: 200,
      description: 'Chave opcional para impedir criação duplicada do mesmo pedido.',
    }
  }
} as const;
