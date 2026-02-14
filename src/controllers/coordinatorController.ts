import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

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

    const totalCoordinatorsCurrentProfitShare = await prisma.coordinatorProfitShare.aggregate({
      where: {
        institutionId: parsedInstitutionId,
        coordinatorId: { not: parsedCoordinatorId },
      },
      _sum: {
        profitShare: true,
      },
    })
    
    const totalCurrentProfitShare = 40 + Number(totalCoordinatorsCurrentProfitShare._sum.profitShare || 0)

    if (totalCurrentProfitShare + profitShare > 100) {
      return res.status(400).json({ ok: false, message: `Total profit share for the institution cannot exceed 100%. Current total excluding this coordinator: ${totalCurrentProfitShare}%` });
    }

    await prisma.coordinatorProfitShare.updateMany({
      where: {
      coordinatorId: parsedCoordinatorId,
      institutionId: parsedInstitutionId,
      availableUntil: {
        equals: await prisma.coordinatorProfitShare.findFirst({
        where: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
        },
        orderBy: {
          availableUntil: 'desc',
        },
        select: { availableUntil: true },
        }).then(res => res?.availableUntil),
      },
      },
      data: {
      availableUntil: new Date(), // Set available until to now to expire the current profit share
      },
    })

    // The profit to create is mean to last forever, but, it can be edited by creating a new one, and updating the previous one to expire when the new one is created, so, we set the available until to a far future date, but, we also need to set it to the end of the current month to avoid issues with the cash flow summary that is calculated month by month.

    await prisma.coordinatorProfitShare.create({
      data: {
        coordinatorId: parsedCoordinatorId,
        institutionId: parsedInstitutionId,
        profitShare,
        availableSince: new Date(),
        availableUntil: new Date(new Date().getFullYear()+237, new Date().getMonth(), 0) // Set available until the end of the current month
      },
    })

    res.status(200).json({ ok: true, message: 'Coordinator profit share updated successfully' });
  } catch (err) {
    next(err);
  }
}

// Make coordinator payment
export async function makeCoordinatorPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { institutionId } = req.params;
    const { coordinatorId, amount } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ ok: false, message: 'Amount must be a positive number' });
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

    const payment = await prisma.coordinatorPayment.create({
      data: {
        institutionId: parsedInstitutionId,
        coordinatorId: parsedCoordinatorId,
        amount,
        status: 'completed',
        period: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Set the period to the first day of the current month
      },
    })

    res.status(201).json({ ok: true, message: 'Coordinator payment created successfully', payment });
  } catch (err) {
    next(err);
  }
}

// TO DO: Cehck if there is a need for remove coordinator payment or change it to pending