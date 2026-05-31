import prisma from '../lib/prisma'
import { Request, Response } from 'express'
import { UserRole, PaymentStatus, PaymentType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

function parseMonthYear(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(0[1-9]|1[0-2])-(\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const year = Number(match[2])
  return { month, year }
}

async function getCoordinatorCreationMonthStart(userId: number) {
  const coordinator = await prisma.user.findFirst({
    where: {
      id: userId,
      role: UserRole.coordinator,
    },
    select: { createdAt: true },
  })

  if (!coordinator) return null

  return new Date(
    Date.UTC(coordinator.createdAt.getUTCFullYear(), coordinator.createdAt.getUTCMonth(), 1),
  )
}
type GuardianPaymentStatusView = PaymentStatus | 'No payments'

export async function getCashFlowSummary(req: Request, res: Response) {
  const { startDate, endDate } = req.query
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

  if (role === UserRole.coordinator) {
    const coordinatorId = Number((req as any).auth.uid)
    const coordinatorStart = await getCoordinatorCreationMonthStart(coordinatorId)

    if (!coordinatorStart) {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    if (start < coordinatorStart) {
      return res.status(400).json({
        ok: false,
        message: 'Coordinators can only query periods from their creation month onward',
      })
    }
  }

  if (role === 'admin') {
    const institutionId = req.query.institutionId ? Number(req.query.institutionId) : undefined
    const adminPayments = await prisma.adminPayment.findMany({
      where: {
        period: {
          gte: start,
          lte: end,
        },
      },
      select: {
        amount: true,
        status: true,
        period: true,
      },
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
      }),
    )

    const recordedStatusByPeriod = new Map<string, PaymentStatus>(
      adminPayments.map((p) => [
        `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`,
        p.status,
      ]),
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
          end: monthEnd,
        })
      }

      currentIter.setUTCMonth(currentIter.getUTCMonth() + 1)
    }

    const adminShares = await prisma.adminProfitShare.findMany({
      where: {
        availableSince: {
          lte: end,
        },
        availableUntil: {
          gte: start,
        },
      },
      orderBy: {
        availableSince: 'asc',
      },
    })

    for (const month of pendingMonths) {
      const monthStart = month.start
      const monthEnd = month.end

      let amount = 0

      // Profit shares always align to month boundaries — at most one share is
      // active per month, so no sub-period splitting is needed.
      const shareForTheMonth = adminShares.find(
        (s) => s.availableSince <= monthStart && s.availableUntil >= monthStart,
      )

      if (shareForTheMonth) {
        const share = shareForTheMonth.profitShare as Decimal
        const guardianPayments = await prisma.classPayment.aggregate({
          _sum: { guardianAmount: true },
          where: {
            Class: {
              date: { gte: monthStart, lte: monthEnd },
            },
          },
        })
        const tutorPayments = await prisma.classPayment.aggregate({
          _sum: { tutorAmount: true },
          where: {
            Class: {
              date: { gte: monthStart, lte: monthEnd },
            },
          },
        })
        amount =
          (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) -
          (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
      }

      adminPayments.push({
        amount,
        status: 'pending' as PaymentStatus,
        period: monthStart,
      })
    }

    let adminAmountToReceive: number
    let adminAmountReceived: number

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
        const periodKey = `${currentYear}-${currentMonth}`
        const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1))
        const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999))

        let amount = 0
        const shareForTheMonth = adminShares.find(
          (s) => s.availableSince <= monthStart && s.availableUntil >= monthStart,
        )

        if (shareForTheMonth) {
          const share = shareForTheMonth.profitShare as Decimal
          const guardianPayments = await prisma.classPayment.aggregate({
            _sum: { guardianAmount: true },
            where: {
              Class: {
                institutionId,
                date: { gte: monthStart, lte: monthEnd },
              },
            },
          })
          const tutorPayments = await prisma.classPayment.aggregate({
            _sum: { tutorAmount: true },
            where: {
              Class: {
                institutionId,
                date: { gte: monthStart, lte: monthEnd },
              },
            },
          })
          amount =
            (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) -
            (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
        }

        adminPaymentsByInstitution.push({
          amount,
          status: recordedStatusByPeriod.get(periodKey) ?? ('pending' as PaymentStatus),
          period: monthStart,
        })

        currentIterAll.setUTCMonth(currentIterAll.getUTCMonth() + 1)
      }

      adminAmountToReceive = adminPaymentsByInstitution.reduce((acc, payment) => {
        return payment.status === 'pending' ? acc + payment.amount : acc
      }, 0)

      adminAmountReceived = adminPaymentsByInstitution.reduce((acc, payment) => {
        return payment.status === 'completed' ? acc + payment.amount : acc
      }, 0)
    } else {
      adminAmountToReceive = adminPayments.reduce((acc, payment) => {
        if (payment.status === 'pending') {
          return acc + payment.amount
        }
        return acc
      }, 0)

      adminAmountReceived = adminPayments.reduce((acc, payment) => {
        if (payment.status === 'completed') {
          return acc + payment.amount
        }
        return acc
      }, 0)
    }

    // Sum the amounts for each month and return the result.

    const payments = await prisma.classPayment.groupBy({
      by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
      _sum: {
        guardianAmount: true,
        tutorAmount: true,
      },
      where: {
        Class: {
          institutionId: institutionId ? Number(institutionId) : undefined,
          date: {
            gte: start,
            lte: end,
          },
        },
      },
    })

    let amountToReceive = 0
    let amountReceived = 0
    let amountToPay = 0
    let amountPaid = 0

    payments.forEach((payment) => {
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

    const response = {
      adminPayments,
      amountToReceive,
      amountReceived,
      amountToPay,
      amountPaid,
      adminAmountToReceive,
      adminAmountReceived,
    }
    return res.json(response)
  } else if (role === 'coordinator') {

    const institutionId = (req as any).auth.institutionId
    const userId = (req as any).auth.uid

    const coordinatorPayments = await prisma.coordinatorPayment.findMany({
      where: {
        period: {
          gte: start,
          lte: end,
        },
      },
      select: {
        amount: true,
        status: true,
        period: true,
      },
    })

    const existingPeriods = new Set(
      coordinatorPayments.map((p) => {
        return `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`
      }),
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
          end: monthEnd,
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
          lte: end,
        },
        availableUntil: {
          gte: start,
        },
      },
      orderBy: {
        availableSince: 'asc',
      },
    })

    const coordinatorPaymentsResult = [...coordinatorPayments]

    for (const month of pendingMonths) {
      const monthStart = month.start
      const monthEnd = month.end

      let amount = 0

      // Profit shares always align to month boundaries — at most one share is
      // active per month, so no sub-period splitting is needed.
      const shareForTheMonth = coordinatorShares.find(
        (s) => s.availableSince <= monthStart && s.availableUntil >= monthStart,
      )

      if (shareForTheMonth) {
        const share = shareForTheMonth.profitShare as Decimal
        const guardianPayments = await prisma.classPayment.aggregate({
          _sum: { guardianAmount: true },
          where: {
            Class: {
              institutionId,
              date: { gte: monthStart, lte: monthEnd },
            },
          },
        })
        const tutorPayments = await prisma.classPayment.aggregate({
          _sum: { tutorAmount: true },
          where: {
            Class: {
              institutionId,
              date: { gte: monthStart, lte: monthEnd },
            },
          },
        })
        amount =
          (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) -
          (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
      }

      coordinatorPaymentsResult.push({
        amount,
        status: 'pending' as PaymentStatus,
        period: monthStart,
      })
    }

    const payments = await prisma.classPayment.groupBy({
      by: ['guardianPaymentStatus', 'tutorPaymentStatus'],
      _sum: {
        guardianAmount: true,
        tutorAmount: true,
      },
      where: {
        Class: {
          institutionId,
          date: {
            gte: start,
            lte: end,
          },
        },
      },
    })

    let amountToReceive = 0
    let amountReceived = 0
    let amountToPay = 0
    let amountPaid = 0

    payments.forEach((payment) => {
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

    const response = {
      coordinatorPayments: coordinatorPaymentsResult,
      amountToReceive,
      amountReceived,
      amountToPay,
      amountPaid,
      coordinatorAmountToReceive,
      coordinatorAmountReceived,
    }
    return res.json(response)
  } else {
    return res.status(400).json({ ok: false, message: 'Forbidden' })
  }
}

export async function getCashFlowDetails(req: Request, res: Response) {
  const { startDate, endDate, filteredUserRole, page = 1, pageSize = 10 } = req.query

  const role = (req as any).auth.role as UserRole
  const requesterInstitutionId = Number((req as any).auth.institutionId)
  const pageNumber = Number(page) > 0 ? Number(page) : 1
  const pageSizeNumber = Number(pageSize) > 0 ? Number(pageSize) : 10

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

  if (role === UserRole.coordinator) {
    const coordinatorId = Number((req as any).auth.uid)
    const coordinatorStart = await getCoordinatorCreationMonthStart(coordinatorId)

    if (!coordinatorStart) {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    if (start < coordinatorStart) {
      return res.status(400).json({
        ok: false,
        message: 'Coordinators can only query periods from their creation month onward',
      })
    }
  }

  if (
    role === UserRole.coordinator &&
    (filteredUserRole === UserRole.coordinator || filteredUserRole === UserRole.admin)
  ) {
    return res
      .status(403)
      .json({ message: 'Coordinator cannot view other coordinators or admin details' })
  }

  if (filteredUserRole === UserRole.admin) {
    return res.json({ message: 'Admin details already obtained in the overview' })
  }

  if (filteredUserRole === UserRole.coordinator) {
    const institutionId = req.query.institutionId ? Number(req.query.institutionId) : undefined
    const paymentStatus = req.query.paymentStatus as PaymentStatus | undefined

    const coordinators = await prisma.user.findMany({
      where: {
        institutionId,
        role: UserRole.coordinator,
      },
      select: {
        id: true,
        name: true,
        email: true,
        Institution: {
          select: {
            name: true,
            id: true,
          },
        },
      },
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
            lte: end,
          },
        },
        select: {
          amount: true,
          status: true,
          period: true,
        },
      })

      const existingPeriods = new Set(
        coordinatorPayments.map((p) => {
          return `${p.period.getUTCFullYear()}-${p.period.getUTCMonth()}`
        }),
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
            end: monthEnd,
          })
        }
        currentIter.setUTCMonth(currentIter.getUTCMonth() + 1)
      }

      const coordinatorShares = await prisma.coordinatorProfitShare.findMany({
        where: {
          coordinatorId: coordinator.id,
          institutionId,
          availableSince: {
            lte: end,
          },
          availableUntil: {
            gte: start,
          },
        },
        orderBy: {
          availableSince: 'asc',
        },
      })

      const coordinatorPaymentsResult = [...coordinatorPayments]

      for (const month of pendingMonths) {
        const monthStart = month.start
        const monthEnd = month.end

        let amount = 0

        // Profit shares always align to month boundaries — at most one share is
        // active per month, so no sub-period splitting is needed.
        const shareForTheMonth = coordinatorShares.find(
          (s) => s.availableSince <= monthStart && s.availableUntil >= monthStart,
        )

        if (shareForTheMonth) {
          const share = shareForTheMonth.profitShare as Decimal
          const guardianPayments = await prisma.classPayment.aggregate({
            _sum: { guardianAmount: true },
            where: {
              Class: {
                institutionId,
                date: { gte: monthStart, lte: monthEnd },
              },
            },
          })
          const tutorPayments = await prisma.classPayment.aggregate({
            _sum: { tutorAmount: true },
            where: {
              Class: {
                institutionId,
                date: { gte: monthStart, lte: monthEnd },
              },
            },
          })
          amount =
            (guardianPayments._sum.guardianAmount || 0) * (share.toNumber() / 100) -
            (tutorPayments._sum.tutorAmount || 0) * (share.toNumber() / 100)
        }

        coordinatorPaymentsResult.push({
          amount,
          status: 'pending' as PaymentStatus,
          period: monthStart,
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

      // If the filter by paymentStatus is applied:
      // - if paymentStatus is pending, we add the coordinators that have at least one pending payment
      // - if paymentStatus is completed, we only add the coordinators that have all the payments completed
      if (paymentStatus === PaymentStatus.pending) {
        if (coordinatorPaymentsResult.some((payment) => payment.status === PaymentStatus.pending)) {
          result.push({
            coordinator,
            coordinatorPayments: coordinatorPaymentsResult,
            amount: coordinatorAmountReceived + coordinatorAmountToReceive,
          })
        }
      } else if (paymentStatus === PaymentStatus.completed) {
        if (
          coordinatorPaymentsResult.every((payment) => payment.status === PaymentStatus.completed)
        ) {
          result.push({
            coordinator,
            coordinatorPayments: coordinatorPaymentsResult,
            amount: coordinatorAmountReceived + coordinatorAmountToReceive,
          })
        }
      } else {
        result.push({
          coordinator,
          coordinatorPayments: coordinatorPaymentsResult,
          amount: coordinatorAmountReceived + coordinatorAmountToReceive,
        })
      }
    }

    const filteredResult =
      role === UserRole.coordinator
        ? result.filter((entry) => entry.coordinator?.Institution?.id === requesterInstitutionId)
        : result

    const total = filteredResult.length
    const startIndex = (pageNumber - 1) * pageSizeNumber
    const items = filteredResult.slice(startIndex, startIndex + pageSizeNumber)

    return res.json({
      total,
      page: pageNumber,
      pageSize: pageSizeNumber,
      items,
    })
  }

  if (filteredUserRole === UserRole.tutor) {
    const { paymentStatus } = req.query
    const tutorsAndPayments = await prisma.user.findMany({
      where: {
        role: UserRole.tutor,
        institutionId: req.query.institutionId ? Number(req.query.institutionId) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        Institution: {
          select: {
            name: true,
            id: true,
          },
        },
        ClassesAsTutor: {
          select: {
            ClassPayment: {
              where: {
                Class: {
                  date: {
                    gte: start,
                    lte: end,
                  },
                  ClassPayment: paymentStatus
                    ? {
                        tutorPaymentStatus: paymentStatus as PaymentStatus,
                      }
                    : undefined,
                },
              },
              select: {
                tutorAmount: true,
                tutorPaymentStatus: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    for (const tutor of tutorsAndPayments) {
      const totalAmount = tutor.ClassesAsTutor.reduce((acc, classAsTutor) => {
        if (!classAsTutor.ClassPayment) return acc
        return acc + (classAsTutor.ClassPayment.tutorAmount || 0)
      }, 0)
      const status = tutor.ClassesAsTutor.some(
        (classAsTutor) =>
          classAsTutor.ClassPayment &&
          classAsTutor.ClassPayment.tutorPaymentStatus === PaymentStatus.pending,
      )
        ? PaymentStatus.pending
        : PaymentStatus.completed

      ;(tutor as any).totalAmount = totalAmount
      ;(tutor as any).paymentStatus = status
    }

    const filteredTutorsAndPayments =
      role === UserRole.coordinator
        ? tutorsAndPayments.filter((tutor) => tutor.Institution?.id === requesterInstitutionId)
        : tutorsAndPayments

    const total = filteredTutorsAndPayments.length
    const startIndex = (pageNumber - 1) * pageSizeNumber
    const items = filteredTutorsAndPayments.slice(startIndex, startIndex + pageSizeNumber)

    return res.json({
      total,
      page: pageNumber,
      pageSize: pageSizeNumber,
      items,
    })
  }

  if (filteredUserRole === UserRole.guardian) {
    const { filteredGuardianPaymentStatus } = req.query
    const guardianStatusFilter =
      typeof filteredGuardianPaymentStatus === 'string' &&
      filteredGuardianPaymentStatus.trim() !== ''
        ? filteredGuardianPaymentStatus
        : undefined

    // if we filter the paymentType as BankTransfer or Card, we need also only show the payments in PaymentStatus completed
    // thats beceause the pending payments al always marked as bankTransfer
    // Options
    // - filterGuardianPaymentStatus = pending => show only the pending payments, that are always bankTransfer
    // - filterGuardianPaymentStatus = bankTransfer => show only the completed payments with bankTransfer type, and the pending payments, that are always bankTransfer
    // - filterGuardianPaymentStatus = card => show only the completed payments with card type
    // - filterGuardianPaymentStatus = card-transfer => show only the completed payments with card or bank transfer type, this type is considered when a guardian has at least one completed payment with card but no pending payments
    // - filterGuardianPaymentStatus = completed => show all the payments with completed status, independtly of the type, no guardian with a pending payment will be shown. When filtering completed payments, we can mark in the response if all the completed payments are with card, with bank transfer or mixed, to show that in the details and be able to filter by that in the frontend
    let guardianPaymentType: PaymentType | undefined = undefined
    let guardianPaymentStatus: PaymentStatus | undefined = undefined

    if (guardianStatusFilter === 'pending') {
      guardianPaymentStatus = PaymentStatus.pending
      guardianPaymentType = PaymentType.bankTransfer
    } else if (guardianStatusFilter === 'bankTransfer') {
      guardianPaymentStatus = PaymentStatus.completed
      guardianPaymentType = PaymentType.bankTransfer
    } else if (guardianStatusFilter === 'card') {
      guardianPaymentStatus = PaymentStatus.completed
      guardianPaymentType = PaymentType.card
    } else if (guardianStatusFilter === 'card-transfer') {
      // Mixed: guardian has both completed card and completed bankTransfer payments, no pending
      guardianPaymentStatus = PaymentStatus.completed
      guardianPaymentType = undefined
    } else if (guardianStatusFilter === 'completed') {
      guardianPaymentStatus = PaymentStatus.completed
      guardianPaymentType = undefined
    } else if (guardianStatusFilter === 'No payments') {
      guardianPaymentStatus = undefined
      guardianPaymentType = undefined
    }

    const guardianWhere: any = {
      role: UserRole.guardian,
      institutionId: req.query.institutionId ? Number(req.query.institutionId) : undefined,
    }

    if (guardianStatusFilter === 'No payments') {
      guardianWhere.NOT = {
        Students: {
          some: {
            Classes: {
              some: {
                date: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        },
      }
    } else if (guardianStatusFilter !== undefined) {
      guardianWhere.Students = {
        some: {
          Classes: {
            some: {
              date: {
                gte: start,
                lte: end,
              },
              ClassPayment: {
                guardianPaymentStatus,
                guardianPaymentType,
              },
            },
          },
        },
      }
    }

    const guardiansAndPayments = await prisma.user.findMany({
      where: {
        ...guardianWhere,
        // Strictly exclude guardians that have any payment not matching the filter:
        // - completed: no pending payments allowed
        // - card:      no pending, no bankTransfer payments allowed
        // - bankTransfer: no card payments allowed (pending are always bankTransfer, so they are fine)
        ...(guardianStatusFilter === 'completed'
          ? {
              NOT: {
                Students: {
                  some: {
                    Classes: {
                      some: {
                        date: { gte: start, lte: end },
                        ClassPayment: { guardianPaymentStatus: PaymentStatus.pending },
                      },
                    },
                  },
                },
              },
            }
          : guardianStatusFilter === 'card'
            ? {
                NOT: {
                  Students: {
                    some: {
                      Classes: {
                        some: {
                          date: { gte: start, lte: end },
                          ClassPayment: {
                            OR: [
                              { guardianPaymentStatus: PaymentStatus.pending },
                              { guardianPaymentType: PaymentType.bankTransfer },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              }
            : guardianStatusFilter === 'bankTransfer'
              ? {
                  NOT: {
                    Students: {
                      some: {
                        Classes: {
                          some: {
                            date: { gte: start, lte: end },
                            ClassPayment: {
                              OR: [
                                { guardianPaymentStatus: PaymentStatus.pending },
                                { guardianPaymentType: PaymentType.card },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                }
              : guardianStatusFilter === 'card-transfer'
                ? {
                    // Require at least one completed card payment AND at least one completed bankTransfer payment,
                    // and exclude any guardian that still has a pending payment.
                    NOT: {
                      Students: {
                        some: {
                          Classes: {
                            some: {
                              date: { gte: start, lte: end },
                              ClassPayment: { guardianPaymentStatus: PaymentStatus.pending },
                            },
                          },
                        },
                      },
                    },
                    AND: [
                      {
                        Students: {
                          some: {
                            Classes: {
                              some: {
                                date: { gte: start, lte: end },
                                ClassPayment: {
                                  guardianPaymentStatus: PaymentStatus.completed,
                                  guardianPaymentType: PaymentType.card,
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        Students: {
                          some: {
                            Classes: {
                              some: {
                                date: { gte: start, lte: end },
                                ClassPayment: {
                                  guardianPaymentStatus: PaymentStatus.completed,
                                  guardianPaymentType: PaymentType.bankTransfer,
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        Institution: {
          select: {
            name: true,
            id: true,
          },
        },
        Students: {
          select: {
            Classes: {
              where: {
                date: {
                  gte: start,
                  lte: end,
                },
              },
              select: {
                ClassPayment: {
                  select: {
                    guardianAmount: true,
                    guardianPaymentStatus: true,
                    guardianPaymentType: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    for (const guardian of guardiansAndPayments) {
      const totalAmount = guardian.Students.reduce((acc, student) => {
        const studentTotal = student.Classes.reduce((classAcc, classItem) => {
          if (!classItem.ClassPayment) return classAcc
          return classAcc + (classItem.ClassPayment.guardianAmount || 0)
        }, 0)
        return acc + studentTotal
      }, 0)
      const hasClassesInPeriod = guardian.Students.some((student) => student.Classes.length > 0)
      const status: GuardianPaymentStatusView = guardian.Students.some((student) =>
        student.Classes.some(
          (classItem) =>
            classItem.ClassPayment &&
            classItem.ClassPayment.guardianPaymentStatus === PaymentStatus.pending,
        ),
      )
        ? PaymentStatus.pending
        : hasClassesInPeriod
          ? PaymentStatus.completed
          : 'No payments'

      // if the payment status is completed, means that all the payments from that guardian are done,
      // but, we have to mark if all the payments are completed with card, or with bank transfer, or if they are mixed, to show that in the details, so we can filter by that in the frontend
      const paymentTypes = new Set<string>()
      guardian.Students.forEach((student) => {
        student.Classes.forEach((classItem) => {
          if (
            classItem.ClassPayment &&
            classItem.ClassPayment.guardianPaymentStatus === PaymentStatus.completed
          ) {
            paymentTypes.add(classItem.ClassPayment.guardianPaymentType || '')
          }
        })
      })

      if (paymentTypes.size === 1) {
        guardianPaymentType = paymentTypes.has(PaymentType.card)
          ? PaymentType.card
          : PaymentType.bankTransfer
      } else if (paymentTypes.size > 1) {
        guardianPaymentType = undefined // mixed types
      } else {
        guardianPaymentType = undefined // no completed payments
      }

      ;(guardian as any).totalAmount = totalAmount
      ;(guardian as any).paymentStatus = status
      ;(guardian as any).paymentType = guardianPaymentType
    }

    const filteredGuardiansAndPayments =
      role === UserRole.coordinator
        ? guardiansAndPayments.filter(
            (guardian) => guardian.Institution?.id === requesterInstitutionId,
          )
        : guardiansAndPayments

    const total = filteredGuardiansAndPayments.length
    const startIndex = (pageNumber - 1) * pageSizeNumber
    const items = filteredGuardiansAndPayments.slice(startIndex, startIndex + pageSizeNumber)

    return res.json({
      total,
      page: pageNumber,
      pageSize: pageSizeNumber,
      items,
    })
  }
}
