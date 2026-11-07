-- Additive repair for databases deployed before order voucher support.
-- Existing orders retain NULL; no order or financial data is changed.
ALTER TABLE "BusinessOrder" ADD COLUMN IF NOT EXISTS "voucherCode" TEXT;
