-- AlterTable
ALTER TABLE "public"."AdminPayment" ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "public"."CoordinatorPayment" ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending';
