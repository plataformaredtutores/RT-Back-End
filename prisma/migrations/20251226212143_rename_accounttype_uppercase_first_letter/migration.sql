/*
  Warnings:

  - The values [AHORRO,CORRIENTE,VISTA] on the enum `AccountType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AccountType_new" AS ENUM ('Ahorro', 'Corriente', 'Vista');
ALTER TABLE "public"."UserBankAccount" ALTER COLUMN "accountType" TYPE "public"."AccountType_new" USING ("accountType"::text::"public"."AccountType_new");
ALTER TYPE "public"."AccountType" RENAME TO "AccountType_old";
ALTER TYPE "public"."AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;
