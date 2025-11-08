import { Request, Response } from "express";
import argon2 from "argon2";
import { getJose } from '../lib/jose'
import prisma from "../lib/prisma";
import { randomToken, hashToken, verifyTokenHash } from "../lib/tokens";

function b64ToKey(b64?: string) {
  const raw = b64 || ''
  return raw.startsWith('base64:') ? Buffer.from(raw.slice(7), 'base64') : Buffer.from(raw, 'base64')
}
const JWT_SECRET = b64ToKey(process.env.JWT_SECRET)

const cookieOptsAT = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 30 * 60 * 1000 // 30 minutos
}
const cookieOptsRT = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, hashedPassword: true, role: true, email: true, name: true, institutionId: true },
  })
  if (!user) return res.status(401).json({ ok: false, message: 'Invalid credentials' })

  const pepper = (process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, '')
  const isPasswordValid = await argon2.verify(user.hashedPassword, password, {
    secret: Buffer.from(pepper, 'base64')
  })
  if (!isPasswordValid) return res.status(401).json({ ok: false, message: 'Invalid credentials' })

  const refreshRaw  = randomToken()
  const refreshHash = await hashToken(refreshRaw)
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
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

  res
    .cookie('access_token',  accessToken, cookieOptsAT)
    .cookie('refresh_token', refreshRaw,  cookieOptsRT)
    .json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, institutionId: user.institutionId }
    })
}

export async function logout(req: Request, res: Response) {
  const uid = (req as any).auth?.uid as string | undefined
  if (uid) {
    await prisma.refreshToken.updateMany({
      where: { userId: parseInt(uid), expiresAt: { gt: new Date() } },
      data: { revoked: true }
    });
  }
  res
    .clearCookie('access_token',  { path: '/', sameSite: 'none', secure: true, httpOnly: true })
    .clearCookie('refresh_token', { path: '/', sameSite: 'none', secure: true, httpOnly: true })
    .json({ ok: true })
}

export async function refreshToken(req: Request, res: Response) {
  const presented = (req as any).cookies?.refresh_token as string | undefined
  if (!presented) {
    return res.status(401).json({ ok: false, message: 'No refresh token provided' })
  }

  const rt = await prisma.refreshToken.findFirst({
    where: {
      revoked: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!rt || !(await verifyTokenHash(rt.tokenHash, presented))) {
    return res.status(401).json({ ok: false, message: 'Invalid refresh' })
  }

  const user = await prisma.user.findUnique({ where: { id: rt.userId }, select: { id: true, email: true, role: true, institutionId: true } })
  if (!user) return res.status(401).json({ ok: false })

  const payload = { sub: `user:${user.id}`, uid: user.id, email: user.email, role: user.role, institutionId: user.institutionId ?? null }
  const { SignJWT } = await getJose()
  const token = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime('30m').sign(JWT_SECRET)

  await prisma.refreshToken.update({ where: { id: rt.id }, data: { revoked: true } })
  const newRaw = randomToken()
  const newHash = await hashToken(newRaw)
  await prisma.refreshToken.create({
    data: { userId: rt.userId, tokenHash: newHash, expiresAt: new Date(Date.now() + 7*24*60*60*1000) }
  })

  res
    .cookie('access_token', token, { ...cookieOptsAT, maxAge: 30 * 60 * 1000 })
    .cookie('refresh_token', newRaw, { ...cookieOptsRT, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({ ok: true, expiresIn: '30m' })
}