import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

const constraintMessages: Record<string, string> = {
  users_username_lower_uq: 'Username is already taken',
  users_email_lower_uq: 'Email is already in use',
  assets_serial_number_key: 'An asset with this serial number already exists',
  departments_name_key: 'A department with this name already exists',
  warranty_after_purchase: 'Warranty end date cannot be before the purchase date',
  custody_one_open_per_asset: 'This asset is already assigned',
};

function send(res: Response, status: number, message: string, code: string, details: unknown = null) {
  res.status(status).json({ success: false, message, data: null, error: { code, details } });
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, `Route ${req.method} ${req.path} not found`, 'NOT_FOUND');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return send(res, err.status, err.message, err.code, err.details ?? null);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = details[0];
    return send(res, 400, first ? `${first.field || 'input'}: ${first.message}` : 'Invalid input', 'VALIDATION_ERROR', details);
  }

  const pgErr = err as PgError;
  if (pgErr?.code === '23505' || pgErr?.code === '23514') {
    const message = (pgErr.constraint && constraintMessages[pgErr.constraint]) || 'Request conflicts with existing data';
    return send(res, pgErr.code === '23505' ? 409 : 400, message, pgErr.code === '23505' ? 'CONFLICT' : 'VALIDATION_ERROR');
  }
  if (pgErr?.code === '23503') {
    return send(res, 409, 'This record is referenced by other data and cannot be changed', 'CONFLICT');
  }

  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return send(res, 400, 'Malformed JSON body', 'BAD_REQUEST');
  }

  console.error('[error]', err);
  return send(res, 500, 'Internal server error', 'INTERNAL_ERROR');
}
