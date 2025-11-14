import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import argon2 from 'argon2';
import { UserRole } from '@prisma/client';

// Get a list of users with optional filtering, sorting, and pagination
export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      role = undefined,
      institutionId = undefined,
      nameOrEmail = undefined,
      page = 1, 
      pageSize = 10
    } = _req.query;

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
    });
    res.json(users);
  } catch (err) {
    next(err);
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
      : undefined;

    if (!password) {
      return res.status(400).json({
        ok: false,
        message: 'RUT not provided or invalid, cannot generate password.'
      });
    }

    const hashedPassword = await argon2.hash(password, {
      secret: Buffer.from(process.env.ARGON2_SECRET_PEPPER || '', 'base64')
    });

    if (role !== 'admin' && institutionId == null) {
      return res.status(400).json({
        ok: false,
        message: 'Non-admin users must be associated with an institution.'
      });
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
    });

    if (BankAccount && (role !== 'tutor' || role !== 'parent')) {
      return res.status(400).json({
        ok: false,
        message: 'Only tutors and parents can have bank account information.'
      });
    }

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
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
}
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const userId = Number(id);
    await prisma.user.delete({
      where: { id: userId }
    });
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}