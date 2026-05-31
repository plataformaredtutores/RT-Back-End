import { Request, Response } from 'express'
import { login, logout, refreshToken } from '../../../controllers/authController'
import prisma from '../../../lib/prisma'
import argon2 from 'argon2'
import { randomToken, hashToken } from '../../../lib/tokens'

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

/**
 * Mock jose library
 *
 * Note: Mocks are defined inside the factory to avoid Jest hoisting issues.
 * Uses unique global names (__mockJwtVerifyController) to avoid conflicts
 * with other test files that mock the same module.
 */
let mockSignJWT: jest.Mock

jest.mock('../../../lib/jose', () => {
  const mockJwtVerifyFn = jest.fn()
  const mockSignJWTFn = jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-access-token'),
  }))

  ;(global as any).__mockJwtVerifyController = mockJwtVerifyFn
  ;(global as any).__mockSignJWTController = mockSignJWTFn

  return {
    getJose: jest.fn().mockResolvedValue({
      jwtVerify: mockJwtVerifyFn,
      SignJWT: mockSignJWTFn,
    }),
  }
})

/**
 * Note: We use real token functions (randomToken, hashToken) in these tests
 * to properly test the token generation and verification logic.
 */

describe('Auth Controller - Unit Tests', () => {
  let mockRequest: Partial<Request> & { auth?: any; cookies?: any }
  let mockResponse: Partial<Response>

  beforeEach(() => {
    // Get mock references from global
    mockJwtVerify = (global as any).__mockJwtVerifyController
    mockSignJWT = (global as any).__mockSignJWTController

    mockRequest = {
      body: {},
      cookies: {},
      auth: undefined,
    } as any
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    }
    jest.clearAllMocks()

    // Set up environment variables for tests
    process.env.JWT_SECRET = 'base64:' + Buffer.from('test-secret-key').toString('base64')
    process.env.ARGON2_SECRET_PEPPER = 'base64:' + Buffer.from('test-pepper').toString('base64')
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const testPassword = 'TestPassword123!'
      const hashedPassword = await argon2.hash(testPassword, {
        secret: Buffer.from(process.env.ARGON2_SECRET_PEPPER!.replace(/^base64:/, ''), 'base64'),
      })

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        hashedPassword,
        role: 'admin' as const,
        name: 'Test User',
        institutionId: null,
      }

      mockRequest.body = {
        email: 'test@example.com',
        password: testPassword,
      }

      // Mock Prisma calls
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      // Use real token functions (not mocked)
      const mockRefreshToken = randomToken()
      const mockRefreshHash = await hashToken(mockRefreshToken)

      ;(prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'token-id',
        userId: mockUser.id,
        tokenHash: mockRefreshHash,
        expiresAt: new Date(),
      })

      // SignJWT is already mocked globally, just need to set up the return value
      const mockAccessToken = 'mock-access-token'
      const mockSignJWTInstance = {
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockReturnThis(),
        sign: jest.fn().mockResolvedValue(mockAccessToken),
      }
      ;(mockSignJWT as jest.Mock).mockReturnValue(mockSignJWTInstance)

      await login(mockRequest as Request, mockResponse as Response)

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          hashedPassword: true,
          role: true,
          email: true,
          name: true,
          institutionId: true,
        },
      })
      expect(prisma.refreshToken.create).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: true,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          name: mockUser.name,
          institutionId: mockUser.institutionId,
        },
      })
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockAccessToken,
        expect.any(Object),
      )
      // Verify refresh_token cookie was set with a string (the actual token is random)
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      )
    })

    it('should return 401 for non-existent user', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'password',
      }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      await login(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        message: 'Invalid credentials',
      })
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })

    it('should return 401 for invalid password', async () => {
      const correctPassword = 'CorrectPassword123!'
      const hashedPassword = await argon2.hash(correctPassword, {
        secret: Buffer.from(process.env.ARGON2_SECRET_PEPPER!.replace(/^base64:/, ''), 'base64'),
      })

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        hashedPassword,
        role: 'admin' as const,
        name: 'Test User',
        institutionId: null,
      }

      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      await login(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        message: 'Invalid credentials',
      })
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('should successfully logout and revoke refresh tokens', async () => {
      mockRequest.auth = { uid: '123' }
      ;(prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 })

      await logout(mockRequest as Request, mockResponse as Response)

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 123,
          expiresAt: { gt: expect.any(Date) },
        },
        data: { revoked: true },
      })
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object))
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object))
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true })
    })

    it('should logout even when no auth is present', async () => {
      mockRequest.auth = undefined

      await logout(mockRequest as Request, mockResponse as Response)

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
      expect(mockResponse.clearCookie).toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true })
    })
  })

  describe('refreshToken', () => {
    it('should successfully refresh token with valid refresh token', async () => {
      // Use real token functions
      const oldRefreshToken = randomToken()
      const oldRefreshHash = await hashToken(oldRefreshToken)
      const newRefreshToken = randomToken()
      const newRefreshHash = await hashToken(newRefreshToken)

      mockRequest.cookies = {
        refresh_token: oldRefreshToken,
      }

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'admin' as const,
        institutionId: null,
      }

      const mockRefreshTokenRecord = {
        id: 'token-id',
        userId: mockUser.id,
        tokenHash: oldRefreshHash,
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }

      // Mock findMany to return array of tokens (updated for security fix)
      ;(prisma.refreshToken.findMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue([mockRefreshTokenRecord])

      // verifyTokenHash will use the real function which should verify correctly
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.refreshToken.update as jest.Mock).mockResolvedValue(mockRefreshTokenRecord)
      // randomToken and hashToken will use real functions
      ;(prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'new-token-id',
        userId: mockUser.id,
        tokenHash: newRefreshHash,
      })

      // SignJWT is already mocked globally
      const mockAccessToken = 'new-access-token'
      const mockSignJWTInstance = {
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockReturnThis(),
        sign: jest.fn().mockResolvedValue(mockAccessToken),
      }
      ;(mockSignJWT as jest.Mock).mockReturnValue(mockSignJWTInstance)

      await refreshToken(mockRequest as Request, mockResponse as Response)

      expect(prisma.refreshToken.findMany).toHaveBeenCalled()
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: mockRefreshTokenRecord.id },
        data: { revoked: true },
      })
      expect(prisma.refreshToken.create).toHaveBeenCalled()
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockAccessToken,
        expect.any(Object),
      )
      // Verify refresh_token cookie was set with a string (the actual token is random)
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      )
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true, expiresIn: '30m' })
    })

    it('should return 401 when no refresh token is provided', async () => {
      mockRequest.cookies = {}

      await refreshToken(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        message: 'No refresh token provided',
      })
      expect(prisma.refreshToken.findFirst).not.toHaveBeenCalled()
    })

    it('should return 401 for invalid refresh token', async () => {
      mockRequest.cookies = {
        refresh_token: 'invalid-token',
      }

      // Mock findMany to return empty array (no matching tokens)
      ;(prisma.refreshToken.findMany as jest.Mock) = jest.fn().mockResolvedValue([])

      await refreshToken(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        message: 'Invalid refresh',
      })
    })
  })
})
