import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  customer?: {
    id: string;
    email: string;
    phone?: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.accessToken || 
                  req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: string;
      permissions: string[];
      type: 'admin' | 'customer';
      sid?: string;
    };
    
    if (decoded.type === 'admin') {
      const admin = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true, permissions: true, isActive: true },
      });
      
      if (!admin || !admin.isActive) {
        throw new AppError('Admin account not found or inactive', 401, 'ADMIN_INACTIVE');
      }
      
      req.user = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions as unknown as string[],
      };
    } else {
      const customer = await prisma.customer.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, phone: true, isVerified: true, isBlocked: true },
      });
      
      if (!customer) {
        throw new AppError('Customer not found', 401, 'CUSTOMER_NOT_FOUND');
      }

      // An admin blocking an account must take effect on the next request, not
      // when the access token happens to expire 15 minutes later.
      if (customer.isBlocked) {
        throw new AppError('This account has been blocked', 403, 'ACCOUNT_BLOCKED');
      }

      // Sessions issued by /auth/login carry a `sid` backed by a
      // CustomerSession row. If the row is gone (logout, password reset,
      // expiry) the token is dead even though it is still cryptographically
      // valid - that is what makes server-side sign-out mean anything.
      // Tokens minted before sessions existed carry no `sid` and keep working
      // until their natural expiry.
      if (decoded.sid) {
        const session = await prisma.customerSession.findUnique({ where: { token: decoded.sid } });
        if (!session || session.expiresAt < new Date()) {
          throw new AppError('Session has ended, please sign in again', 401, 'SESSION_REVOKED');
        }
      }
      
      req.customer = {
        id: customer.id,
        email: customer.email,
        phone: customer.phone || undefined,
      };
    }
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
};

export const adminAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.adminToken || 
                  req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('Admin authentication required', 401, 'UNAUTHENTICATED');
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: string;
      permissions: string[];
      type: 'admin';
    };
    
    if (decoded.type !== 'admin') {
      throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }
    
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, permissions: true, isActive: true },
    });
    
    if (!admin || !admin.isActive) {
      throw new AppError('Admin account not found or inactive', 401, 'ADMIN_INACTIVE');
    }
    
    req.user = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions as unknown as string[],
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired admin token', 401, 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.accessToken || 
                  req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        type: 'admin' | 'customer';
        sid?: string;
      };
      
      if (decoded.type === 'customer') {
        const customer = await prisma.customer.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, phone: true, isBlocked: true },
        });
        
        // Same rules as authMiddleware: a blocked account or a revoked session
        // is treated as "no one is signed in" rather than an error, because
        // these routes still have a valid anonymous response.
        const session = decoded.sid
          ? await prisma.customerSession.findUnique({ where: { token: decoded.sid } })
          : null;
        const sessionUsable = !decoded.sid || (session !== null && session.expiresAt > new Date());

        if (customer && !customer.isBlocked && sessionUsable) {
          req.customer = {
            id: customer.id,
            email: customer.email,
            phone: customer.phone || undefined,
          };
        }
      }
    }
    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }
    
    const hasPermission = permissions.some(p => req.user!.permissions.includes(p)) ||
                          req.user.permissions.includes('*') ||
                          req.user.role === 'SUPER_ADMIN';
    
    if (!hasPermission) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }
    
    next();
  };
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }
    
    if (!roles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Insufficient role', 403, 'FORBIDDEN');
    }
    
    next();
  };
};