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

    // New admin share becomes active on the next day at 00:00:00.000 UTC.
    // Current admin share remains active through today (until 23:59:59.999 UTC).
    const now = new Date();
    const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
    const nextDayStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true
      }
    });

    for (const institution of institutions) {
      // Sum coordinator profit shares active at the new admin share effective timestamp
      const activeCoordinatorShares = await prisma.coordinatorProfitShare.findMany({
        where: {
          institutionId: institution.id,
          availableSince: { lte: nextDayStartUtc },
          availableUntil: { gte: nextDayStartUtc }
        }
      });

      const coordinatorTotal = activeCoordinatorShares.reduce(
        (sum, share) => sum + Number(share.profitShare),
        0
      );

      if (coordinatorTotal + profitShare > 100) {
        return res.status(400).json({
          ok: false,
          message: `El porcentaje excede el 100% con la institución "${institution.name}"`
        });
      }
    }

    // Use a transaction to deactivate the current active share and create the new one
    const newAdminProfitShare = await prisma.$transaction(async (tx) => {
      // Find the single active share at the new effective timestamp
      const currentActive = await tx.adminProfitShare.findFirst({
        where: {
          availableSince: { lte: nextDayStartUtc },
          availableUntil: { gte: nextDayStartUtc }
        }
      });

      // Deactivate it at end of today so today keeps current percentage
      if (currentActive) {
        await tx.adminProfitShare.update({
          where: { id: currentActive.id },
          data: { availableUntil: todayEndUtc }
        });
      }

      // Create the new admin profit share effective from tomorrow at 00:00:00.000 UTC
      return tx.adminProfitShare.create({
        data: {
          profitShare,
          availableSince: nextDayStartUtc,
          availableUntil: new Date('2099-12-31T23:59:59.999Z')
        }
      });
    });

    res.json({ ok: true, message: 'Admin profit share updated successfully', data: newAdminProfitShare });
  } catch (error) {
    next(error);
  }
}