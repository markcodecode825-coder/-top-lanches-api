CREATE TABLE "WhatsappConversation" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "lastMessageId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappConversation_phone_key" ON "WhatsappConversation"("phone");
CREATE INDEX "WhatsappConversation_expiresAt_idx" ON "WhatsappConversation"("expiresAt");
CREATE INDEX "WhatsappConversation_updatedAt_idx" ON "WhatsappConversation"("updatedAt");
