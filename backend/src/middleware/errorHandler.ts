import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { config } from '../config';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', error);
  
  // AppError (operational errors)
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }
  
  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }
  
  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[]) || [];
        res.status(409).json({
          error: `${target.join(', ')} already exists`,
          code: 'DUPLICATE_ENTRY',
          details: { fields: target },
        });
        return;
      }
      case 'P2025': {
        res.status(404).json({
          error: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;
      }
      case 'P2003': {
        res.status(400).json({
          error: 'Foreign key constraint failed',
          code: 'FOREIGN_KEY_ERROR',
        });
        return;
      }
    }
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
    return;
  }
  
  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }
  
  // Multer errors
  if (error.name === 'MulterError') {
    res.status(400).json({
      error: error.message,
      code: 'UPLOAD_ERROR',
    });
    return;
  }
  
  // Default internal server error
  const message = config.nodeEnv === 'production' 
    ? 'Internal server error' 
    : error.message;
  
  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}