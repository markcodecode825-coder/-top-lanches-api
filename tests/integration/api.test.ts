import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '../../src/database/prisma';

let app: FastifyInstance;

async function getProduct(slug: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { slug } });
  return product;
}

async function login(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email: 'admin@example.com', password: 'change-me' }
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { accessToken: string }).accessToken;
}

async function createPickupOrder(options?: { idempotencyKey?: string; productId?: string; quantity?: number }) {
  const product = options?.productId ? { id: options.productId } : await getProduct('x-burguer');
  return app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: options?.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {},
    payload: {
      customer: { name: 'João', phone: '83999999999' },
      serviceMode: 'pickup',
      paymentMethod: 'PIX',
      items: [{ productId: product.id, quantity: options?.quantity ?? 1, price: 1 }],
      notes: null
    }
  });
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Top Lanches API', () => {
  it('GET /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('GET /api/v1 responde sem exigir barra final', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Top Lanches API', docs: '/docs' });
  });

  it('Swagger JSON carrega', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe('3.0.3');
    expect(body.paths['/api/v1/orders']).toBeDefined();
  });

  it('verifica o webhook do WhatsApp com o token configurado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-whatsapp-verify-token&hub.challenge=123456'
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('123456');
  });

  it('rejeita verificação do webhook do WhatsApp com token incorreto', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=incorreto&hub.challenge=123456'
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('aceita webhook do WhatsApp somente com assinatura HMAC válida', async () => {
    const rawPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '9876543210',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                messages: [
                  {
                    from: '5583999999999',
                    id: 'wamid.test-inbound',
                    timestamp: '1758490000',
                    type: 'text',
                    text: { body: 'Olá' }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    const signature = `sha256=${createHmac('sha256', 'test-whatsapp-app-secret').update(rawPayload).digest('hex')}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/webhook',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
      payload: rawPayload
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });

    expect(await prisma.whatsappWebhookEvent.count()).toBe(1);
    expect(await prisma.whatsappMessage.findUnique({
      where: { providerMessageId: 'wamid.test-inbound' }
    })).toMatchObject({
      direction: 'INBOUND',
      phone: '5583999999999',
      type: 'text',
      text: 'Olá'
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/webhook',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
      payload: rawPayload
    });
    expect(duplicate.statusCode).toBe(200);
    expect(await prisma.whatsappWebhookEvent.count()).toBe(1);
    expect(await prisma.whatsappMessage.count({ where: { providerMessageId: 'wamid.test-inbound' } })).toBe(1);

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/webhook',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` },
      payload: rawPayload
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.json()).toMatchObject({ error: { code: 'WHATSAPP_SIGNATURE_INVALID' } });
  });

  it('protege status administrativo do WhatsApp e não expõe segredos', async () => {
    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/admin/whatsapp/status' });
    expect(unauthorized.statusCode).toBe(401);

    const token = await login();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/whatsapp/status',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      enabled: true,
      graphApiVersion: 'v26.0',
      phoneNumberIdConfigured: true,
      wabaIdConfigured: true,
      accessTokenConfigured: true,
      appSecretConfigured: true,
      verifyTokenConfigured: true
    });
    expect(JSON.stringify(body)).not.toContain('test-whatsapp-access-token');
    expect(JSON.stringify(body)).not.toContain('test-whatsapp-app-secret');
  });

  it('GET /api/v1/menu', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/menu' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { categories: Array<{ products: unknown[] }> };
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.categories.every((category) => Array.isArray(category.products))).toBe(true);
  });

  it('GET /api/v1/products', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/products?page=1&limit=20' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; meta: { total: number; limit: number } };
    expect(body.data).toHaveLength(20);
    expect(body.meta.total).toBe(68);
    expect(body.meta.limit).toBe(20);
  });

  it('GET /api/v1/search é accent-insensitive', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/search?q=agua' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ name: string }> };
    expect(body.data.map((item) => item.name)).toEqual(
      expect.arrayContaining(['Água sem gás', 'Água com gás'])
    );
  });

  it('POST /api/v1/orders calcula o preço no backend e ignora price enviado', async () => {
    const response = await createPickupOrder({ quantity: 2 });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      subtotalInCents: number;
      totalInCents: number;
      items: Array<{ unitPriceInCents: number; subtotalInCents: number }>;
    };
    expect(body.subtotalInCents).toBe(3000);
    expect(body.totalInCents).toBe(3000);
    expect(body.items[0]).toMatchObject({ unitPriceInCents: 1500, subtotalInCents: 3000 });
  });

  it('exige endereço para pedidos de delivery', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'Maria', phone: '83999999999' },
        serviceMode: 'delivery',
        paymentMethod: 'PIX',
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Endereço é obrigatório para delivery' }
    });
  });

  it('permite pedido presencial apenas com nome e forma de pagamento, sem telefone ou mesa', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'Maria' },
        serviceMode: 'dine_in',
        paymentMethod: 'PIX',
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      customer: { name: 'Maria', phone: null },
      serviceMode: 'dine_in',
      paymentMethod: 'PIX',
      address: null
    });
  });

  it('ignora cashChangeFor quando o pagamento é Pix', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'João' },
        serviceMode: 'pickup',
        paymentMethod: 'PIX',
        cashChangeFor: { ignored: true },
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { cashChangeForInCents: number | null }).cashChangeForInCents).toBeNull();
  });

  it('valida troco para Dinheiro contra o total calculado', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'João' },
        serviceMode: 'pickup',
        paymentMethod: 'CASH',
        cashChangeFor: 10,
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejeita produto indisponível', async () => {
    const product = await getProduct('x-burguer');
    await prisma.product.update({ where: { id: product.id }, data: { available: false } });
    const response = await createPickupOrder({ productId: product.id });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'PRODUCT_UNAVAILABLE' } });
  });

  it('rejeita produto inexistente', async () => {
    const response = await createPickupOrder({ productId: randomUUID() });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'PRODUCT_NOT_FOUND' } });
  });

  it('rejeita forma de pagamento inválida', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'João' },
        serviceMode: 'pickup',
        paymentMethod: 'CARD',
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_PAYMENT_METHOD' } });
  });

  it('rejeita modalidade inválida', async () => {
    const product = await getProduct('x-burguer');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        customer: { name: 'João' },
        serviceMode: 'drive_thru',
        paymentMethod: 'PIX',
        items: [{ productId: product.id, quantity: 1 }]
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_SERVICE_MODE' } });
  });

  it('não duplica pedido com a mesma Idempotency-Key', async () => {
    const key = `test-${randomUUID()}`;
    const first = await createPickupOrder({ idempotencyKey: key });
    const second = await createPickupOrder({ idempotencyKey: key });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    const firstBody = first.json() as { id: string };
    const secondBody = second.json() as { id: string };
    expect(secondBody.id).toBe(firstBody.id);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('login válido', async () => {
    const token = await login();
    expect(token.length).toBeGreaterThan(20);
  });

  it('login inválido', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'admin@example.com', password: 'senha-incorreta' }
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('protege rota administrativa sem JWT', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('permite alterar preço e preserva o preço histórico do OrderItem', async () => {
    const product = await getProduct('x-burguer');
    const created = await createPickupOrder({ productId: product.id });
    expect(created.statusCode).toBe(201);
    const orderId = (created.json() as { id: string }).id;
    const token = await login();

    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { priceInCents: 1800 }
    });
    expect(changed.statusCode).toBe(200);

    const publicProduct = await app.inject({ method: 'GET', url: '/api/v1/products/x-burguer' });
    expect((publicProduct.json() as { priceInCents: number }).priceInCents).toBe(1800);

    const historical = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    const historicalBody = historical.json() as { items: Array<{ unitPriceInCents: number }> };
    expect(historicalBody.items[0]?.unitPriceInCents).toBe(1500);
  });
});
