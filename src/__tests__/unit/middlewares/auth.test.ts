import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../middlewares/auth';

/**
 * Mock jose library
 * 
 * Note: Mocks are defined inside the factory to avoid Jest hoisting issues.
 * Jest hoists jest.mock() calls, so variables defined outside the factory
 * aren't available when the factory runs. We store references in global
 * and retrieve them in beforeEach() to reset/configure mocks per test.
 */
let mockJwtVerify: jest.Mock;
let mockSignJWT: jest.Mock;

jest.mock('../../../lib/jose', () => {
  const mockJwtVerifyFn = jest.fn();
  const mockSignJWTFn = jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-token'),
  }));

  // Store references for later use in tests
  (global as any).__mockJwtVerify = mockJwtVerifyFn;
  (global as any).__mockSignJWT = mockSignJWTFn;

  return {
    getJose: jest.fn().mockResolvedValue({
      jwtVerify: mockJwtVerifyFn,
      SignJWT: mockSignJWTFn,
    }),
  };
});

describe('requireAuth Middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any; cookies?: any };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
    } as any;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
    
    // Get mock references from global
    mockJwtVerify = (global as any).__mockJwtVerify;
    mockSignJWT = (global as any).__mockSignJWT;
    
    // Reset mocks
    if (mockJwtVerify) mockJwtVerify.mockClear();
    if (mockSignJWT) mockSignJWT.mockClear();
  });

  describe('Bearer token authentication', () => {
    it('should authenticate with valid Bearer token', async () => {
      const token = 'valid-bearer-token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtVerify.mockResolvedValue({
        payload: { uid: 1, email: 'test@example.com', role: 'admin' },
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockJwtVerify).toHaveBeenCalledWith(token, expect.any(Buffer));
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect((mockRequest as any).auth).toBeDefined();
    });

    it('should reject Bearer token without "Bearer " prefix', async () => {
      const token = 'token-without-bearer-prefix';
      mockRequest.headers = {
        authorization: token, // Missing "Bearer " prefix
      };

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
  });

  describe('Cookie token authentication', () => {
    it('should authenticate with valid cookie token', async () => {
      const token = 'valid-cookie-token';
      mockRequest.cookies = {
        access_token: token,
      };

      mockJwtVerify.mockResolvedValue({
        payload: { uid: 1, email: 'test@example.com', role: 'admin' },
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockJwtVerify).toHaveBeenCalledWith(token, expect.any(Buffer));
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect((mockRequest as any).auth).toBeDefined();
    });

    it('should prefer Bearer token over cookie token', async () => {
      const bearerToken = 'bearer-token';
      const cookieToken = 'cookie-token';

      mockRequest.headers = {
        authorization: `Bearer ${bearerToken}`,
      };
      mockRequest.cookies = {
        access_token: cookieToken,
      };

      mockJwtVerify.mockResolvedValue({
        payload: { uid: 1, email: 'test@example.com', role: 'admin' },
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockJwtVerify).toHaveBeenCalledWith(bearerToken, expect.any(Buffer));
      expect(mockJwtVerify).not.toHaveBeenCalledWith(cookieToken, expect.any(Buffer));
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Missing token', () => {
    it('should reject request without token', async () => {
      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should reject request with empty authorization header', async () => {
      mockRequest.headers = {
        authorization: '',
      };

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Invalid token', () => {
    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    });

    it('should reject expired token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      mockJwtVerify.mockRejectedValue(new Error('Token expired'));

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    });
  });

  describe('Auth payload setting', () => {
    it('should set req.auth with token payload', async () => {
      const token = 'test-token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const payload = {
        uid: 123,
        email: 'user@example.com',
        role: 'coordinator',
        institutionId: 5,
      };

      mockJwtVerify.mockResolvedValue({ payload });

      await requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as any).auth).toEqual(payload);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});

