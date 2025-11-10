import { PrismaClient, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { getJose } from '../../lib/jose';
import { hashToken, randomToken } from '../../lib/tokens';
import { getTestPrisma } from './db.setup';

const prisma = getTestPrisma();

/**
 * Create a test user with a hashed password
 */
export async function createTestUser(data: {
  email: string;
  password?: string;
  role?: UserRole;
  name?: string;
  institutionId?: number | null;
  rut?: string;
}) {
  const password = data.password || 'TestPassword123!';
  const pepper = (process.env.ARGON2_SECRET_PEPPER || '').replace(/^base64:/, '');
  
  const hashedPassword = await argon2.hash(password, {
    secret: Buffer.from(pepper, 'base64'),
  });

  return await prisma.user.create({
    data: {
      email: data.email,
      hashedPassword,
      role: data.role || 'tutor',
      name: data.name || 'Test User',
      institutionId: data.institutionId ?? null,
      rut: data.rut,
    },
  });
}

/**
 * Create a test institution
 */
export async function createTestInstitution(name: string = 'Test Institution') {
  return await prisma.institution.create({
    data: { name },
  });
}

/**
 * Generate a valid JWT token for testing
 */
export async function generateTestToken(payload: {
  uid: number;
  email: string;
  role: UserRole;
  institutionId?: number | null;
}) {
  const { SignJWT } = await getJose();
  const JWT_SECRET = getJWTSecret();
  
  return await new SignJWT({
    sub: `user:${payload.uid}`,
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
    institutionId: payload.institutionId ?? null,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

/**
 * Create a refresh token in the database
 */
export async function createRefreshToken(userId: number, expiresInDays: number = 7) {
  const refreshRaw = randomToken();
  const refreshHash = await hashToken(refreshRaw);
  
  const token = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    },
  });

  return { token: refreshRaw, dbToken: token };
}

/**
 * Get JWT secret from environment
 */
function getJWTSecret(): Buffer {
  const raw = process.env.JWT_SECRET || '';
  return raw.startsWith('base64:')
    ? Buffer.from(raw.slice(7), 'base64')
    : Buffer.from(raw, 'base64');
}

/**
 * Clean up test data (users, tokens, etc.)
 */
export async function cleanupTestData() {
  await prisma.refreshToken.deleteMany({});
  await prisma.userBankAccount.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.institution.deleteMany({});
}

/**
 * Make an authenticated request helper
 * Returns headers with Bearer token
 */
export function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make an authenticated request with cookies
 */
export function getAuthCookies(accessToken: string, refreshToken?: string) {
  const cookies: string[] = [`access_token=${accessToken}`];
  if (refreshToken) {
    cookies.push(`refresh_token=${refreshToken}`);
  }
  return cookies.join('; ');
}

