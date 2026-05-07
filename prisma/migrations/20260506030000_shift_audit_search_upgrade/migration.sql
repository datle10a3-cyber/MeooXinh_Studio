-- Professional shift ledger and long-term finance indexes.
ALTER TABLE "WalletShift" ADD COLUMN "code" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "walletShiftId" TEXT;

CREATE UNIQUE INDEX "WalletShift_studioId_code_key" ON "WalletShift"("studioId", "code");
CREATE INDEX "WalletShift_studioId_status_openedAt_idx" ON "WalletShift"("studioId", "status", "openedAt");
CREATE INDEX "WalletShift_openedById_idx" ON "WalletShift"("openedById");
CREATE INDEX "WalletShift_closedById_idx" ON "WalletShift"("closedById");
CREATE INDEX "Transaction_studioId_walletShiftId_occurredAt_idx" ON "Transaction"("studioId", "walletShiftId", "occurredAt");

ALTER TABLE "WalletShift" ADD CONSTRAINT "WalletShift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletShift" ADD CONSTRAINT "WalletShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletShiftId_fkey" FOREIGN KEY ("walletShiftId") REFERENCES "WalletShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill readable codes for existing closed/open shifts.
WITH numbered AS (
  SELECT
    id,
    "studioId",
    'CA-' || to_char("openedAt", 'YYYYMMDD') || '-' ||
    lpad(row_number() OVER (PARTITION BY "studioId", date_trunc('day', "openedAt") ORDER BY "openedAt", id)::text, 3, '0') AS next_code
  FROM "WalletShift"
  WHERE code IS NULL
)
UPDATE "WalletShift" ws
SET code = numbered.next_code
FROM numbered
WHERE ws.id = numbered.id;
