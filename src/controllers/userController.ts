import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import argon2 from 'argon2';
import { AccountType, PrismaClient, UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { userInfo } from 'os';
import { unknown } from 'zod';

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      role = undefined,
      institutionId = undefined,
      nameOrEmail = undefined,
      page = 1, 
      pageSize = 10
    } = _req.query

    const sendInactive = _req.query.sendInactive === undefined
      ? true
      : _req.query.sendInactive === 'true'

    const users = await prisma.user.findMany({
      where: {
        isActive: sendInactive ? undefined : true,
        role: role as UserRole | undefined,
        institutionId: institutionId ? Number(institutionId) : undefined,
        OR: nameOrEmail ? [
          { name: { contains: String(nameOrEmail), mode: 'insensitive' } },
          { email: { contains: String(nameOrEmail), mode: 'insensitive' } }
        ] : undefined
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      include: {
        Institution: true
      }
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      role,
      name,
      email,
      rut,
      phone,
      address,
      chargeEmail,
      institutionId,
      BankAccount
    } = req.body

    const userRole = (req as any).auth?.role;

    /*     
    if (userRole !== 'admin' || userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    }
    if (userRole === 'coordinator' && (role === 'admin' || role === 'coordinator')) {
      return res.status(403).json({ ok: false, message: 'Coordinators cannot create admin or coordinator users.' })
    } */

    // Input Validation

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Name is required and must be a non-empty string' });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Email is required and must be a non-empty string' });
    }

    if (!rut || typeof rut !== 'string' || rut.trim() === '') {
      return res.status(400).json({ ok: false, message: 'RUT is required and must be a non-empty string' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ ok: false, message: 'Invalid email format' });
    }

    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.trim() === '')) {
      return res.status(400).json({ ok: false, message: 'Phone must be a non-empty string if provided' });
    }

    if (address !== undefined && address !== null && (typeof address !== 'string' || address.trim() === '')) {
      return res.status(400).json({ ok: false, message: 'Address must be a non-empty string if provided' });
    }

    if (chargeEmail !== undefined && chargeEmail !== null) {
      if (typeof chargeEmail !== 'string' || chargeEmail.trim() === '') {
        return res.status(400).json({ ok: false, message: 'Charge email must be a non-empty string if provided' });
      }
      if (!emailRegex.test(chargeEmail.trim())) {
        return res.status(400).json({ ok: false, message: 'Invalid charge email format' });
      }
    }


    if (role !== 'admin' && institutionId == null) {
      return res.status(400).json({
        ok: false,
        message: 'Non-admin users must be associated with an institution.'
      })
    }

    if (role === 'guardian' && BankAccount) {
      return res.status(400).json({
        ok: false,
        message: 'Guardian users cannot have bank account information.'
      })
    }

    let finalInstitutionId: number = institutionId;

    if (userRole === 'coordinator') {
      const coordinatorInstitutionId = (req as any).auth?.institutionId;
      finalInstitutionId = coordinatorInstitutionId;
    }

    const password = rut != null
      ? String(rut).split('-')[0].replace(/\D/g, '')
      : undefined

    if (!password) {
      return res.status(400).json({
        ok: false,
        message: 'RUT not provided or invalid, cannot generate password.'
      })
    }

    const hashedPassword = await argon2.hash(password, {
      secret: Buffer.from(process.env.ARGON2_SECRET_PEPPER || '', 'base64')
    })

    const newUser = await prisma.user.create({
      data: {
        role,
        name,
        email,
        rut,
        phone,
        address,
        chargeEmail,
        hashedPassword,
        institutionId: finalInstitutionId
      }
    })

    if (BankAccount) {
      const {
        bankName,
        accountType,
        accountNumber,
        rutHolder,
        accountEmail,
        accountName
      } = BankAccount

      await prisma.userBankAccount.create({
        data: {
          userId: newUser.id,
          bankName,
          accountType,
          accountNumber,
          accountName,
          rut: rutHolder || rut,
          accountEmail: accountEmail || email
        }
      });
    }
    // Then: Send email with credentials (omitted for now)
    res.status(201).json(newUser)
  } catch (err) {
    next(err)
  }
}
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const userRole = (req as any).auth?.role;

/*     if (userRole !== 'admin' || userRole !== 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Forbidden' })
    } */
    
    
    
    const userId = Number(id)
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' })
    }

    if (userRole === 'coordinator' && user.role === 'admin' || user.role === 'coordinator') {
      return res.status(403).json({ ok: false, message: 'Coordinators cannot delete admin or coordinator users.' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    
    res.status(204).send();
  } catch (err) {
    next(err)
  }
}

export async function reactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const userRole = (req as any).auth?.role;

    const userId = Number(id)
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' })
    }

    if (userRole === 'coordinator' && (user.role === 'admin' || user.role === 'coordinator')) {
      return res.status(403).json({ ok: false, message: 'Coordinators cannot reactivate admin or coordinator users.' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true }
    })

    res.status(200).json({ ok: true, message: 'User reactivated successfully' })
  } catch (err) {
    next(err)
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    
    const userId = Number(id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        // scalar fields
        id: true,
        role: true,
        email: true,
        name: true,
        rut: true,
        phone: true,
        address: true,
        chargeEmail: true,
        institutionId: true,
        // relations
        Institution: true,
        BankAccount: true,
        Students: true,
        TutorLinks: {
          include: {
            Guardian: true
          }
        },
        GuardianLinks: {
          include: {
            Tutor: true
          }
        },
        // note: hashedPassword is omitted intentionally to exclude it
      }
    })
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'User not found.'
      });
    }

    const response = { ...user } as typeof user & { coordinatorProfitShare?: number }
    // Only return active students for guardians and tutors
    if (user.role === 'guardian' || user.role === 'tutor') {
      response.Students = (response.Students ?? []).filter((s: any) => s?.isActive !== false)
    }

    if (user.role === 'coordinator' && user.institutionId) {
      const profit = await prisma.coordinatorProfitShare.findUnique({
        where: {
          coordinatorId_institutionId: {
            coordinatorId: Number(user.id),
            institutionId: Number(user.institutionId)
          }
        },
        select: {
          profitShare: true
        }
      })
      if (profit) {
        response.coordinatorProfitShare = Number(profit.profitShare)
      }
    }

    res.json(response)
  } catch (err) {
    next(err)
  }
}

export async function editUserBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      bankName,
      accountType,
      accountNumber,
      rut,
      accountEmail,
      accountName
    } = req.body

    const userId = Number(id)
    
    if (!accountType || !Object.values(AccountType).includes(accountType as AccountType)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid account type.'
      })
    }
    const account = await prisma.userBankAccount.upsert({
      where: { userId },
      create: {
        userId,
        bankName,
        accountType: accountType as AccountType,
        accountNumber,
        accountName,
        rut,
        accountEmail
      },
      update: {
        bankName,
        accountType: accountType as AccountType,
        accountNumber,
        rut,
        accountEmail,
        accountName
      }
    })

    res.json(account)
  } catch (err) {
    next(err)
  }
}
export async function editUserPersonalInformation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      name,
      rut,
      phone,
      chargeEmail,
      address
    } = req.body

    const userResponse = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        name,
        rut,
        phone,
        chargeEmail,
        address
      },
    })
    
    res.json(userResponse)
  } catch (err) {
    next(err)
  }
}

export async function changeUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { currentPassword, newPassword } = req.body

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: Number(id) },
      select: { hashedPassword: true }
    })

    const isPasswordValid = await argon2.verify(user.hashedPassword, currentPassword, {
      secret: Buffer.from((process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, ''), 'base64')
    })
    if (!isPasswordValid) {
      return res.status(401).json({ ok: false, message: 'Current password is incorrect' })
    }

    const newHashedPassword = await argon2.hash(newPassword, {
      secret: Buffer.from((process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, ''), 'base64')
    })

    await prisma.user.update({
      where: { id: Number(id) },
      data: { hashedPassword: newHashedPassword }
    })

    res.status(200).json({ ok: true, message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

export async function getTutorLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const tutorLinks = await prisma.guardianTutor.findMany({
      where: { tutorId: Number(id) },
      include: {
        Guardian: {
          select: {
            id: true,
            name: true,
            Students: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!tutorLinks) {
      return res.status(404).json({
        ok: false,
        message: 'No tutor links found for this tutor.'
      })
    }

    res.json(tutorLinks)
  } catch (err: PrismaClientKnownRequestError | any) {
    next(err)
  }
}

export async function getGuardianLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const guardianLinks = await prisma.guardianTutor.findMany({
      where: { guardianId: Number(id) },
      include: {
        Tutor: {
          select: {
            id: true,
            name: true,
            Students: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!guardianLinks) {
      return res.status(404).json({
        ok: false,
        message: 'No guardian links found for this guardian.'
      })
    }

    res.json(guardianLinks)
  } catch (err: PrismaClientKnownRequestError | any) {
    next(err)
  }
}