CREATE TABLE "Note" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "username" TEXT,
  "secret" TEXT,
  "url" TEXT,
  "content" TEXT,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Note_studioId_isPinned_createdAt_idx" ON "Note"("studioId", "isPinned", "createdAt");
CREATE INDEX "Note_studioId_category_idx" ON "Note"("studioId", "category");
CREATE INDEX "Note_studioId_createdAt_idx" ON "Note"("studioId", "createdAt");
CREATE INDEX "Note_studioId_updatedAt_idx" ON "Note"("studioId", "updatedAt");
CREATE INDEX "Note_studioId_deletedAt_idx" ON "Note"("studioId", "deletedAt");

ALTER TABLE "Note"
  ADD CONSTRAINT "Note_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
