/*
  Warnings:

  - The values [cancelled] on the enum `ClassModality` will be removed. If these variants are still used in the database, this will fail.
  - The values [schoolar,universitary] on the enum `ClassType` will be removed. If these variants are still used in the database, this will fail.
  - The values [parent] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `studentNumber` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the column `feeId` on the `ClassPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentFromParent` on the `ClassPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentToTutor` on the `ClassPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentType` on the `ClassPayment` table. All the data in the column will be lost.
  - You are about to drop the column `amountToCharge` on the `Fee` table. All the data in the column will be lost.
  - You are about to drop the column `amountToPay` on the `Fee` table. All the data in the column will be lost.
  - You are about to drop the column `studentNumber` on the `Fee` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `rutHolder` on the `UserBankAccount` table. All the data in the column will be lost.
  - You are about to drop the `ParentTutor` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[periodYear,periodMonth]` on the table `AdminPayment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classId]` on the table `ClassPayment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,classModality,numberOfStudents,institutionId]` on the table `Fee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Institution` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `numberOfStudents` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `subject` on the `Class` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `guardianAmount` to the `ClassPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tutorAmount` to the `ClassPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coordinatorId` to the `CoordinatorPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guardianId` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Made the column `rut` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."ClassSubject" AS ENUM ('biology', 'chemistry', 'physics', 'mathematics', 'spanish', 'french', 'english', 'pet', 'socialStudies', 'studySkills', 'other');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ClassModality_new" AS ENUM ('inPerson', 'online');
ALTER TABLE "public"."Class" ALTER COLUMN "modality" TYPE "public"."ClassModality_new" USING ("modality"::text::"public"."ClassModality_new");
ALTER TABLE "public"."Fee" ALTER COLUMN "classModality" TYPE "public"."ClassModality_new" USING ("classModality"::text::"public"."ClassModality_new");
ALTER TYPE "public"."ClassModality" RENAME TO "ClassModality_old";
ALTER TYPE "public"."ClassModality_new" RENAME TO "ClassModality";
DROP TYPE "public"."ClassModality_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ClassType_new" AS ENUM ('school', 'university', 'cancelled');
ALTER TABLE "public"."Class" ALTER COLUMN "type" TYPE "public"."ClassType_new" USING ("type"::text::"public"."ClassType_new");
ALTER TYPE "public"."ClassType" RENAME TO "ClassType_old";
ALTER TYPE "public"."ClassType_new" RENAME TO "ClassType";
DROP TYPE "public"."ClassType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."UserRole_new" AS ENUM ('admin', 'coordinator', 'guardian', 'tutor');
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."UserRole_new" USING ("role"::text::"public"."UserRole_new");
ALTER TYPE "public"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."ClassPayment" DROP CONSTRAINT "ClassPayment_feeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParentTutor" DROP CONSTRAINT "ParentTutor_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParentTutor" DROP CONSTRAINT "ParentTutor_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParentTutor" DROP CONSTRAINT "ParentTutor_tutorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_parentId_fkey";

-- DropIndex
DROP INDEX "public"."Student_parentId_idx";

-- DropIndex
DROP INDEX "public"."User_rut_key";

-- DropIndex
DROP INDEX "public"."UserBankAccount_userId_accountNumber_key";

-- AlterTable
ALTER TABLE "public"."Class" DROP COLUMN "studentNumber",
ADD COLUMN     "numberOfStudents" INTEGER NOT NULL,
DROP COLUMN "subject",
ADD COLUMN     "subject" "public"."ClassSubject" NOT NULL;

-- AlterTable
ALTER TABLE "public"."ClassPayment" DROP COLUMN "feeId",
DROP COLUMN "paymentFromParent",
DROP COLUMN "paymentToTutor",
DROP COLUMN "paymentType",
ADD COLUMN     "guardianAmount" INTEGER NOT NULL,
ADD COLUMN     "guardianPaymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "guardianPaymentType" "public"."PaymentType" NOT NULL DEFAULT 'bankTransfer',
ADD COLUMN     "tutorAmount" INTEGER NOT NULL,
ADD COLUMN     "tutorPaymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "public"."CoordinatorPayment" ADD COLUMN     "coordinatorId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Fee" DROP COLUMN "amountToCharge",
DROP COLUMN "amountToPay",
DROP COLUMN "studentNumber",
ADD COLUMN     "guardianAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "numberOfStudents" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tutorAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Student" DROP COLUMN "parentId",
ADD COLUMN     "guardianId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "rut" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."UserBankAccount" DROP COLUMN "rutHolder",
ADD COLUMN     "rut" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "public"."ParentTutor";

-- CreateTable
CREATE TABLE "public"."CoordinatorProfitShare" (
    "id" SERIAL NOT NULL,
    "coordinatorId" INTEGER NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "profitShare" DECIMAL(5,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoordinatorProfitShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardianTutor" (
    "guardianId" INTEGER NOT NULL,
    "tutorId" INTEGER NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianTutor_pkey" PRIMARY KEY ("guardianId","tutorId","institutionId")
);

-- CreateIndex
CREATE INDEX "CoordinatorProfitShare_institutionId_idx" ON "public"."CoordinatorProfitShare"("institutionId");

-- CreateIndex
CREATE INDEX "CoordinatorProfitShare_coordinatorId_idx" ON "public"."CoordinatorProfitShare"("coordinatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatorProfitShare_coordinatorId_institutionId_key" ON "public"."CoordinatorProfitShare"("coordinatorId", "institutionId");

-- CreateIndex
CREATE INDEX "GuardianTutor_tutorId_idx" ON "public"."GuardianTutor"("tutorId");

-- CreateIndex
CREATE INDEX "GuardianTutor_institutionId_idx" ON "public"."GuardianTutor"("institutionId");

-- CreateIndex
CREATE INDEX "GuardianTutor_guardianId_idx" ON "public"."GuardianTutor"("guardianId");

-- CreateIndex
CREATE INDEX "AdminPayment_periodYear_periodMonth_idx" ON "public"."AdminPayment"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPayment_periodYear_periodMonth_key" ON "public"."AdminPayment"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "ClassPayment_createdAt_idx" ON "public"."ClassPayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPayment_classId_key" ON "public"."ClassPayment"("classId");

-- CreateIndex
CREATE INDEX "CoordinatorPayment_periodYear_periodMonth_idx" ON "public"."CoordinatorPayment"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Fee_institutionId_idx" ON "public"."Fee"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Fee_type_classModality_numberOfStudents_institutionId_key" ON "public"."Fee"("type", "classModality", "numberOfStudents", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_name_key" ON "public"."Institution"("name");

-- CreateIndex
CREATE INDEX "Student_guardianId_idx" ON "public"."Student"("guardianId");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "public"."User"("institutionId");

-- CreateIndex
CREATE INDEX "User_institutionId_role_idx" ON "public"."User"("institutionId", "role");

-- AddForeignKey
ALTER TABLE "public"."CoordinatorPayment" ADD CONSTRAINT "CoordinatorPayment_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoordinatorProfitShare" ADD CONSTRAINT "CoordinatorProfitShare_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoordinatorProfitShare" ADD CONSTRAINT "CoordinatorProfitShare_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardianTutor" ADD CONSTRAINT "GuardianTutor_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardianTutor" ADD CONSTRAINT "GuardianTutor_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardianTutor" ADD CONSTRAINT "GuardianTutor_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
