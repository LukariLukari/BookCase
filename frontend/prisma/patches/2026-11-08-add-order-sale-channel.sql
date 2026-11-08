-- Preserve existing orders; legacy rows are classified from their products on read.
ALTER TABLE "BusinessOrder" ADD COLUMN IF NOT EXISTS "saleChannel" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "BusinessOrderItem" ADD COLUMN IF NOT EXISTS "note" TEXT;
