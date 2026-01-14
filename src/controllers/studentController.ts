import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Create a student
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

// Add a student to a guardian
export async function addStudentToGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, institutionId, guardianId } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Input validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Name is required and must be a non-empty string' });
    }

    if (!institutionId || typeof institutionId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Institution ID is required and must be a number' });
    }

    if (!guardianId || typeof guardianId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Guardian ID is required and must be a number' });
    }

    // Verify guardian exists and has the correct role
    const guardian = await prisma.user.findUnique({
      where: { id: guardianId },
    });

    if (!guardian || guardian.role !== 'guardian') {
      return res.status(404).json({ ok: false, message: 'Guardian not found' });
    }

    // Verify institution exists
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      return res.status(404).json({ ok: false, message: 'Institution not found' });
    }

    const student = await createStudent(name, institutionId, guardianId);

    res.status(201).json({ ok: true, student });

  } catch (err) {
    next(err);
  }
}

// Remove a student from a guardian
export async function removeStudentFromGuardian(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId, studentId } = req.body;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Input validation
    if (!guardianId || typeof guardianId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Guardian ID is required and must be a number' });
    }

    if (!studentId || typeof studentId !== 'number') {
      return res.status(400).json({ ok: false, message: 'Student ID is required and must be a number' });
    }

    // Verify student exists and is linked to the guardian
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.guardianId !== guardianId) {
      return res.status(404).json({ ok: false, message: 'Student not found for the specified guardian' });
    }

    // TODO: check if we delete or do a soft delete
    await prisma.student.delete({
      where: { id: studentId }
    });

    res.status(200).json({ ok: true, message: 'Student removed from guardian successfully' });

  } catch (err) {
    next(err);
  }
}

export async function getStudentsByGuardianId(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardianId } = req.params;
    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin' && userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const students = await prisma.student.findMany({
      where: { guardianId: Number(guardianId) },
    });

    res.status(200).json({ ok: true, students });
  } catch (err) {
    next(err);
  }
}