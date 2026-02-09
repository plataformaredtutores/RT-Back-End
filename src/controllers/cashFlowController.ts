import prisma from "../lib/prisma"
import { Request, Response, NextFunction } from "express"
import { UserRole, PaymentStatus } from "@prisma/client"

export async function getCashFlowSummary(req: Request, res: Response, next: NextFunction){
    const role = (req as any).auth.role as UserRole

    const {
        startDate,
        endDate
    } = req.query

    if (role === UserRole.admin){
        const { institutionId } = req.query

        const payments = await prisma.classPayment.groupBy({
            by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
            _sum: {
                guardianAmount: true,
                tutorAmount: true
            },
            where: {
                Class: {
                    institutionId: institutionId ? Number(institutionId) : undefined,
                    date: {
                        gte: startDate ? new Date(startDate as string) : undefined,
                        lte: endDate ? new Date(endDate as string) : undefined
                    }
                }
            }
        })

        let ammountToReceive = 0
        let amountReceived = 0
        let amountToPay = 0
        let amountPaid = 0

        payments.forEach(payment => {
            if (payment.guardianPaymentStatus === PaymentStatus.pending) {
                ammountToReceive += payment._sum.guardianAmount || 0
            } else if (payment.guardianPaymentStatus === PaymentStatus.completed) {
                amountReceived += payment._sum.guardianAmount || 0
            }

            if (payment.tutorPaymentStatus === PaymentStatus.pending) {
                amountToPay += payment._sum.tutorAmount || 0
            } else if (payment.tutorPaymentStatus === PaymentStatus.completed) {
                amountPaid += payment._sum.tutorAmount || 0
            }
        })

        const share = 0.4

        return res.json({
            ammountToReceive,
            amountReceived,
            amountToPay,
            amountPaid,
            share
        })
   
    } else if (role === UserRole.coordinator){
        const institutionId = (req as any).auth.institutionId
        const payments = await prisma.classPayment.groupBy({
            by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
            _sum: {
                guardianAmount: true,
                tutorAmount: true
            },
            where: {
                Class: {
                    institutionId: institutionId,
                    date: {
                        gte: startDate ? new Date(startDate as string) : undefined,
                        lte: endDate ? new Date(endDate as string) : undefined
                    }
                }
            }
        })

        let ammountToReceive = 0
        let amountReceived = 0
        let amountToPay = 0
        let amountPaid = 0

        payments.forEach(payment => {
            if (payment.guardianPaymentStatus === PaymentStatus.pending) {
                ammountToReceive += payment._sum.guardianAmount || 0
            } else if (payment.guardianPaymentStatus === PaymentStatus.completed) {
                amountReceived += payment._sum.guardianAmount || 0
            }

            if (payment.tutorPaymentStatus === PaymentStatus.pending) {
                amountToPay += payment._sum.tutorAmount || 0
            } else if (payment.tutorPaymentStatus === PaymentStatus.completed) {
                amountPaid += payment._sum.tutorAmount || 0
            }
        })

        const share = prisma.coordinatorProfitShare.findFirst({
            where: {
                institutionId: institutionId,
                coordinatorId: (req as any).auth.userId
            }, select: {
                profitShare: true
            }
        })

        return res.json({
            ammountToReceive,
            amountReceived,
            amountToPay,
            amountPaid,
            share
        })
    } else {
        return res.status(403).json({ message: "Forbidden" })
    }
}