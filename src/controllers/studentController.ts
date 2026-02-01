import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

async function createStudent(name: string, institutionId: number, guardianId: number) {
  const student = await prisma.student.create({
    data: {
      name: name.trim(),
      guardianId,
      institutionId
    }
  });
  return student;
}

export async function addStudentToGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, institutionId, guardianId } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Name is required and must be a non-empty string' });
    }

    if (!institutionId || typeof institutionId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Institution ID is required and must be a number' });
    }

    if (!guardianId || typeof guardianId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Guardian ID is required and must be a number' });
    }

    const normalizedName = name.trim();

    // If a student with the same name exists for this guardian, reactivate instead of creating
    const existing = await prisma.student.findFirst({
      where: {
        guardianId,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.student.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        return res.status(200).json({ ok: true, student: reactivated, reactivated: true });
      }

      return res.status(200).json({ ok: true, student: existing, reactivated: false });
    }

    const student = await createStudent(normalizedName, institutionId, guardianId);

    res.status(201).json({ ok: true, student, reactivated: false });

  } catch (err) {
    next(err);
  }
}

export async function removeStudentFromGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId, studentId } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (!guardianId || typeof guardianId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Guardian ID is required and must be a number' });
    }

    if (!studentId || typeof studentId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Student ID is required and must be a number' });
    }

    const updateResult = await prisma.student.updateMany({
      where: {
        id: studentId,
        guardianId,
      },
      data: {
        isActive: false,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ ok: false, message: 'Student not found for the specified guardian' });
    }

    res.status(200).json({ ok: true, message: 'Student removed from guardian successfully' });

  } catch (err) {
    next(err);
  }
}

export async function getStudentsByGuardianId(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId } = req.params;
    const userRole = (req as any).auth?.role;
    const userId = (req as any).auth?.uid as number | undefined;
    const sendInactive = req.query.sendInactive === undefined
      ? true
      : req.query.sendInactive === 'true';

    if (!userRole) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const where: { guardianId: number; isActive?: boolean } = {
      guardianId: Number(guardianId),
    }

    if (userRole === 'guardian') {
      if (!userId || userId !== Number(guardianId)) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
      }
      where.isActive = true
    } else if (userRole === 'tutor') {
      if (!userId) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
      }

      const link = await prisma.guardianTutor.findFirst({
        where: {
          tutorId: Number(userId),
          guardianId: Number(guardianId),
          active: true,
        },
        select: { tutorId: true },
      })

      if (!link) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
      }

      where.isActive = true
    } else if (userRole === 'admin' || userRole === 'coordinator') {
      if (!sendInactive) {
        where.isActive = true
      }
    } else {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const students = await prisma.student.findMany({
      where,
    });

    res.status(200).json({ ok: true, students });
  } catch (err) {
    next(err);
  }
}

export async function reactivateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const studentId = Number(id);

    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (Number.isNaN(studentId)) {
      return res.status(400).json({ ok: false, message: 'Invalid student id' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { isActive: true },
    });

    res.status(200).json({ ok: true, message: 'Student reactivated successfully' });
  } catch (err) {
    next(err);
  }
}