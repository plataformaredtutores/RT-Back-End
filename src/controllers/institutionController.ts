import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { UserRole } from '@prisma/client'

export async function createInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body

    const institution = await prisma.institution.create({
      data: { name },
    })

    const baseFees = await prisma.fee.findMany({
      where: {
        institutionId: process.env.DEFAULT_INSTITUTION_ID
          ? Number(process.env.DEFAULT_INSTITUTION_ID)
          : 49,
      },
      select: {
        type: true,
        modality: true,
        numberOfStudents: true,
        tutorAmount: true,
        guardianAmount: true,
      },
      orderBy: [{ type: 'asc' }, { modality: 'asc' }, { numberOfStudents: 'asc' }],
    })

    const feeData = baseFees.map((fee) => ({
      ...fee,
      institutionId: institution.id,
    }))

    if (feeData.length > 0) {
      await prisma.fee.createMany({ data: feeData })
    }

    const fees = await prisma.fee.findMany({
      where: { institutionId: institution.id },
      orderBy: [{ type: 'asc' }, { modality: 'asc' }, { numberOfStudents: 'asc' }],
    })

    res.status(201).json({ institution, fees })
  } catch (err) {
    next(err)
  }
}

export async function getInstitutions(req: Request, res: Response, next: NextFunction) {
  try {
    const sendInactive =
      req.query.sendInactive === undefined ? true : req.query.sendInactive === 'true'

    const institutions = await prisma.institution.findMany({
      where: sendInactive ? undefined : { isActive: true },
    })
    res.json(institutions)
  } catch (err) {
    next(err)
  }
}

export async function getGuardiansFromInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { institutionId } = req.params

    const guardians = await prisma.user.findMany({
      where: {
        institutionId: Number(institutionId),
        role: UserRole.guardian,
      },
      select: {
        id: true,
        name: true,
        Students: {
          select: {
            id: true,
            name: true,
          },
        },
        GuardianLinks: {
          select: {
            tutorId: true,
            Tutor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
    res.json(guardians)
  } catch (err) {
    next(err)
  }
}

export async function deactivateInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const institutionId = Number(id)

    if (Number.isNaN(institutionId)) {
      return res.status(400).json({ ok: false, message: 'Invalid institution id' })
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, createdAt: true },
    })

    if (!institution) {
      return res.status(404).json({ ok: false, message: 'Institution not found' })
    }

    const usersCount = await prisma.user.count({ where: { institutionId } })

    if (usersCount === 0) {
      await prisma.institution.update({
        where: { id: institutionId },
        data: { isActive: false },
      })

      return res.status(200).json({ ok: true, message: 'Sede desactivada correctamente' })
    }

    // Check class payments from the last 24 completed months (exclude current month)
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const last24MonthsStart = new Date(now.getFullYear(), now.getMonth() - 24, 1)
    const effectiveStartDate = new Date(
      Math.max(last24MonthsStart.getTime(), institution.createdAt.getTime()),
    )

    const recentClassPayments = await prisma.classPayment.findMany({
      where: {
        Class: {
          institutionId,
          date: {
            gte: effectiveStartDate,
            lt: currentMonthStart,
          },
        },
      },
      select: {
        tutorPaymentStatus: true,
        guardianPaymentStatus: true,
      },
    })

    const hasPendingClassPayments = recentClassPayments.some(
      (p) => p.tutorPaymentStatus === 'pending' || p.guardianPaymentStatus === 'pending',
    )

    if (hasPendingClassPayments) {
      return res.status(400).json({
        ok: false,
        message:
          'No se puede desactivar la sede: existen pagos de clases pendientes en los últimos 24 meses.',
      })
    }

    // Check coordinator payments for the last 24 completed months: every month must exist and be completed
    const months: Array<{ year: number; month: number }> = []
    const earliestMonth = new Date(
      institution.createdAt.getFullYear(),
      institution.createdAt.getMonth(),
      1,
    )
    for (let i = 1; i <= 24; i++) {
      const dt = new Date(now)
      dt.setMonth(now.getMonth() - i)
      const monthStart = new Date(dt.getFullYear(), dt.getMonth(), 1)
      if (monthStart < earliestMonth) break
      months.push({ year: dt.getFullYear(), month: dt.getMonth() + 1 })
    }

    const coordinatorPayments = await prisma.coordinatorPayment.findMany({
      where: {
        institutionId,
        period: {
          gte: new Date(now.getFullYear(), now.getMonth() - 24, 1),
          lt: currentMonthStart,
        },
      },
      select: {
        period: true,
        status: true,
      },
    })

    const paymentMap = new Map<string, 'pending' | 'completed'>()
    coordinatorPayments.forEach((p) => {
      paymentMap.set(`${p.period.getFullYear()}-${p.period.getMonth() + 1}`, p.status)
    })

    const missingOrPendingCoordinatorPayments = months.some((m) => {
      const key = `${m.year}-${m.month}`
      const status = paymentMap.get(key)
      // Missing is considered pending
      if (!status) return true
      return status === 'pending'
    })

    if (missingOrPendingCoordinatorPayments) {
      return res.status(400).json({
        ok: false,
        message:
          'No se puede desactivar la sede: existen pagos de coordinador pendientes o faltantes en los últimos 24 meses.',
      })
    }

    // Soft-delete institution
    await prisma.user.updateMany({
      where: { institutionId },
      data: { isActive: false },
    })

    await prisma.institution.update({
      where: { id: institutionId },
      data: { isActive: false },
    })

    res.status(200).json({ ok: true, message: 'Sede desactivada correctamente' })
  } catch (err) {
    next(err)
  }
}

export async function searchInstitutions(req: Request, res: Response, next: NextFunction) {
  try {
    const { query } = req.query

    const userRole = (req as any).auth?.role

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, message: 'Search query is required' })
    }

    const institutions = await prisma.institution.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    res.json(institutions)
  } catch (err) {
    next(err)
  }
}

export async function reactivateInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const institutionId = Number(id)

    if (Number.isNaN(institutionId)) {
      return res.status(400).json({ ok: false, message: 'Invalid institution id' })
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true },
    })

    if (!institution) {
      return res.status(404).json({ ok: false, message: 'Institution not found' })
    }

    await prisma.institution.update({
      where: { id: institutionId },
      data: { isActive: true },
    })

    await prisma.user.updateMany({
      where: { institutionId },
      data: { isActive: true },
    })

    res.status(200).json({ ok: true, message: 'Institution reactivated successfully' })
  } catch (err) {
    next(err)
  }
}

export async function getInstitutionDeletionOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params
    const institutionId = Number(id)

    if (Number.isNaN(institutionId)) {
      return res.status(400).json({ ok: false, message: 'Invalid institution id' })
    }

    const classesCount = await prisma.class.count({ where: { institutionId } })

    res.status(200).json({ ok: true, canHardDelete: classesCount === 0 })
  } catch (err) {
    next(err)
  }
}

export async function deleteInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const institutionId = Number(id)

    if (Number.isNaN(institutionId)) {
      return res.status(400).json({ ok: false, message: 'Invalid institution id' })
    }

    const classesCount = await prisma.class.count({ where: { institutionId } })
    if (classesCount > 0) {
      return res.status(400).json({
        ok: false,
        message: 'No se puede borrar permanentemente una sede con clases asociadas.',
      })
    }

    const usersToDelete = await prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [UserRole.coordinator, UserRole.guardian, UserRole.tutor] },
      },
      select: { id: true },
    })

    const userIds = usersToDelete.map((u) => u.id)

    await prisma.$transaction([
      prisma.classPayment.deleteMany({ where: { Class: { institutionId } } }),
      prisma.class.deleteMany({ where: { institutionId } }),
      prisma.student.deleteMany({ where: { institutionId } }),
      prisma.guardianTutor.deleteMany({ where: { institutionId } }),
      prisma.coordinatorPayment.deleteMany({ where: { institutionId } }),
      prisma.coordinatorProfitShare.deleteMany({ where: { institutionId } }),
      prisma.fee.deleteMany({ where: { institutionId } }),
      ...(userIds.length > 0
        ? [
            prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
            prisma.userBankAccount.deleteMany({ where: { userId: { in: userIds } } }),
            prisma.user.deleteMany({ where: { id: { in: userIds } } }),
          ]
        : []),
      prisma.institution.delete({ where: { id: institutionId } }),
    ])

    res.status(200).json({ ok: true, message: 'Sede eliminada permanentemente' })
  } catch (err) {
    next(err)
  }
}
