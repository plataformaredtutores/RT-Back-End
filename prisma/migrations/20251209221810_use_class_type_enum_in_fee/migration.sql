/*
  Warnings:

  - Changed the type of `type` on the `Fee` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Fee" DROP COLUMN "type",
ADD COLUMN     "type" "public"."ClassType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Fee_type_classModality_numberOfStudents_institutionId_key" ON "public"."Fee"("type", "classModality", "numberOfStudents", "institutionId");
