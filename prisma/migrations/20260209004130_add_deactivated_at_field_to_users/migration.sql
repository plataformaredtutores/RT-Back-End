-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_isActive_deactivatedAt_idx" ON "public"."User"("isActive", "deactivatedAt");
