import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../../middlewares/authorize';
import { UserRole } from '@prisma/client';

describe('authorize Middleware', () => {
  let mockRequest: Partial<Request> & { auth?: any };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      auth: undefined,
    } as any;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  describe('Authorized roles', () => {
    it('should allow access for authorized role', () => {
      mockRequest.auth = { role: 'admin' };
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access when user role is in allowed list', () => {
      mockRequest.auth = { role: 'coordinator' };
      const middleware = authorize(['admin', 'coordinator']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for multiple allowed roles', () => {
      mockRequest.auth = { role: 'tutor' };
      const middleware = authorize(['tutor', 'parent']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Unauthorized roles', () => {
    it('should reject access for unauthorized role', () => {
      mockRequest.auth = { role: 'tutor' };
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should reject access when role is not in allowed list', () => {
      mockRequest.auth = { role: 'parent' };
      const middleware = authorize(['admin', 'coordinator']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Missing auth', () => {
    it('should reject access when req.auth is undefined', () => {
      mockRequest.auth = undefined;
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should reject access when req.auth.role is undefined', () => {
      mockRequest.auth = {} as any;
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('All user roles', () => {
    const allRoles: UserRole[] = ['admin', 'coordinator', 'tutor', 'parent'];

    allRoles.forEach((role) => {
      it(`should allow ${role} when all roles are allowed`, () => {
        mockRequest.auth = { role };
        const middleware = authorize(allRoles);

        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });
  });
});

