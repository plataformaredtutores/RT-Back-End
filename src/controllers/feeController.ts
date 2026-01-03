import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { Fee } from '@prisma/client';

// Get all active fees from an institution
export async function getFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { institutionId } = req.params;
    const userRole = (req as any).auth?.role;

    const fees = await prisma.fee.findMany({
      where: { institutionId: Number(institutionId) },
      orderBy: [
        { type: 'asc' },
        { numberOfStudents: 'asc' },
        { modality: 'asc' },
        { id: 'asc' },
      ],
    });
    const translatedFees = translateFees(fees);

    if (userRole === 'guardian') {
      // Return type, modality, numberOfStudents, guardianAmount
      const result = translatedFees.map(fee => ({
        type: fee.type,
        modality: fee.modality,
        numberOfStudents: fee.numberOfStudents,
        guardianAmount: fee.guardianAmount
      }));
      res.status(200).json(result);
    }
    else if (userRole === 'tutor') {
      // Return type, modality, numberOfStudents, tutorAmount
      const result = translatedFees.map(fee => ({
        type: fee.type,
        modality: fee.modality,
        numberOfStudents: fee.numberOfStudents,
        tutorAmount: fee.tutorAmount
      }));
      res.status(200).json(result);
    }
    else if (userRole === 'coordinator' || userRole === 'admin') {
      // Return type, modality, numberOfStudents, tutorAmount, guardianAmount
      res.status(200).json(translatedFees);
    }
    else {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
  } catch (err) {
    next(err);
  }
}

export async function editFees(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).auth?.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { fees } = req.body;
    const feesToUpdate = Array.isArray(fees) ? fees : [fees || req.body];

    const [hasError, errorResponse] = validateFeeUpdateInput(feesToUpdate);
    if (hasError) {
      return res.status(400).json(errorResponse);
    }

    await prisma.$transaction(
      feesToUpdate.map(fee =>
        prisma.fee.update({
          where: {
            id: Number(fee.feeId)
          },
          data: {
            tutorAmount: Number(fee.tutorAmount),
            guardianAmount: Number(fee.guardianAmount)
          }
        })
      )
    );

    return res.status(200).json({ 
      ok: true, 
      message: `${feesToUpdate.length} fee(s) updated successfully` 
    });

  } catch (err: any) {
    if (err.code === 'P2001') {
      return res.status(404).json({ ok: false, message: 'One or more fees not found' });
    }
    next(err);
  }
}

export async function simulateFeePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { fees, type, classModality, numberOfStudents, duration } = req.body;

    const userRole = (req as any).auth?.role;

    if (!fees || !Array.isArray(fees)) {
      return res.status(400).json({ ok: false, message: 'Fees list is required' });
    }

    const fee = findFeeByCriteria(fees, type, classModality, Number(numberOfStudents));
    if (!fee) {
      return res.status(404).json({ ok: false, message: 'Fee not found' });
    }

    const simulatedFeePayment = calculateFeeAmount(fee, Number(duration));

    if (userRole === 'guardian') {
      const result = simulatedFeePayment.guardianAmount
      res.status(200).json({ ok: true, result });
    } 
    else if (userRole === 'tutor') {
      const result = simulatedFeePayment.tutorAmount
      res.status(200).json({ ok: true, result });
    }
    else {
      const result = simulatedFeePayment
      res.status(200).json({ ok: true, result });
    }
  } catch (err) {
    next(err);
  }
}

// ############################################################
// #################### UTILITY FUNCTIONS #####################
// ############################################################

function validateFeeUpdateInput(fees: any[]): [boolean, { ok: boolean; message: string }] {
  if (!fees.length) {
    return [true, { ok: false, message: 'At least one fee is required' }];
  }

  for (const fee of fees) {
    if (!fee.feeId || fee.tutorAmount === undefined || fee.guardianAmount === undefined) {
      return [true, { 
        ok: false, 
        message: 'Each fee must have feeId, tutorAmount, and guardianAmount' 
      }];
    }
  }

  return [false, { ok: true, message: 'Fees validated successfully' }];
}

function findFeeByCriteria(
  fees: Fee[],
  type: string,
  classModality: string,
  numberOfStudents: number
): Fee | undefined {
  return fees.find(
    fee =>
      fee.type === type &&
      fee.modality === classModality &&
      fee.numberOfStudents === numberOfStudents
  );
}

function calculateFeeAmount(
  fee: Fee,
  duration: number
) {
  return {
    guardianAmount: fee.guardianAmount * Number(duration)/60,
    tutorAmount: fee.tutorAmount * Number(duration)/60
  };
}

function translateFees(fees: Fee[]) {
  return fees.map(fee => ({
    ...fee,
    modality: translateModality(fee.modality),
    type: translateType(fee.type)
  }));
}

function translateModality(modality: string): string {
  switch (modality) {
    case 'inPerson':
      return 'Presencial';
    case 'online':
      return 'Online';
    default:
      return modality;
  }
}

function translateType(type: string): string {
  switch (type) {
    case 'school':
      return 'Escolar';
    case 'university':
      return 'Universitaria';
    case 'cancelled':
      return 'Cancelada';
    default:
      return type;
  }
}