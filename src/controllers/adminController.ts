import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'

export async function editAdminProfitShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { profitShare } = req.body
    const userRole = (req as any).auth?.role

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    if (typeof profitShare !== 'number' || profitShare < 0 || profitShare > 100) {
      return res
        .status(400)
        .json({ ok: false, message: 'Profit share must be a number between 0 and 100' })
    }

    // Profit shares are aligned to month boundaries: a new share always starts on the 1st of
    // the current month and the previous one is capped at the last millisecond of the previous month.
    const now = new Date()
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const prevMonthEnd = new Date(thisMonthStart.getTime() - 1)

    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true,
      },
    })

    for (const institution of institutions) {
      // Sum coordinator profit shares active at the start of the current month
      const activeCoordinatorShares = await prisma.coordinatorProfitShare.findMany({
        where: {
          institutionId: institution.id,
          availableSince: { lte: thisMonthStart },
          availableUntil: { gte: thisMonthStart },
        },
      })

      const coordinatorTotal = activeCoordinatorShares.reduce(
        (sum, share) => sum + Number(share.profitShare),
        0,
      )

      if (coordinatorTotal + profitShare > 100) {
        return res.status(400).json({
          ok: false,
          message: `El porcentaje excede el 100% con la institución "${institution.name}"`,
        })
      }
    }

    const newAdminProfitShare = await prisma.$transaction(async (tx) => {
      // If a share already starts this month (repeated edit within same month), delete it so it
      // can be cleanly replaced — prevents stacking multiple shares in the same month.
      const thisMonthShare = await tx.adminProfitShare.findFirst({
        where: { availableSince: { gte: thisMonthStart } },
      })
      if (thisMonthShare) {
        await tx.adminProfitShare.delete({ where: { id: thisMonthShare.id } })
      }

      // Cap the previously active share at the last moment of the previous month
      const previousShare = await tx.adminProfitShare.findFirst({
        where: {
          availableSince: { lt: thisMonthStart },
          availableUntil: { gte: thisMonthStart },
        },
      })
      if (previousShare) {
        await tx.adminProfitShare.update({
          where: { id: previousShare.id },
          data: { availableUntil: prevMonthEnd },
        })
      }

      // Create the new share effective from the 1st of the current month
      return tx.adminProfitShare.create({
        data: {
          profitShare,
          availableSince: thisMonthStart,
          availableUntil: new Date('2099-12-31T23:59:59.999Z'),
        },
      })
    })

    res.json({
      ok: true,
      message: 'Admin profit share updated successfully',
      data: newAdminProfitShare,
    })
  } catch (error) {
    next(error)
  }
}

export async function makeAdminPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const amounts = req.body as { amount: number; period: Date }[]

    const userRole = (req as any).auth?.role

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const now = new Date()
    for (const { period } of amounts) {
      const periodDate = new Date(period)
      if (
        periodDate.getUTCFullYear() === now.getUTCFullYear() &&
        periodDate.getUTCMonth() === now.getUTCMonth()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Cannot register a payment for the current month as it has not ended yet',
        })
      }
    }

    const payments = await prisma.$transaction(async (tx) => {
      const createdPayments = []
      for (const { amount, period } of amounts) {
        const payment = await tx.adminPayment.create({
          data: {
            amount,
            period,
            status: 'completed',
          },
        })
        createdPayments.push(payment)
      }
      return createdPayments
    })

    res.json({ ok: true, message: 'Admin payment recorded successfully', data: payments })
  } catch (error) {
    next(error)
  }
}

export async function deleteAdminPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { period } = req.params
    const userRole = (req as any).auth?.role

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const periodParam = Array.isArray(period) ? period[0] : period

    await prisma.adminPayment.delete({
      where: { period: new Date(periodParam ?? '') },
    })

    res.json({ ok: true, message: 'Admin payment deleted successfully' })
  } catch (error) {
    next(error)
  }
}
