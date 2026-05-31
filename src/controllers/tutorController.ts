import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { PaymentStatus } from '@prisma/client'

export async function createGuardianTutorLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId, tutorId, institutionId } = req.body
    const userRole = (req as any).auth?.role

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const parsedGuardianId = Number(guardianId)
    const parsedTutorId = Number(tutorId)
    const parsedInstitutionId = Number(institutionId)

    if (!Number.isFinite(parsedGuardianId) || !Number.isFinite(parsedTutorId)) {
      return res.status(400).json({ ok: false, message: 'Guardian ID and Tutor ID are required' })
    }

    if (!Number.isFinite(parsedInstitutionId)) {
      return res.status(400).json({ ok: false, message: 'Institution ID is required' })
    }

    if (userRole === 'coordinator') {
      const coordinatorInstitutionId = (req as any).auth?.institutionId
      if (!coordinatorInstitutionId || Number(coordinatorInstitutionId) !== parsedInstitutionId) {
        return res.status(403).json({
          ok: false,
          message: 'Coordinators can only manage links for their institution.',
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
    const { tutorId } = req.params
    const { periodStart, periodEnd, status } = req.body
    const userRole = (req as any).auth?.role

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const parsedTutorId = Number(tutorId)

    if (!Number.isFinite(parsedTutorId)) {
      return res.status(400).json({ ok: false, message: 'Tutor ID is required' })
    }

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ ok: false, message: 'Invalid periodStart or periodEnd format' })
    }

    if (status === PaymentStatus.completed) {
      const rangeStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
      const rangeEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1))
      const currentMonthStart = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
      )
      const nextMonthStart = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
      )

      const includesCurrentMonth = rangeStart < nextMonthStart && rangeEnd > currentMonthStart

      if (includesCurrentMonth) {
        return res
          .status(400)
          .json({ ok: false, message: 'No se puede pagar el mes en curso a un tutor' })
      }
    }

    const updatedPayments = await prisma.classPayment.updateMany({
      where: {
        Class: {
          tutorId: parsedTutorId,
          date: {
            gte: new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)),
            lt: new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1)),
          },
        },
      },
      data: {
        tutorPaymentStatus: status,
      },
    })

    res.status(200).json({ ok: true, updated: updatedPayments.count })
  } catch (err) {
    next(err)
  }
}

export async function removeGuardianTutorLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId, tutorId, institutionId } = req.body
    const userRole = (req as any).auth?.role

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    const parsedGuardianId = Number(guardianId)
    const parsedTutorId = Number(tutorId)
    const parsedInstitutionId = Number(institutionId)

    if (!Number.isFinite(parsedGuardianId) || !Number.isFinite(parsedTutorId)) {
      return res.status(400).json({ ok: false, message: 'Guardian ID and Tutor ID are required' })
    }

    if (!Number.isFinite(parsedInstitutionId)) {
      return res.status(400).json({ ok: false, message: 'Institution ID is required' })
    }

    if (userRole === 'coordinator') {
      const coordinatorInstitutionId = (req as any).auth?.institutionId

      if (!coordinatorInstitutionId || Number(coordinatorInstitutionId) !== parsedInstitutionId) {
        return res.status(403).json({
          ok: false,
          message: 'Coordinators can only manage links for their institution.',
        })
      }
    }

    const updated = await prisma.guardianTutor.delete({
      where: {
        guardianId_tutorId_institutionId: {
          guardianId: parsedGuardianId,
          tutorId: parsedTutorId,
          institutionId: parsedInstitutionId,
        },
      },
    })
    return res.status(200).json({ ok: true, link: updated })
  } catch (err) {
    next(err)
  }
}
