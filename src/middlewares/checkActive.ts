import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'

export async function checkActive(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth
    
    if (!auth || !auth.sub) {
      return next()
    }

    if (auth.sub === 'swagger-dev') {
      return next()
    }
    const userId = (auth as any).uid
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return res.status(401).json({ ok: false, message: 'Invalid user ID' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true }
    })

    if (!user) {
      return res.status(401).json({ ok: false, message: 'User not found' })
    }

    if (!user.isActive) {
      return res.status(403).json({ ok: false, message: 'User account is inactive' })
    }

    next()
  } catch (err) {
    next(err)
  }
}
