/*
  Warnings:

  - Added the required column `accountEmail` to the `UserBankAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."UserBankAccount" ADD COLUMN     "accountEmail" TEXT NOT NULL;
