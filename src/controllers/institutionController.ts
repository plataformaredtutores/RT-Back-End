import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

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