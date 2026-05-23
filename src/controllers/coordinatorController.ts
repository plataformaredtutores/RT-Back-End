import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { PaymentStatus } from '@prisma/client';

// Edit CoordinatorProfitShare
export async function editCoordinatorProfitShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { institutionId } = req.params;
    const { profitShare, coordinatorId } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (typeof profitShare !== 'number' || profitShare < 0 || profitShare > 100) {
      return res.status(400).json({ ok: false, message: 'Profit share must be a number between 0 and 100' });
    }

    const parsedInstitutionId = Number(institutionId)
    const parsedCoordinatorId = Number(coordinatorId)

    if (!Number.isFinite(parsedInstitutionId)) {
      return res.status(400).json({ ok: false, message: 'Institution ID is required' });
    }

    if (!Number.isFinite(parsedCoordinatorId)) {
      return res.status(400).json({ ok: false, message: 'Coordinator ID is required' });
    }

    // Profit shares align to month boundaries
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthEnd = new Date(thisMonthStart.getTime() - 1);

    const totalCoordinatorsCurrentProfitShare = await prisma.coordinatorProfitShare.aggregate({
      where: {
        institutionId: parsedInstitutionId,
        coordinatorId: {
          not: parsedCoordinatorId,
        },
        availableSince: { lte: thisMonthStart },
        availableUntil: { gte: thisMonthStart },
      },
      _sum: {
        profitShare: true,
      },
    })

    // The admin has variable profit share.
    const adminProfitShare = await prisma.adminProfitShare.findFirst({
      where: {
        availableSince: { lte: thisMonthStart },
        availableUntil: { gte: thisMonthStart },
      },
      select: {
        profitShare: true,
      },
    })

    
    const totalCurrentProfitShare = Number(totalCoordinatorsCurrentProfitShare._sum.profitShare || 0) + Number(adminProfitShare?.profitShare || 0)

    if (totalCurrentProfitShare + profitShare > 100) {
      return res.status(400).json({ ok: false, message: `Total profit share for the institution cannot exceed 100%. Current total excluding this coordinator: ${totalCurrentProfitShare}%` })
    }

    await prisma.$transaction(async (tx) => {
      // If a share already starts this month (repeated edit within same month), delete it so it
      // can be cleanly replaced — prevents stacking multiple shares in the same month.
      const thisMonthShare = await tx.coordinatorProfitShare.findFirst({
        where: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
          availableSince: { gte: thisMonthStart },
        },
      });
      if (thisMonthShare) {
        await tx.coordinatorProfitShare.delete({ where: { id: thisMonthShare.id } });
      }

      // Cap the previously active share at the last moment of the previous month
      const previousShare = await tx.coordinatorProfitShare.findFirst({
        where: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
          availableSince: { lt: thisMonthStart },
          availableUntil: { gte: thisMonthStart },
        },
      });
      if (previousShare) {
        await tx.coordinatorProfitShare.update({
          where: { id: previousShare.id },
          data: { availableUntil: prevMonthEnd },
        });
      }

      // Create the new share effective from the 1st of the current month
      await tx.coordinatorProfitShare.create({
        data: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
          profitShare,
          availableSince: thisMonthStart,
          availableUntil: new Date('2099-12-31T23:59:59.999Z'),
        },
      });
    });

    res.status(200).json({ ok: true, message: 'Coordinator profit share updated successfully' });
  } catch (err) {
    next(err);
  }
}

// Make coordinator payment
export async function makeCoordinatorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { institutionId } = req.params;
    const coordinatorId = req.body.coordinatorId;
    const amounts = req.body.payments as { amount: number, period: Date }[];
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const now = new Date();
    for (const { period } of amounts) {
      const periodDate = new Date(period);
      if (
        periodDate.getUTCFullYear() === now.getUTCFullYear() &&
        periodDate.getUTCMonth() === now.getUTCMonth()
      ) {
        return res.status(400).json({ ok: false, message: 'Cannot register a payment for the current month as it has not ended yet' });
      }
    }

    const parsedInstitutionId = Number(institutionId)
    const parsedCoordinatorId = Number(coordinatorId)

    if (!Number.isFinite(parsedInstitutionId)) {
      return res.status(400).json({ ok: false, message: 'Institution ID is required' });
    }

    if (!Number.isFinite(parsedCoordinatorId)) {
      return res.status(400).json({ ok: false, message: 'Coordinator ID is required' });
    }

    // Check if the coordinator is active to make the payment, if not, return an error
    const coordinator = await prisma.user.findUnique({
      where: { id: parsedCoordinatorId },
      select: { isActive: true, role: true },
    })

    if (!coordinator || coordinator.role !== 'coordinator') {
      return res.status(404).json({ ok: false, message: 'Coordinator not found' });
    }

    if (!coordinator.isActive) {
      return res.status(400).json({ ok: false, message: 'Coordinator is inactive' });
    }

    const payments = await prisma.$transaction(async (tx) => {
      const createdPayments = [];
      for (const { amount, period } of amounts) {
        const payment = await tx.coordinatorPayment.create({
          data: {
            coordinatorId: parsedCoordinatorId,
            institutionId: parsedInstitutionId,
            amount,
            period,
            status: PaymentStatus.completed
          }
        });
        createdPayments.push(payment);
      }
      return createdPayments;
    });

    res.status(201).json({ ok: true, message: 'Coordinator payment created successfully', payments  });
  } catch (err) {
    next(err);
  }
}

export async function deleteCoordinatorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, coordinatorId } = req.params;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const coordinatorIdParam = Array.isArray(coordinatorId) ? coordinatorId[0] : coordinatorId
    const periodParam = Array.isArray(period) ? period[0] : period

    const parsedCoordinatorId = Number(coordinatorIdParam);
    const parsedPeriod = new Date(periodParam ?? '');

    if (!Number.isFinite(parsedCoordinatorId)) {
      return res.status(400).json({ ok: false, message: 'Coordinator ID is required' });
    }

    if (Number.isNaN(parsedPeriod.getTime())) {
      return res.status(400).json({ ok: false, message: 'Invalid period' });
    }

    const result = await prisma.coordinatorPayment.deleteMany({
      where: {
        coordinatorId: parsedCoordinatorId,
        period: parsedPeriod,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ ok: false, message: 'Coordinator payment not found' });
    }

    res.status(200).json({ ok: true, message: 'Coordinator payment deleted successfully' });
  } catch (err) {
    next(err);
  }
}