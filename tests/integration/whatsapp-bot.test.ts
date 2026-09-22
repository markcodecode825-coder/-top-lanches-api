import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import {
  createTestBotMessage,
  processWhatsAppOrderBotMessage
} from '../../src/modules/whatsapp/bot';
import type { WhatsAppSendResult } from '../../src/modules/whatsapp/service';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('WhatsApp order bot', () => {
  it('cria um pedido de retirada completo sem pedir mesa ou endereço', async () => {
    const phone = '5583999112233';
    const replies: string[] = [];
    let outboundCounter = 0;

    const sender = async (to: string, text: string): Promise<WhatsAppSendResult> => {
      outboundCounter += 1;
      replies.push(text);
      return {
        messageId: `wamid.bot-out-${outboundCounter}`,
        recipientWaId: to
      };
    };

    const inbound = async (text: string, index: number) => {
      await processWhatsAppOrderBotMessage(
        app,
        createTestBotMessage(phone, text, `wamid.bot-in-${index}`),
        sender
      );
    };

    await inbound('Oi', 1);
    await inbound('2', 2);
    await inbound('Hambúrguer', 3);
    await inbound('X-Burguer', 4);
    await inbound('1', 5);
    await inbound('2', 6);
    await inbound('1', 7);
    await inbound('João', 8);
    await inbound('1', 9);

    const order = await prisma.order.findFirst({
      where: { customerPhone: phone },
      include: { items: true, address: true },
      orderBy: { createdAt: 'desc' }
    });

    expect(order).not.toBeNull();
    expect(order).toMatchObject({
      customerName: 'João',
      customerPhone: phone,
      serviceMode: 'pickup',
      paymentMethod: 'PIX',
      totalInCents: 1500,
      address: null
    });
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({
      productName: 'X-Burguer',
      quantity: 1,
      unitPriceInCents: 1500
    });
    expect(replies.at(-1)).toContain(`Pedido ${order?.orderNumber} confirmado.`);
    expect(await prisma.whatsappConversation.findUnique({ where: { phone } })).toBeNull();
  });

  it('exige endereço na API para pedidos de delivery', async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { slug: 'x-burguer' } });
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
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Endereço é obrigatório para delivery'
      }
    });
  });
});
