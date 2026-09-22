import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { WhatsAppWebhookSummary } from './service';

function parseProviderTimestamp(value: string): Date | null {
  if (!/^\d+$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function persistWebhookSummary(
  prisma: PrismaClient,
  rawBody: Buffer,
  summary: WhatsAppWebhookSummary
): Promise<{ duplicate: boolean }> {
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.whatsappWebhookEvent.findUnique({ where: { payloadHash } });
      if (existing) return { duplicate: true };

      await tx.whatsappWebhookEvent.create({
        data: {
          payloadHash,
          object: summary.object,
          messageCount: summary.messages.length,
          statusCount: summary.statuses.length
        }
      });

      for (const message of summary.messages) {
        await tx.whatsappMessage.upsert({
          where: { providerMessageId: message.id },
          create: {
            providerMessageId: message.id,
            direction: 'INBOUND',
            phone: message.from,
            type: message.type,
            text: message.text,
            providerTimestamp: parseProviderTimestamp(message.timestamp)
          },
          update: {
            phone: message.from,
            type: message.type,
            text: message.text,
            providerTimestamp: parseProviderTimestamp(message.timestamp)
          }
        });
      }

      for (const status of summary.statuses) {
        const providerTimestamp = parseProviderTimestamp(status.timestamp);
        await tx.whatsappMessage.upsert({
          where: { providerMessageId: status.id },
          create: {
            providerMessageId: status.id,
            direction: 'OUTBOUND',
            phone: status.recipientId,
            type: 'unknown',
            status: status.status,
            providerTimestamp
          },
          update: {
            status: status.status,
            ...(status.recipientId === null ? {} : { phone: status.recipientId }),
            ...(providerTimestamp === null ? {} : { providerTimestamp })
          }
        });
      }

      return { duplicate: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.whatsappWebhookEvent.findUnique({ where: { payloadHash } });
      if (existing) return { duplicate: true };
    }
    throw error;
  }
}

export async function persistOutboundMessage(
  prisma: PrismaClient,
  input: {
    providerMessageId: string | null;
    phone: string;
    type: 'text' | 'template';
    text?: string;
    templateName?: string;
  }
): Promise<void> {
  if (!input.providerMessageId) return;

  await prisma.whatsappMessage.upsert({
    where: { providerMessageId: input.providerMessageId },
    create: {
      providerMessageId: input.providerMessageId,
      direction: 'OUTBOUND',
      phone: input.phone,
      type: input.type,
      text: input.text ?? null,
      templateName: input.templateName ?? null
    },
    update: {
      phone: input.phone,
      type: input.type,
      text: input.text ?? null,
      templateName: input.templateName ?? null
    }
  });
}
