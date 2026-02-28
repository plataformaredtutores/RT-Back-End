import prisma from "../lib/prisma"
import { Request, Response, NextFunction } from "express"
import { UserRole, PaymentStatus } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

function parseMonthYear(value: unknown) {
    if (typeof value !== 'string') return null
    const match = value.trim().match(/^(0[1-9]|1[0-2])-(\d{4})$/)
    if (!match) return null
    const month = Number(match[1])
    const year = Number(match[2])
    return { month, year }
}

export async function getCashFlowSummary(req: Request, res: Response, next: NextFunction){
    const {
        startDate,
        endDate,
    } = req.query
    const role = (req as any).auth.role as UserRole

    // startDate and endDate must be provided as MM-YYYY; we normalize them to month boundaries.
    if (!startDate || !endDate) {
        return res.status(400).json({ ok: false, message: 'Start date and end date are required' })
    }

    const startParsed = parseMonthYear(startDate)
    const endParsed = parseMonthYear(endDate)
    if (!startParsed || !endParsed) {
        return res.status(400).json({ ok: false, message: 'Invalid date format, expected MM-YYYY' })
    }

    const start = new Date(Date.UTC(startParsed.year, startParsed.month - 1, 1))
    const end = new Date(Date.UTC(endParsed.year, endParsed.month, 0, 23, 59, 59, 999))

    if (role === 'admin') {
        const institutionId = req.query.institutionId ? Number(req.query.institutionId) : undefined
        const adminPayments = await prisma.adminPayment.findMany({
            where: {
                period: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                amount: true,
                status: true,
                period: true
            }
        })

        // The previous query returns payments for the past periods that are completed, so, the pending
        // payments are the ones of the current period, but, we also need to check if there is a month
        // between the start and end date that has no payment record. If is it not the case, 
        // we need to calculate every month that has no record.

        // For example, in the database we have the records
        // | id | period     | amount | status    |
        // |----|------------|--------|-----------|
        // | 1  | 2025-11-01 | 250000 | completed |
        // | 2  | 2026-01-01 | 310000 | completed |

        // Today is 2026-02-12, so, if we query from 2025-10-01 to Today, we have the following pending months to calculate:
        // - 2025-10-01 to 2025-10-31 (no record)
        // - 2025-12-01 to 2025-12-31 (no record)
        // - 2026-02-01 to 2026-02-28 (current month, no record)

        // The records from the database are already calculated, so, we we only have to calculate the pending months, one by one.

        const existingPeriods = new Set(
            adminPayments.map((p) => {
                return `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`
            })
        )

        const pendingMonths = []
        const currentIter = new Date(start) 

        while (currentIter <= end) {
            const currentYear = currentIter.getUTCFullYear()
            const currentMonth = currentIter.getUTCMonth()
            const periodKey = `${currentYear}-${currentMonth}`

            if (!existingPeriods.has(periodKey)) {
                const monthStart = new Date(currentIter)
                
                const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999))

                pendingMonths.push({
                    start: monthStart,
                    end: monthEnd
                })
            }

            currentIter.setUTCMonth(currentIter.getUTCMonth() + 1)
        }

        const adminShares = await prisma.adminProfitShare.findMany({
            where: {
                availableSince: {
                    lte: end
                },
                availableUntil: {
                    gte: start
                }
            },
            orderBy: {
                availableSince: 'asc'
            }
        })

        console.log('[CashFlow] AdminProfitShares used for calculation:', JSON.stringify(adminShares, null, 2))

        for (const month of pendingMonths) {
            const monthStart = month.start
            const monthEnd = month.end

            let amount = 0

            // At this point, we can have multiple adminShare, for example, in the relation AdminProfitShare, we have 
            // | id | profitShare | availableSince | availableUntil 
            // |----|-------------|----------------|----------------|
            // | 1  | 40          | 2026-01-12     | 2300-01-01     |
            // | 2  | 20          | 2025-12-12     | 2026-01-12     |
            // | 3  | 30          | 2020-02-12     | 2025-12-12     |

            // As we can see, the share for december 2025, that is a pending month, is 20% from the begin of december 
            // to 12 of december, and 30% from 12 of december to the end of december. 

            // For this case (and other with multiple shares in the same month), we need to calculate the share for each period and then sum the results.
            const adminSharesForTheMonth = adminShares.filter((s) => {
                return (s.availableSince <= monthEnd) && (s.availableUntil >= monthStart)
            })
            const periodForEachShare = adminSharesForTheMonth.map((s) => {
                const shareStart = s.availableSince > monthStart ? s.availableSince : monthStart
                const shareEnd = s.availableUntil < monthEnd ? s.availableUntil : monthEnd
                return {
                    shareStart,
                    shareEnd,
                }
            })

            for (const [index, period] of periodForEachShare.entries()) {
                const share = adminSharesForTheMonth[index].profitShare as Decimal
                // Here we can calculate the amount to receive and pay for the month, using the share and the total amount of the month, that is calculated using the class payments.
                const guardianPayments = await prisma.classPayment.aggregate({
                    _sum: {
                        guardianAmount: true
                    },
                    where: {
                        Class: {
                            institutionId,
                            date: {
                                gte: new Date(period.shareStart),
                                lte: new Date(period.shareEnd)
                            }
                        },
                    }
                })

                const tutorPayments = await prisma.classPayment.aggregate({
                    _sum: {
                        tutorAmount: true
                    },
                    where: {
                        Class: {
                            institutionId,
                            date: {
                                gte: new Date(period.shareStart),
                                lte: new Date(period.shareEnd)
                            }
                        },
                    }
                })

                amount += (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) - (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
            }

            adminPayments.push({
                amount,
                status: 'pending' as PaymentStatus,
                period: monthStart
            })
        }

        if (institutionId) {
            const adminPaymentsByInstitution = [] as Array<{
                amount: number
                status: PaymentStatus
                period: Date
            }>

            const currentIterAll = new Date(start)
            while (currentIterAll <= end) {
                const currentYear = currentIterAll.getUTCFullYear()
                const currentMonth = currentIterAll.getUTCMonth()
                const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1))
                const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999))

                let amount = 0
                const adminSharesForTheMonth = adminShares.filter((s) => {
                    return (s.availableSince <= monthEnd) && (s.availableUntil >= monthStart)
                })
                const periodForEachShare = adminSharesForTheMonth.map((s) => {
                    const shareStart = s.availableSince > monthStart ? s.availableSince : monthStart
                    const shareEnd = s.availableUntil < monthEnd ? s.availableUntil : monthEnd
                    return { shareStart, shareEnd }
                })

                for (const [index, period] of periodForEachShare.entries()) {
                    const share = adminSharesForTheMonth[index].profitShare as Decimal
                    const guardianPayments = await prisma.classPayment.aggregate({
                        _sum: { guardianAmount: true },
                        where: {
                            Class: {
                                institutionId,
                                date: {
                                    gte: new Date(period.shareStart),
                                    lte: new Date(period.shareEnd)
                                }
                            }
                        }
                    })

                    const tutorPayments = await prisma.classPayment.aggregate({
                        _sum: { tutorAmount: true },
                        where: {
                            Class: {
                                institutionId,
                                date: {
                                    gte: new Date(period.shareStart),
                                    lte: new Date(period.shareEnd)
                                }
                            }
                        }
                    })

                    amount += (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100)
                    amount -= (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
                }

                adminPaymentsByInstitution.push({
                    amount,
                    status: 'pending' as PaymentStatus,
                    period: monthStart
                })

                currentIterAll.setUTCMonth(currentIterAll.getUTCMonth() + 1)
            }

            const payments = await prisma.classPayment.groupBy({
                by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
                _sum: {
                    guardianAmount: true,
                    tutorAmount: true
                },
                where: {
                    Class: {
                        institutionId,
                        date: {
                            gte: start,
                            lte: end
                        }
                    }
                }
            })

            let amountToReceive = 0
            let amountReceived = 0
            let amountToPay = 0
            let amountPaid = 0

            payments.forEach(payment => {
                if (payment.guardianPaymentStatus === PaymentStatus.pending) {
                    amountToReceive += payment._sum.guardianAmount || 0
                } else if (payment.guardianPaymentStatus === PaymentStatus.completed) {
                    amountReceived += payment._sum.guardianAmount || 0
                }

                if (payment.tutorPaymentStatus === PaymentStatus.pending) {
                    amountToPay += payment._sum.tutorAmount || 0
                } else if (payment.tutorPaymentStatus === PaymentStatus.completed) {
                    amountPaid += payment._sum.tutorAmount || 0
                }
            })

            const adminAmountToReceive = adminPaymentsByInstitution.reduce((acc, payment) => acc + payment.amount, 0)

            const response = {
                adminPayments: adminPaymentsByInstitution,
                amountToReceive,
                amountReceived,
                amountToPay,
                amountPaid,
                adminAmountToReceive,
                adminAmountReceived: 0
            }
            console.log('[CashFlow Summary - Admin (institution)]', JSON.stringify(response, null, 2))
            return res.json(response)
        }

        // Finally, we can sum the amounts for each month and return the result.

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
                        gte: start,
                        lte: end
                    }
                }
            }
        })

        let amountToReceive = 0
        let amountReceived = 0
        let amountToPay = 0
        let amountPaid = 0

        payments.forEach(payment => {
            if (payment.guardianPaymentStatus === PaymentStatus.pending) {
                amountToReceive += payment._sum.guardianAmount || 0
            } else if (payment.guardianPaymentStatus === PaymentStatus.completed) {
                amountReceived += payment._sum.guardianAmount || 0
            }

            if (payment.tutorPaymentStatus === PaymentStatus.pending) {
                amountToPay += payment._sum.tutorAmount || 0
            } else if (payment.tutorPaymentStatus === PaymentStatus.completed) {
                amountPaid += payment._sum.tutorAmount || 0
            }
        })

        const adminAmountToReceive = adminPayments.reduce((acc, payment) => {
            if (payment.status === 'pending') {
                return acc + payment.amount
            } else {
                return acc
            }
        }, 0)

        const adminAmountReceived = adminPayments.reduce((acc, payment) => {
            if (payment.status === 'completed') {
                return acc + payment.amount
            } else {
                return acc
            }
        }, 0)

        const response = { adminPayments, amountToReceive, amountReceived, amountToPay, amountPaid, adminAmountToReceive, adminAmountReceived }
        console.log('[CashFlow Summary - Admin]', JSON.stringify(response, null, 2))
        return res.json(response)
    } else if (role === 'coordinator') {
        // For the coordinator, the logic is basically the same, but we need to filter the payments by the institution of the coordinator, and we also need to calculate the share for the coordinator, that is stored in the CoordinatorProfitShare relation.
        
        const institutionId = (req as any).auth.institutionId
        const userId = (req as any).auth.uid

        const coordinatorPayments = await prisma.coordinatorPayment.findMany({
            where: {
                period: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                amount: true,
                status: true,
                period: true
            }
        })

        const existingPeriods = new Set(
            coordinatorPayments.map((p) => {
                return `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`
             })
        )

        const pendingMonths = []
        const currentIter = new Date(start) 

        while (currentIter <= end) {
            const currentYear = currentIter.getUTCFullYear()
            const currentMonth = currentIter.getUTCMonth()
            const periodKey = `${currentYear}-${currentMonth}`

            if (!existingPeriods.has(periodKey)) {
                const monthStart = new Date(currentIter)
                
                const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999))

                pendingMonths.push({
                    start: monthStart,
                    end: monthEnd
                })
            }
            currentIter.setUTCMonth(currentIter.getUTCMonth() + 1)
        }

         // For the coordinator, we need to filter the shares by the institution and also by the coordinator id, so, we need to add the condition of coordinatorId in the query.
        const coordinatorShares = await prisma.coordinatorProfitShare.findMany({
            where: {
                coordinatorId: userId,
                institutionId,
                availableSince: {
                    lte: end
                },
                availableUntil: {
                    gte: start
                }
            },
            orderBy: {
                availableSince: 'asc'
            }
        })

        const coordinatorPaymentsResult = []

        for (const month of pendingMonths) {
            const monthStart = month.start
            const monthEnd = month.end

            let amount = 0

            const coordinatorSharesForTheMonth = coordinatorShares.filter((s) => {
                return (s.availableSince <= monthEnd) && (s.availableUntil >= monthStart)
            })
            const periodForEachShare = coordinatorSharesForTheMonth.map((s) => {
                const shareStart = s.availableSince > monthStart ? s.availableSince : monthStart
                const shareEnd = s.availableUntil < monthEnd ? s.availableUntil : monthEnd
                return {
                shareStart,
                    shareEnd,
                }
            })

            for (const [index, period] of periodForEachShare.entries()) {
                const share = coordinatorSharesForTheMonth[index].profitShare as Decimal
                // Here we can calculate the amount to receive and pay for the month, using the share and the total amount of the month, that is calculated using the class payments.
                const guardianPayments = await prisma.classPayment.aggregate({
                    _sum: {
                        guardianAmount: true
                    },
                    where: {
                        Class: {
                            institutionId,
                            date: {
                                gte: new Date(period.shareStart),
                                lte: new Date(period.shareEnd)
                            }
                        },
                    }
                })

                const tutorPayments = await prisma.classPayment.aggregate({
                    _sum: {
                        tutorAmount: true
                    },
                    where: {
                        Class: {
                            institutionId,
                            date: {
                                gte: new Date(period.shareStart),
                                lte: new Date(period.shareEnd)
                            }
                        },
                    }
                })

                amount += (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) - (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
            }

            coordinatorPaymentsResult.push({
                amount,
                status: 'pending' as PaymentStatus,
                period: monthStart
            })
        }

        const payments = await prisma.classPayment.groupBy({
            by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
            _sum: {
                guardianAmount: true,
                tutorAmount: true
            },
            where: {
                Class: {
                    institutionId,
                    date: {
                        gte: start,
                        lte: end
                    }
                }
            }
        })

        let amountToReceive = 0
        let amountReceived = 0
        let amountToPay = 0
        let amountPaid = 0

        payments.forEach(payment => {
            if (payment.guardianPaymentStatus === PaymentStatus.pending) {
                amountToReceive += payment._sum.guardianAmount || 0
            } else if (payment.guardianPaymentStatus === PaymentStatus.completed) {
                amountReceived += payment._sum.guardianAmount || 0
            }

            if (payment.tutorPaymentStatus === PaymentStatus.pending) {
                amountToPay += payment._sum.tutorAmount || 0
            } else if (payment.tutorPaymentStatus === PaymentStatus.completed) {
                amountPaid += payment._sum.tutorAmount || 0
            }
        })

        const coordinatorAmountToReceive = coordinatorPaymentsResult.reduce((acc, payment) => {
            if (payment.status === 'pending') {
                return acc + payment.amount
            } else {
                return acc
            }
        }, 0)

        const coordinatorAmountReceived = coordinatorPaymentsResult.reduce((acc, payment) => {
            if (payment.status === 'completed') {
                return acc + payment.amount
            } else {
                return acc
            }
        }, 0)

        const response = { coordinatorPayments: coordinatorPaymentsResult, amountToReceive, amountReceived, amountToPay, amountPaid, coordinatorAmountToReceive, coordinatorAmountReceived }
        console.log('[CashFlow Summary - Coordinator]', JSON.stringify(response, null, 2))
        return res.json(response)
    } else {
        return res.status(400).json({ ok: false, message: 'Forbidden' })
    }
}


export async function getCashFlowDetails(req: Request, res: Response, next: NextFunction){
    const {
        startDate,
        endDate,
        filteredUserRole,
        page = 1,
        pageSize = 10,
    } = req.query

    const role = (req as any).auth.role as UserRole
    
    if (!startDate || !endDate) {
        return res.status(400).json({ ok: false, message: 'Start date and end date are required' })
    }

    const startParsed = parseMonthYear(startDate)
    const endParsed = parseMonthYear(endDate)
    if (!startParsed || !endParsed) {
        return res.status(400).json({ ok: false, message: 'Invalid date format, expected MM-YYYY' })
    }

    const start = new Date(Date.UTC(startParsed.year, startParsed.month - 1, 1))
    const end = new Date(Date.UTC(endParsed.year, endParsed.month, 0, 23, 59, 59, 999))

    if (role === UserRole.coordinator && (filteredUserRole === UserRole.coordinator || filteredUserRole === UserRole.admin)) {
        return res.status(403).json({ message: 'Coordinator cannot view other coordinators or admin details' })
    }
    
    if (filteredUserRole === UserRole.admin) {
        return res.json({ message: 'Admin details already obtained in the overview' })
    }

    if (filteredUserRole === UserRole.coordinator) {
        const institutionId = req.query.institutionId ? Number(req.query.institutionId) : undefined

        const coordinators = await prisma.user.findMany({
            where: {
                institutionId,
                role: UserRole.coordinator
            },
            select: {
                id: true,
                name: true,
                email: true,
                Institution: {
                    select: {
                        name: true,
                        id: true
                    }
                }
            },
            take: pageSize ? Number(pageSize) : undefined,
            skip: pageSize && page ? (Number(page) - 1) * Number(pageSize) : undefined,
        })

        const result = []

        for (const coordinator of coordinators) {
            const institutionId = coordinator.Institution?.id
            if (!institutionId) continue

            const coordinatorPayments = await prisma.coordinatorPayment.findMany({
                where: {
                    coordinatorId: coordinator.id,
                    period: {
                        gte: start,
                        lte: end
                    }
                },
                select: {
                    amount: true,
                    status: true,
                    period: true
                }
            })

            const existingPeriods = new Set(
                coordinatorPayments.map((p) => {
                    return `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`
                 })
            )

            const pendingMonths = []
            const currentIter = new Date(start) 
            while (currentIter <= end) {
                const currentYear = currentIter.getUTCFullYear()
                const currentMonth = currentIter.getUTCMonth()
                const periodKey = `${currentYear}-${currentMonth}`

                if (!existingPeriods.has(periodKey)) {
                    const monthStart = new Date(currentIter)
                    
                    const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999))

                    pendingMonths.push({
                        start: monthStart,
                        end: monthEnd
                    })
                }
                currentIter.setUTCMonth(currentIter.getUTCMonth() + 1)
            }

            const coordinatorShares = await prisma.coordinatorProfitShare.findMany({
                where: {
                    coordinatorId: coordinator.id,
                    institutionId,
                    availableSince: {
                        lte: end
                    },
                    availableUntil: {
                        gte: start
                    }
                },
                orderBy: {
                    availableSince: 'asc'
                }
            })

            const coordinatorPaymentsResult = []

            for (const month of pendingMonths) {
                const monthStart = month.start
                const monthEnd = month.end

                let amount = 0

                const coordinatorSharesForTheMonth = coordinatorShares.filter((s) => {
                    return (s.availableSince <= monthEnd) && (s.availableUntil >= monthStart)
                })
                const periodForEachShare = coordinatorSharesForTheMonth.map((s) => {
                    const shareStart = s.availableSince > monthStart ? s.availableSince : monthStart
                    const shareEnd = s.availableUntil < monthEnd ? s.availableUntil : monthEnd
                    return {
                        shareStart,
                        shareEnd,
                    }
                })

                for (const [index, period] of periodForEachShare.entries()) {
                    const share = coordinatorSharesForTheMonth[index].profitShare as Decimal
                    
                    const guardianPayments = await prisma.classPayment.aggregate({
                        _sum: {
                            guardianAmount: true
                        },
                        where: {
                            Class: {
                                institutionId,
                                date: {
                                    gte: new Date(period.shareStart),
                                    lte: new Date(period.shareEnd)
                                }
                            },
                        }
                    })

                    const tutorPayments = await prisma.classPayment.aggregate({
                        _sum: {
                            tutorAmount: true
                        },
                        where: {
                            Class: {
                                institutionId,
                                date: {
                                    gte: new Date(period.shareStart),
                                    lte: new Date(period.shareEnd)
                                }
                            },
                        }
                    })

                    amount += (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) - (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
                }

                coordinatorPaymentsResult.push({
                    amount,
                    status: 'pending' as PaymentStatus,
                    period: monthStart
                })
            }

            const coordinatorAmountToReceive = coordinatorPaymentsResult.reduce((acc, payment) => {
                if (payment.status === 'pending') {
                    return acc + payment.amount
                } else {
                    return acc
                }
            }, 0)
    
            const coordinatorAmountReceived = coordinatorPaymentsResult.reduce((acc, payment) => {
                if (payment.status === 'completed') {
                    return acc + payment.amount
                } else {
                    return acc
                }
            }, 0)

            result.push({
                coordinator,
                coordinatorPayments: coordinatorPaymentsResult,
                amount: coordinatorAmountReceived + coordinatorAmountToReceive
            })
        }

        console.log('[CashFlow Details - Coordinators]', JSON.stringify(result, null, 2))
        return res.json(result)
    }

    if (filteredUserRole === UserRole.tutor) {
        const tutorsAndPayments = await prisma.user.findMany({
            where: {
                role: UserRole.tutor,
                institutionId: req.query.institutionId ? Number(req.query.institutionId) : undefined
            },
            select: {
                id: true,
                name: true,
                email: true,
                Institution: {
                    select: {
                        name: true,
                        id: true
                    }
                },
                ClassesAsTutor: {
                    select: {
                        ClassPayment: {
                            where: {
                                Class: {
                                    date: {
                                        gte: start,
                                        lte: end
                                    }
                                }
                            },
                            select: {
                                tutorAmount: true,
                                tutorPaymentStatus: true,
                            },
                        }
                    }
                }
            },
            take: pageSize ? Number(pageSize) : undefined,
            skip: pageSize && page ? (Number(page) - 1) * Number(pageSize) : undefined,
        })

        for (const tutor of tutorsAndPayments) {
            const totalAmount = tutor.ClassesAsTutor.reduce((acc, classAsTutor) => {
                if (!classAsTutor.ClassPayment) return acc
                return acc + (classAsTutor.ClassPayment.tutorAmount || 0);
            }, 0);
            const status = tutor.ClassesAsTutor.some(classAsTutor => classAsTutor.ClassPayment && classAsTutor.ClassPayment.tutorPaymentStatus === PaymentStatus.pending) ? PaymentStatus.pending : PaymentStatus.completed;

            (tutor as any).totalAmount = totalAmount;
            (tutor as any).paymentStatus = status;
        }
        
        console.log('[CashFlow Details - Tutors]', JSON.stringify(tutorsAndPayments, null, 2))
        return res.json(tutorsAndPayments)
    }

    if (filteredUserRole === UserRole.guardian) {
        const guardiansAndPayments = await prisma.user.findMany({
            where: {
                role: UserRole.guardian,
                institutionId: req.query.institutionId ? Number(req.query.institutionId) : undefined,
                Students: {
                    some: {
                        Classes: {
                            some: {
                                date: {
                                    gte: start,
                                    lte: end
                                }
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                Institution: {
                    select: {
                        name: true,
                        id: true
                    }
                },
                Students: {
                    select: {
                        Classes: {
                            where: {
                                date: {
                                    gte: start,
                                    lte: end
                                }
                            },
                            select: {     
                                ClassPayment: {
                                    select: {
                                        guardianAmount: true,
                                        guardianPaymentStatus: true,
                                        guardianPaymentType: true,
                                    },
                                }
                            }
                        },
                    }
                }
            },
            take: pageSize ? Number(pageSize) : undefined,
            skip: pageSize && page ? (Number(page) - 1) * Number(pageSize) : undefined,
        })

        for (const guardian of guardiansAndPayments) {
            const totalAmount = guardian.Students.reduce((acc, student) => {
                const studentTotal = student.Classes.reduce((classAcc, classItem) => {
                    if (!classItem.ClassPayment) return classAcc
                    return classAcc + (classItem.ClassPayment.guardianAmount || 0);
                }, 0);
                return acc + studentTotal;
            }, 0);
            const status = guardian.Students.some(student => student.Classes.some(classItem => classItem.ClassPayment && classItem.ClassPayment.guardianPaymentStatus === PaymentStatus.pending)) ? PaymentStatus.pending : PaymentStatus.completed;

            (guardian as any).totalAmount = totalAmount;
            (guardian as any).paymentStatus = status;
        }
        
        console.log('[CashFlow Details - Guardians]', JSON.stringify(guardiansAndPayments, null, 2))
        return res.json(guardiansAndPayments)
    }
}