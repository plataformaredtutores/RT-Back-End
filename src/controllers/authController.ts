import { Request, Response } from 'express'
import argon2 from 'argon2'
import { getJose } from '../lib/jose'
import prisma from '../lib/prisma'
import { randomToken, hashToken, verifyTokenHash } from '../lib/tokens'
import { sendEmail } from '../services/mailService'

function isHttpsUrl(url?: string) {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function isRequestSecure(req: Request) {
  if ((req as any).secure) return true
  const xfProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase()
  return xfProto === 'https'
}

function getCookieSecurity(req: Request) {
  const isProd = process.env.NODE_ENV === 'production'
  const frontendUrl = process.env.FRONTEND_URL
  const secureFromEnv = process.env.COOKIE_SECURE
  const secure =
    secureFromEnv === 'true'
      ? true
      : secureFromEnv === 'false'
        ? false
        : isRequestSecure(req) || (isProd && isHttpsUrl(frontendUrl))

  const sameSiteFromEnv = (process.env.COOKIE_SAMESITE || '').toLowerCase()
  const sameSite =
    sameSiteFromEnv === 'lax'
      ? ('lax' as const)
      : sameSiteFromEnv === 'strict'
        ? ('strict' as const)
        : sameSiteFromEnv === 'none'
          ? ('none' as const)
          : secure
            ? ('none' as const)
            : ('lax' as const)

  return { secure, sameSite }
}

function getCookieBaseOptions(req: Request) {
  const { secure, sameSite } = getCookieSecurity(req)
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined
  return {
    httpOnly: true,
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
    path: '/',
  }
}

function shouldIncludeAccessTokenInBody(req: Request) {
  // Useful as a Safari fallback when cookies are blocked (e.g., third‑party cookie restrictions).
  // Client can then send `Authorization: Bearer <token>` (supported by requireAuth middleware).
  const q = req.query as any
  const fromQuery = q?.includeToken === 'true' || q?.include_token === 'true'
  const fromHeader = (req.header('x-auth-token-in-body') || '').toLowerCase() === 'true'
  const fromEnv = (process.env.AUTH_TOKEN_IN_BODY || '').toLowerCase() === 'true'
  return Boolean(fromQuery || fromHeader || fromEnv)
}

function parseRefreshCookie(presented: string): { id?: string; raw: string } {
  const dot = presented.indexOf('.')
  if (dot <= 0) return { raw: presented }
  const id = presented.slice(0, dot)
  const raw = presented.slice(dot + 1)
  if (!id || !raw) return { raw: presented }
  return { id, raw }
}

function b64ToKey(b64?: string) {
  const raw = b64 || ''
  return raw.startsWith('base64:')
    ? Buffer.from(raw.slice(7), 'base64')
    : Buffer.from(raw, 'base64')
}
const JWT_SECRET = b64ToKey(process.env.JWT_SECRET)

function cookieOptsAT(req: Request) {
  return {
    ...getCookieBaseOptions(req),
    maxAge: 30 * 60 * 1000, // 30 minutes
  }
}

function cookieOptsRT(req: Request) {
  return {
    ...getCookieBaseOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      hashedPassword: true,
      role: true,
      email: true,
      name: true,
      institutionId: true,
      isActive: true,
    },
  })

  if (user && !user?.isActive) {
    return res
      .status(403)
      .json({ ok: false, message: 'Account is inactive. Please contact support.' })
  }
  if (!user) return res.status(401).json({ ok: false, message: 'Invalid credentials' })

  const pepper = (process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, '')
  const isPasswordValid = await argon2.verify(user.hashedPassword, password, {
    secret: Buffer.from(pepper, 'base64'),
  })
  if (!isPasswordValid) return res.status(401).json({ ok: false, message: 'Invalid credentials' })

  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revoked: false },
    data: { revoked: true },
  })

  const refreshRaw = randomToken()
  const refreshHash = await hashToken(refreshRaw)
  const refreshRecord = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const payload = {
    sub: `user:${user.id}`,
    uid: user.id,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId ?? null,
  }
  const { SignJWT } = await getJose()
  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(JWT_SECRET)

  const includeToken = shouldIncludeAccessTokenInBody(req)

  res
    .cookie('access_token', accessToken, cookieOptsAT(req))
    .cookie('refresh_token', `${refreshRecord.id}.${refreshRaw}`, cookieOptsRT(req))
    .json({
      ok: true,
      ...(includeToken ? { accessToken } : {}),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        institutionId: user.institutionId,
      },
    })
}

export async function logout(req: Request, res: Response) {
  const uid = (req as any).auth?.uid as string | undefined
  if (uid) {
    await prisma.refreshToken.updateMany({
      where: { userId: parseInt(uid), expiresAt: { gt: new Date() } },
      data: { revoked: true },
    })
  }
  res
    .clearCookie('access_token', getCookieBaseOptions(req))
    .clearCookie('refresh_token', getCookieBaseOptions(req))
    .json({ ok: true })
}

export async function refreshToken(req: Request, res: Response) {
  const presented = (req as any).cookies?.refresh_token as string | undefined
  if (!presented) {
    return res.status(401).json({ ok: false, message: 'No refresh token provided' })
  }

  const { id: refreshId, raw: refreshRaw } = parseRefreshCookie(presented)

  type RefreshTokenRecord = {
    id: string
    userId: number
    tokenHash: string
    revoked: boolean
    expiresAt: Date
  }

  let rt: RefreshTokenRecord | null = null

  if (refreshId) {
    rt = await prisma.refreshToken.findUnique({
      where: { id: refreshId },
      select: { id: true, userId: true, tokenHash: true, revoked: true, expiresAt: true },
    })
  } else {
    // Legacy fallback: previous cookie format stored only the raw token.
    // This should disappear once clients refresh.
    const candidates = await prisma.refreshToken.findMany({
      where: { revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, tokenHash: true, revoked: true, expiresAt: true },
    })
    for (const candidate of candidates) {
      if (await verifyTokenHash(candidate.tokenHash, refreshRaw)) {
        rt = candidate
        break
      }
    }
  }

  if (
    !rt ||
    rt.revoked ||
    rt.expiresAt <= new Date() ||
    !(await verifyTokenHash(rt.tokenHash, refreshRaw))
  ) {
    return res.status(401).json({ ok: false, message: 'Invalid refresh' })
  }

  const user = await prisma.user.findUnique({
    where: { id: rt.userId },
    select: { id: true, email: true, role: true, institutionId: true },
  })
  if (!user) return res.status(401).json({ ok: false })

  const payload = {
    sub: `user:${user.id}`,
    uid: user.id,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId ?? null,
  }
  const { SignJWT } = await getJose()
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(JWT_SECRET)

  await prisma.refreshToken.update({ where: { id: rt.id }, data: { revoked: true } })

  const newRaw = randomToken()
  const newHash = await hashToken(newRaw)
  const newRecord = await prisma.refreshToken.create({
    data: {
      userId: rt.userId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const includeToken = shouldIncludeAccessTokenInBody(req)

  res
    .cookie('access_token', token, { ...cookieOptsAT(req), maxAge: 30 * 60 * 1000 })
    .cookie('refresh_token', `${newRecord.id}.${newRaw}`, {
      ...cookieOptsRT(req),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({ ok: true, expiresIn: '30m', ...(includeToken ? { accessToken: token } : {}) })
}

export async function requestPasswordReset(req: Request, res: Response) {
  const { email } = req.body
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  if (!user) {
    return res.status(200).json({ ok: false, message: 'User not found' })
  }

  const { SignJWT } = await getJose()
  const token = await new SignJWT({ sub: `reset:${user.id}`, email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET)

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`

  await sendEmail({
    to: email,
    subject: 'Recuperación de contraseña',
    html: `<p>Haz click <a href="${resetLink}">aquí</a> para restablecer tu contraseña. Este enlace expira en 15 minutos.</p>`,
  })

  res.json({ ok: true, message: 'Recovery email sent' })
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res.status(400).json({ ok: false, message: 'Token and new password are required' })
  }

  try {
    const { jwtVerify } = await getJose()
    const { payload } = await jwtVerify(token, JWT_SECRET)

    const subParts = payload.sub?.split(':')
    if (!subParts || subParts[0] !== 'reset' || !subParts[1]) {
      return res.status(400).json({ ok: false, message: 'Invalid token subject' })
    }

    const userId = Number(subParts[1])

    const pepper = (process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, '')
    const hashedPassword = await argon2.hash(newPassword, {
      secret: Buffer.from(pepper, 'base64'),
    })

    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword },
    })

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    })

    res.json({ ok: true, message: 'Password updated successfully' })
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid or expired token' })
  }
}
