-- Additive upgrade. Old vouchers stay unconfigured until the owner edits them.
BEGIN;
ALTER TABLE "BusinessVoucher"
  ADD COLUMN IF NOT EXISTS "benefitType" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "benefitValue" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "benefitText" TEXT;
ALTER TABLE "BusinessOrder" ADD COLUMN IF NOT EXISTS "voucherBenefit" TEXT;
COMMIT;
