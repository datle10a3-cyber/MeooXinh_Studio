ALTER TABLE "RefreshToken" ADD COLUMN "deviceKey" TEXT;

CREATE INDEX "RefreshToken_userId_deviceKey_idx" ON "RefreshToken"("userId", "deviceKey");
