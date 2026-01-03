import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { userInfo } from 'os';

export async function createInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    
    const newInstitution = await prisma.institution.create({
      data: {
        name
      }
    });
    res.status(201).json(newInstitution);
  }
  catch (err) {
    next(err);
  }
}
export async function getInstitutions(_req: Request, res: Response, next: NextFunction) {
  try {
    const institutions = await prisma.institution.findMany();
    res.json(institutions);
  } catch (err) {
    next(err);
  }
}

export async function deleteInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('TODO: delete institution');
    res.status(200).json({ ok: true, message: 'TODO: delete institution' });
  }
  catch (err) {
    next(err);
  }
}

export async function searchInstitutions(req: Request, res: Response, next: NextFunction) {
  try {
    const { query } = req.query;

    const userRole = (req as any).auth?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, message: 'Search query is required' });
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
    });

    res.json(institutions);
  } catch (err) {
    next(err);
  }
}