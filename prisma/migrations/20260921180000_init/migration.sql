CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $func$
  SELECT public.unaccent($1);
$func$;

CREATE TYPE "ServiceModeCode" AS ENUM ('delivery', 'pickup', 'dine_in');
CREATE TYPE "PaymentMethodCode" AS ENUM ('PIX', 'CASH');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED');

CREATE TABLE "Admin" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Business" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "whatsappFormatted" TEXT NOT NULL,
  "instagram" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperatingHour" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "open" TEXT NOT NULL,
  "close" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatingHour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceMode" (
  "id" UUID NOT NULL,
  "code" "ServiceModeCode" NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceMode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentMethod" (
  "id" UUID NOT NULL,
  "code" "PaymentMethodCode" NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "bannerUrl" TEXT,
  "searchTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "categoryId" UUID NOT NULL,
  "description" TEXT,
  "priceInCents" INTEGER NOT NULL,
  "promotionalPriceInCents" INTEGER,
  "imageUrl" TEXT,
  "volume" TEXT,
  "unit" TEXT,
  "searchTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "available" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
  "id" UUID NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  "serviceMode" "ServiceModeCode" NOT NULL,
  "paymentMethod" "PaymentMethodCode" NOT NULL,
  "cashChangeForInCents" INTEGER,
  "notes" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "subtotalInCents" INTEGER NOT NULL,
  "deliveryFeeInCents" INTEGER,
  "totalInCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "productName" TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceInCents" INTEGER NOT NULL,
  "subtotalInCents" INTEGER NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderAddress" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "neighborhood" TEXT NOT NULL,
  "reference" TEXT,
  CONSTRAINT "OrderAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Setting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "OrderCounter" (
  "id" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX "ServiceMode_code_key" ON "ServiceMode"("code");
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE UNIQUE INDEX "OrderAddress_orderId_key" ON "OrderAddress"("orderId");

CREATE INDEX "OperatingHour_businessId_dayOfWeek_priority_idx" ON "OperatingHour"("businessId", "dayOfWeek", "priority");
CREATE INDEX "Category_active_priority_name_idx" ON "Category"("active", "priority", "name");
CREATE INDEX "Category_priority_idx" ON "Category"("priority");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_available_idx" ON "Product"("available");
CREATE INDEX "Product_active_available_idx" ON "Product"("active", "available");
CREATE INDEX "Product_priority_idx" ON "Product"("priority");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_serviceMode_idx" ON "Order"("serviceMode");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "Category_name_trgm_idx" ON "Category" USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);

ALTER TABLE "OperatingHour" ADD CONSTRAINT "OperatingHour_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperatingHour" ADD CONSTRAINT "OperatingHour_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 7);
ALTER TABLE "Product" ADD CONSTRAINT "Product_priceInCents_check" CHECK ("priceInCents" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_promotionalPriceInCents_check" CHECK ("promotionalPriceInCents" IS NULL OR "promotionalPriceInCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPriceInCents_check" CHECK ("unitPriceInCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subtotalInCents_check" CHECK ("subtotalInCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_subtotalInCents_check" CHECK ("subtotalInCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalInCents_check" CHECK ("totalInCents" >= 0);
