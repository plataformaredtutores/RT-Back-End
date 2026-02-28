import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Edit AdminProfitShare
export async function editAdminProfitShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { profitShare } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (typeof profitShare !== 'number' || profitShare < 0 || profitShare > 100) {
      return res.status(400).json({ ok: false, message: 'Profit share must be a number between 0 and 100' });
    }

    // Check for each institution if the new admin profit share combined with the current active coordinator profit shares doesn't exceed 100%
    const now = new Date();

    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true
      }
    });

    for (const institution of institutions) {
      // Sum active coordinator profit shares for this institution
      const activeCoordinatorShares = await prisma.coordinatorProfitShare.findMany({
        where: {
          institutionId: institution.id,
          availableUntil: { gt: now }
        }
      });

      const coordinatorTotal = activeCoordinatorShares.reduce(
        (sum, share) => sum + Number(share.profitShare),
        0
      );

      if (coordinatorTotal + profitShare > 100) {
        return res.status(400).json({
          ok: false,
          message: `The new admin profit share (${profitShare}%) combined with the current coordinator profit shares (${coordinatorTotal}%) exceeds 100% for institution "${institution.name}"`
        });
      }
    }

    // Use day boundaries so profit share transitions align with class dates (stored at midnight)
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const yesterdayEnd = new Date(todayStart.getTime() - 1) // last ms of yesterday

    // Use a transaction to deactivate the current profit share and create the new one
    const newAdminProfitShare = await prisma.$transaction(async (tx) => {
      // Find the single currently active admin profit share
      const currentActive = await tx.adminProfitShare.findFirst({
        where: {
          availableUntil: { gt: now }
        }
      });

      // Deactivate it by setting availableUntil to end of yesterday (avoids overlap with the new share)
      if (currentActive) {
        await tx.adminProfitShare.update({
          where: { id: currentActive.id },
          data: { availableUntil: yesterdayEnd }
        });
      }

      // Create the new admin profit share starting today (midnight), active until far in the future
      return tx.adminProfitShare.create({
        data: {
          profitShare,
          availableSince: todayStart,
          availableUntil: new Date('2099-12-31T23:59:59.999Z')
        }
      });
    });

    res.json({ ok: true, message: 'Admin profit share updated successfully', data: newAdminProfitShare });
  } catch (error) {
    next(error);
  }
}