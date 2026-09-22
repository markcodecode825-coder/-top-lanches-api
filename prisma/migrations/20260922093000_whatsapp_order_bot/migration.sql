CREATE TABLE "WhatsappConversation" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'SERVICE_MODE',
    "state" JSONB NOT NULL,
    "lastInboundMessageId" TEXT,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappConversation_phone_key" ON "WhatsappConversation"("phone");
CREATE INDEX "WhatsappConversation_lastInteractionAt_idx" ON "WhatsappConversation"("lastInteractionAt");
