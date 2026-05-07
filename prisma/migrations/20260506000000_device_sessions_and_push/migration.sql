ALTER TABLE "RefreshToken"
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "lastUsedAt" TIMESTAMP(3);

CREATE INDEX "RefreshToken_userId_lastUsedAt_idx" ON "RefreshToken"("userId", "lastUsedAt");

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_studioId_idx" ON "PushSubscription"("studioId");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
