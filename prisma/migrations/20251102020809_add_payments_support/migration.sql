/*
  Warnings:

  - You are about to drop the column `paymentStatus` on the `ClassPayment` table. All the data in the column will be lost.
  - Added the required column `amount` to the `CoordinatorPayment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('card', 'bankTransfer');

-- AlterTable
ALTER TABLE "public"."ClassPayment" DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentFromParent" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "paymentToTutor" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "paymentType" "public"."PaymentType" NOT NULL DEFAULT 'bankTransfer';

-- AlterTable
ALTER TABLE "public"."CoordinatorPayment" ADD COLUMN     "amount" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."AdminPayment" (
    "id" SERIAL NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPayment_pkey" PRIMARY KEY ("id")
);
