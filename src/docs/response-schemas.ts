export const errorResponseJsonSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'statusCode'],
      additionalProperties: true,
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Dados inválidos' },
        statusCode: { type: 'integer', example: 422 },
        requestId: { type: 'string' },
        details: {}
      }
    }
  }
} as const;

export const healthResponseJsonSchema = {
  type: 'object',
  required: ['status', 'database', 'timestamp'],
  properties: {
    status: { type: 'string', enum: ['ok', 'error'] },
    database: { type: 'string', enum: ['connected', 'disconnected'] },
    timestamp: { type: 'string', format: 'date-time' }
  }
} as const;

export const apiRootResponseJsonSchema = {
  type: 'object',
  required: ['name', 'version', 'docs', 'health'],
  properties: {
    name: { type: 'string', example: 'Top Lanches API' },
    version: { type: 'string', example: '1.1.0' },
    docs: { type: 'string', example: '/docs' },
    health: { type: 'string', example: '/health' }
  }
} as const;

export const businessResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name', 'whatsapp', 'whatsappFormatted', 'instagram', 'address', 'timezone'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    whatsapp: { type: 'string' },
    whatsappFormatted: { type: 'string' },
    instagram: { type: 'string' },
    address: { type: 'string' },
    timezone: { type: 'string', example: 'America/Fortaleza' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const businessStatusResponseJsonSchema = {
  type: 'object',
  required: ['isOpen', 'status', 'message', 'closesAt', 'nextOpeningAt'],
  properties: {
    isOpen: { type: 'boolean' },
    status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
    message: { type: 'string' },
    closesAt: { type: 'string', nullable: true, example: '16:00' },
    nextOpeningAt: { type: 'string', nullable: true, example: '17:00' }
  }
} as const;

const periodJsonSchema = {
  type: 'object',
  required: ['open', 'close'],
  properties: {
    open: { type: 'string', example: '07:00' },
    close: { type: 'string', example: '16:00' }
  }
} as const;

export const hoursResponseJsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['dayOfWeek', 'periods'],
    properties: {
      dayOfWeek: { type: 'integer', minimum: 1, maximum: 7 },
      periods: { type: 'array', items: periodJsonSchema }
    }
  }
} as const;

export const serviceModesResponseJsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['code', 'name', 'enabled'],
    properties: {
      code: { type: 'string', enum: ['delivery', 'pickup', 'dine_in'] },
      name: { type: 'string' },
      enabled: { type: 'boolean' }
    }
  }
} as const;

export const paymentMethodsResponseJsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['code', 'name', 'enabled'],
    properties: {
      code: { type: 'string', enum: ['PIX', 'CASH'] },
      name: { type: 'string' },
      enabled: { type: 'boolean' }
    }
  }
} as const;

export const categoryResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name', 'slug', 'priority', 'active'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    bannerUrl: { type: 'string', nullable: true },
    searchTerms: { type: 'array', items: { type: 'string' } },
    priority: { type: 'integer' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const categoriesResponseJsonSchema = {
  type: 'array',
  items: categoryResponseJsonSchema
} as const;

export const productResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name', 'slug', 'categoryId', 'price', 'priceInCents', 'priceFormatted', 'available'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    categoryId: { type: 'string', format: 'uuid' },
    description: { type: 'string', nullable: true },
    price: { type: 'number', example: 15 },
    priceInCents: { type: 'integer', example: 1500 },
    priceFormatted: { type: 'string', example: 'R$ 15,00' },
    promotionalPrice: { type: 'number', nullable: true },
    promotionalPriceInCents: { type: 'integer', nullable: true },
    promotionalPriceFormatted: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    volume: { type: 'string', nullable: true },
    unit: { type: 'string', nullable: true },
    available: { type: 'boolean' },
    active: { type: 'boolean' },
    featured: { type: 'boolean' },
    priority: { type: 'integer' }
  }
} as const;

export const paginationMetaResponseJsonSchema = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
    hasNextPage: { type: 'boolean' },
    hasPreviousPage: { type: 'boolean' }
  }
} as const;

export const paginatedProductsResponseJsonSchema = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: { type: 'array', items: productResponseJsonSchema },
    meta: paginationMetaResponseJsonSchema
  }
} as const;

export const searchResponseJsonSchema = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: { type: 'array', items: productResponseJsonSchema },
    meta: {
      type: 'object',
      required: ['query', 'total'],
      properties: {
        query: { type: 'string' },
        total: { type: 'integer' }
      }
    }
  }
} as const;

export const menuResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['business', 'status', 'serviceModes', 'paymentMethods', 'categories'],
  properties: {
    business: { type: 'object', additionalProperties: true },
    status: businessStatusResponseJsonSchema,
    serviceModes: serviceModesResponseJsonSchema,
    paymentMethods: paymentMethodsResponseJsonSchema,
    categories: { type: 'array', items: { type: 'object', additionalProperties: true } }
  }
} as const;

const orderItemResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['productId', 'productName', 'productSlug', 'quantity', 'unitPriceInCents', 'subtotalInCents'],
  properties: {
    productId: { type: 'string', format: 'uuid' },
    productName: { type: 'string' },
    productSlug: { type: 'string' },
    quantity: { type: 'integer' },
    unitPriceInCents: { type: 'integer' },
    unitPriceFormatted: { type: 'string' },
    subtotalInCents: { type: 'integer' },
    subtotalFormatted: { type: 'string' }
  }
} as const;

export const orderResponseJsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'orderNumber', 'customer', 'serviceMode', 'paymentMethod', 'status', 'subtotalInCents', 'totalInCents', 'items'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    orderNumber: { type: 'string', example: 'TL-000123' },
    customer: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', nullable: true }
      }
    },
    serviceMode: { type: 'string', enum: ['delivery', 'pickup', 'dine_in'] },
    paymentMethod: { type: 'string', enum: ['PIX', 'CASH'] },
    status: { type: 'string' },
    cashChangeForInCents: { type: 'integer', nullable: true },
    notes: { type: 'string', nullable: true },
    subtotalInCents: { type: 'integer' },
    subtotal: { type: 'number' },
    subtotalFormatted: { type: 'string' },
    deliveryFeeInCents: { type: 'integer', nullable: true },
    totalInCents: { type: 'integer' },
    total: { type: 'number' },
    totalFormatted: { type: 'string' },
    address: { type: 'object', nullable: true, additionalProperties: true },
    items: { type: 'array', items: orderItemResponseJsonSchema },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const paginatedOrdersResponseJsonSchema = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: { type: 'array', items: orderResponseJsonSchema },
    meta: paginationMetaResponseJsonSchema
  }
} as const;

export const whatsappResponseJsonSchema = {
  type: 'object',
  required: ['message', 'url'],
  properties: {
    message: { type: 'string' },
    url: { type: 'string', format: 'uri' }
  }
} as const;

export const loginResponseJsonSchema = {
  type: 'object',
  required: ['accessToken', 'expiresIn'],
  properties: {
    accessToken: { type: 'string' },
    expiresIn: { type: 'integer', example: 3600 }
  }
} as const;

export const settingsResponseJsonSchema = {
  type: 'object',
  required: ['acceptOrdersWhenClosed'],
  properties: {
    acceptOrdersWhenClosed: { type: 'boolean' }
  }
} as const;

export const noContentResponseJsonSchema = {
  type: 'null',
  description: 'Sem conteúdo.'
} as const;

export const standardErrorResponses = {
  400: errorResponseJsonSchema,
  401: errorResponseJsonSchema,
  403: errorResponseJsonSchema,
  404: errorResponseJsonSchema,
  409: errorResponseJsonSchema,
  422: errorResponseJsonSchema,
  429: errorResponseJsonSchema,
  500: errorResponseJsonSchema,
  502: errorResponseJsonSchema,
  503: errorResponseJsonSchema
} as const;
