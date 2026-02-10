import prisma from "../lib/prisma"
import { Request, Response, NextFunction } from "express"
import { UserRole, PaymentStatus } from "@prisma/client"
import { start } from "repl"

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

export async function getCashFlowDetails(req: Request, res: Response, next: NextFunction){
    const {
        institutionId,
        startDate,
        endDate,
        paymentStatus,
        userRole,
        page,
        pageSize
    } = req.query

    /*
    const role = (req as any).auth.role as UserRole
    const userId = (req as any).auth.uid as number

    if (role !== UserRole.admin && role !== UserRole.coordinator) {
        return res.status(403).json({ message: "Forbidden" })
    }
    */

    if (userRole === 'admin' || userRole === 'coordinator') {
        // For this case, we return the payments status related to the admins 
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "startDate and endDate are required for admin role" })
        }
        const s = new Date(startDate as string)
        const e = new Date(endDate as string)

        if (s.getUTCDate() !== 1 || e.toISOString().split('T')[0] !== new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)).toISOString().split('T')[0]) {
            return res.status(400).json({ message: "startDate and endDate must match an entire single month (e.g. 1st to 30th/31st)" })
        }

        // Ensure e covers the entire end day (23:59:59.999) so we include records from the last day
        e.setUTCHours(23, 59, 59, 999)

        if (userRole === 'admin') {
            const adminPayment = await prisma.adminPayment.findFirst({
                where: {
                    periodMonth: s.getUTCMonth() + 1,
                    periodYear: s.getUTCFullYear(),
                }
            })
            const userId = (req as any).auth.userId as number
            const admin = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    institutionId: true
                }
            })
            return {
                id: admin?.id,
                name: admin?.name,
                email: admin?.email,
                paymentStatus: adminPayment ? adminPayment?.status : PaymentStatus.pending,
            } 
        } else if (userRole === 'coordinator') {
            const coordinatorsData = await prisma.user.findMany({
                where: {
                    institutionId: institutionId ? Number(institutionId) : undefined,
                    role: UserRole.coordinator
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    institutionId: true,
                    coordinatorProfitShares: {
                        where: {
                            createdAt: {
                                lte: e
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        },
                        select: {
                            profitShare: true
                        },
                    },
                    coordinatorPayments: {
                        where: {
                            periodMonth: s.getUTCMonth() + 1,
                            periodYear: s.getUTCFullYear(),
                        },
                        select: {
                            status: true
                        }
                    }
                },
                skip: page && pageSize ? (Number(page) - 1) * Number(pageSize) : undefined,
                take: pageSize ? Number(pageSize) : undefined
            })

            const cordinators = coordinatorsData.map(coordinator => {
                const { coordinatorProfitShares, coordinatorPayments, ...rest } = coordinator
                return {
                    ...rest,
                    profitShare: coordinatorProfitShares[0]?.profitShare ? coordinatorProfitShares[0].profitShare : 0,
                    paymentStatus: coordinatorPayments[0]?.status ? coordinatorPayments[0].status : PaymentStatus.pending
                }
            })
            
            return res.json(cordinators)
        }

        return res.json({ message: "Not implemented yet" })
    }
    else {
        return res.status(403).json({ message: "Forbidden" })
    }

}