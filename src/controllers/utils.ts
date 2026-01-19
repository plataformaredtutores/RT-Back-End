import { Fee } from "@prisma/client"
export function calculateFeeAmount(
  fee: Fee,
  duration: number
) {
  return {
    guardianAmount: fee.guardianAmount * Number(duration)/60,
    tutorAmount: fee.tutorAmount * Number(duration)/60
  };
}