CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "WhatsappWebhookEvent" (
  "id" UUID NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "object" TEXT,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "statusCount" INTEGER NOT NULL DEFAULT 0,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsappMessage" (
  "id" UUID NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "direction" "WhatsappMessageDirection" NOT NULL,
  "phone" TEXT,
  "type" TEXT NOT NULL,
  "text" TEXT,
  "templateName" TEXT,
  "status" TEXT,
  "providerTimestamp" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappWebhookEvent_payloadHash_key" ON "WhatsappWebhookEvent"("payloadHash");
CREATE INDEX "WhatsappWebhookEvent_receivedAt_idx" ON "WhatsappWebhookEvent"("receivedAt");
CREATE UNIQUE INDEX "WhatsappMessage_providerMessageId_key" ON "WhatsappMessage"("providerMessageId");
CREATE INDEX "WhatsappMessage_direction_createdAt_idx" ON "WhatsappMessage"("direction", "createdAt");
CREATE INDEX "WhatsappMessage_phone_createdAt_idx" ON "WhatsappMessage"("phone", "createdAt");
CREATE INDEX "WhatsappMessage_status_idx" ON "WhatsappMessage"("status");
