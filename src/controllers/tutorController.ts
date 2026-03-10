import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PaymentStatus } from '@prisma/client';

export async function createGuardianTutorLink(req: Request, res: Response, next: NextFunction) {
    try {
        const { guardianId, tutorId, institutionId } = req.body;
        const userRole = (req as any).auth?.role;

        if (userRole !== 'admin' && userRole !== 'coordinator') {
            return res.status(403).json({ ok: false, message: 'Forbidden' });
        }

        const parsedGuardianId = Number(guardianId)
        const parsedTutorId = Number(tutorId)
        const parsedInstitutionId = Number(institutionId)

        if (!Number.isFinite(parsedGuardianId) || !Number.isFinite(parsedTutorId)) {
            return res.status(400).json({ ok: false, message: 'Guardian ID and Tutor ID are required' });
        }

        if (!Number.isFinite(parsedInstitutionId)) {
            return res.status(400).json({ ok: false, message: 'Institution ID is required' });
        }

        if (userRole === 'coordinator') {
            const coordinatorInstitutionId = (req as any).auth?.institutionId
            if (!coordinatorInstitutionId || Number(coordinatorInstitutionId) !== parsedInstitutionId) {
                return res.status(403).json({
                    ok: false,
                    message: 'Coordinators can only manage links for their institution.'
                })
            }
        }

        const created = await prisma.guardianTutor.create({
            data: {
                guardianId: parsedGuardianId,
                tutorId: parsedTutorId,
                institutionId: parsedInstitutionId,
                active: true,
            },
        })

        return res.status(201).json({ ok: true, link: created })
    } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
            return res.status(409).json({ ok: false, message: 'Guardian tutor link already exists' })
        }
        next(err)
    }
}

export async function editTutorPaymentsFromPeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const { tutorId } = req.params;
    const { period, status } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
        return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const parsedTutorId = Number(tutorId)
    
    if (!Number.isFinite(parsedTutorId)) {
        return res.status(400).json({ ok: false, message: 'Tutor ID is required' })
    }

    // A period represents the month for the payments
    // For example, if the period is 2024-01-01, it means that we want to edit the payments from 01-01-2024 to 31-01-2024 (first to last moment of the month)
    const periodDate = new Date(period);
    if (isNaN(periodDate.getTime())) {
        return res.status(400).json({ ok: false, message: 'Invalid period format' })
     }


    const updatedPayments = await prisma.classPayment.updateMany({
      where: {
        Class: {
          tutorId: parsedTutorId,
          date: {
            gte: new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), 1)),
            lt: new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 1)),
          },
        },
      },
      data: {
        tutorPaymentStatus: status,
      },
    });

    res.status(200).json({ ok: true, updated: updatedPayments.count });
  } catch (err) {
    next(err)
  }
}