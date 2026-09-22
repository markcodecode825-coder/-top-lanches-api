import type { PrismaClient } from '@prisma/client';
import { ACCEPT_ORDERS_WHEN_CLOSED_KEY } from '../../config/constants';

export async function getSettings(prisma: PrismaClient) {
  const acceptOrdersWhenClosed = await prisma.setting.findUnique({
    where: { key: ACCEPT_ORDERS_WHEN_CLOSED_KEY }
  });
  return {
    acceptOrdersWhenClosed: acceptOrdersWhenClosed?.value === true
  };
}
