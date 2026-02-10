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

    const existing = await prisma.coordinatorProfitShare.findUnique({
      where: {
        coordinatorId_institutionId: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
        },
      },
      select: { id: true },
    })

    if (!existing) {
      return res.status(404).json({
        ok: false,
        message: 'Coordinator profit share not found for this institution.',
      })
    }

    await prisma.coordinatorProfitShare.update({
      where: {
        coordinatorId_institutionId: {
          coordinatorId: parsedCoordinatorId,
          institutionId: parsedInstitutionId,
        },
      },
      data: {
        profitShare,
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

    const now = new Date()
    const payment = await prisma.coordinatorPayment.create({
      data: {
        institutionId: parsedInstitutionId,
        coordinatorId: parsedCoordinatorId,
        amount,
        status: 'completed',
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
      },
    })

    res.status(201).json({ ok: true, message: 'Coordinator payment created successfully', payment });
  } catch (err) {
    next(err);
  }
}

// TO DO: Cehck if there is a need for remove coordinator payment or change it to pending