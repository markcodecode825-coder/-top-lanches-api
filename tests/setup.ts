import { beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma';

beforeEach(async () => {
  await prisma.whatsappConversation.deleteMany();
  await prisma.whatsappMessage.deleteMany();
  await prisma.whatsappWebhookEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderCounter.upsert({
    where: { id: 'orders' },
    update: { value: 0 },
    create: { id: 'orders', value: 0 }
  });
  await prisma.setting.upsert({
    where: { key: 'acceptOrdersWhenClosed' },
    update: { value: true },
    create: { key: 'acceptOrdersWhenClosed', value: true }
  });
  await prisma.category.updateMany({ data: { active: true } });
  await prisma.product.updateMany({ data: { active: true, available: true, promotionalPriceInCents: null } });
  await prisma.product.update({ where: { slug: 'x-burguer' }, data: { priceInCents: 1500 } });
});
