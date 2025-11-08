import { Request, Response, NextFunction } from 'express'
import { getJose } from '../lib/jose'

function b64ToKey(b64?: string) {
  const raw = b64 || ''
  return raw.startsWith('base64:') ? Buffer.from(raw.slice(7), 'base64') : Buffer.from(raw, 'base64')
}
const JWT_SECRET = b64ToKey(process.env.JWT_SECRET)

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : undefined
    const cookieToken = (req as any).cookies?.access_token as string | undefined
    const token = bearer || cookieToken
    if (!token) return res.status(401).json({ message: 'Unauthorized' })

  const { jwtVerify } = await getJose()
  const { payload } = await jwtVerify(token, JWT_SECRET)
    ;(req as any).auth = payload
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}