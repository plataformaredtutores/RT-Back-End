import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'

export function authorize(allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as { role?: UserRole } | undefined
    if (!auth?.role || !allowed.includes(auth.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    next()
  }
}
