import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import argon2 from 'argon2';
import { AccountType, UserRole } from '@prisma/client';

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      role = undefined,
      institutionId = undefined,
      nameOrEmail = undefined,
      page = 1, 
      pageSize = 10
    } = _req.query

    const users = await prisma.user.findMany({
      where: {
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

    if (role !== 'admin' && institutionId == null) {
      return res.status(400).json({
        ok: false,
        message: 'Non-admin users must be associated with an institution.'
      })
    }

    if (role === 'parent' && BankAccount) {
      return res.status(400).json({
        ok: false,
        message: 'Parent users cannot have bank account information.'
      })
    }

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
        institutionId
      }
    })

    if (BankAccount) {
      const {
        bankName,
        accountType,
        accountNumber,
        rutHolder,
        accountEmail
      } = BankAccount

      await prisma.userBankAccount.create({
        data: {
          userId: newUser.id,
          bankName,
          accountType,
          accountNumber,
          rutHolder: rutHolder || rut,
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
    
    const userId = Number(id)
    await prisma.user.delete({
      where: { id: userId }
    });
    
    res.status(204).send();
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
            Parent: true
          }
        },
        ParentLinks: {
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
    res.json(user)
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
      rutHolder,
      accountEmail
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
        rutHolder,
        accountEmail
      },
      update: {
        bankName,
        accountType: accountType as AccountType,
        accountNumber,
        rutHolder,
        accountEmail
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
