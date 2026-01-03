/*
  Warnings:

  - You are about to alter the column `profitShare` on the `CoordinatorProfitShare` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,3)` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "public"."CoordinatorProfitShare" ALTER COLUMN "profitShare" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."Institution" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
