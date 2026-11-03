import { describe, it, expect } from 'vitest';
import { jsonField } from '../src/utils/json';
import { AppError } from '../src/utils/AppError';

/**
 * Unit tests for the pure helpers in src/utils.
 * These are the two modules every route depends on, and both are side-effect
 * free, so no mocking is required.
 */

describe('jsonField', () => {
  it('passes an existing string through untouched', () => {
    // This is the behaviour that keeps already-encoded JSON columns from being
    // double-encoded on a second write.
    expect(jsonField('["graphic","gothic"]')).toBe('["graphic","gothic"]');
    expect(jsonField('plain text')).toBe('plain text');
  });

  it('stringifies arrays', () => {
    expect(jsonField(['graphic', 'gothic'])).toBe('["graphic","gothic"]');
  });

  it('stringifies objects', () => {
    expect(jsonField({ city: 'Lahore' })).toBe('{"city":"Lahore"}');
  });

  it('collapses null and undefined to the JSON literal null', () => {
    expect(jsonField(null)).toBe('null');
    expect(jsonField(undefined)).toBe('null');
  });

  it('serialises primitives that are not strings', () => {
    expect(jsonField(0)).toBe('0');
    expect(jsonField(false)).toBe('false');
  });

  it('never returns undefined, so a NOT NULL text column stays satisfiable', () => {
    for (const value of [undefined, null, 0, false, '', [], {}]) {
      expect(typeof jsonField(value)).toBe('string');
    }
  });

  it('survives a JSON.parse round trip', () => {
    const original = { socialLinks: { instagram: 'ziqwear', tiktok: null } };
    expect(JSON.parse(jsonField(original))).toEqual(original);
  });
});

describe('AppError', () => {
  it('carries message, status, code and is flagged operational', () => {
    const error = new AppError('nope', 409, 'CONFLICT');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('nope');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('keeps its prototype chain after transpilation', () => {
    // Object.setPrototypeOf in the constructor is what makes `instanceof`
    // survive the ES2022 -> CommonJS class downgrade.
    const error = new AppError('x', 400, 'BAD_REQUEST');
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(error.name).toBe('Error');
  });

  it('records structured details', () => {
    const details = [{ field: 'email', message: 'invalid' }];
    expect(new AppError('bad', 422, 'VALIDATION_ERROR', details).details).toEqual(details);
  });

  it('produces the right status/code pairs from every factory', () => {
    const cases: Array<[AppError, number, string]> = [
      [AppError.badRequest('r'), 400, 'BAD_REQUEST'],
      [AppError.unauthorized(), 401, 'UNAUTHORIZED'],
      [AppError.forbidden(), 403, 'FORBIDDEN'],
      [AppError.notFound(), 404, 'NOT_FOUND'],
      [AppError.conflict('c'), 409, 'CONFLICT'],
      [AppError.internal(), 500, 'INTERNAL_ERROR'],
      [AppError.validationError('v'), 422, 'VALIDATION_ERROR'],
    ];

    for (const [error, statusCode, code] of cases) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(statusCode);
      expect(error.code).toBe(code);
    }
  });

  it('lets an auth layer override the factory default code', () => {
    expect(AppError.unauthorized('Admin required', 'ADMIN_ONLY').code).toBe('ADMIN_ONLY');
  });

  it('has default messages so callers cannot leak an empty 500', () => {
    expect(AppError.internal().message).toBe('Internal server error');
    expect(AppError.notFound().message).toBe('Resource not found');
    expect(AppError.unauthorized().message).toBe('Unauthorized');
  });

  it('captures a stack trace that points at the thrower, not the constructor', () => {
    const error = AppError.notFound('gone');
    expect(error.stack).toBeDefined();
    expect(error.stack).not.toMatch(/new AppError/);
  });
});
