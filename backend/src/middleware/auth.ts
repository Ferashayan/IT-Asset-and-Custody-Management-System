import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db/pool';
import { HttpError } from '../utils/http';

export type Role = 'Admin' | 'Staff';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  departmentId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
  tv: number;
}

export function signToken(user: { id: number; role: Role; token_version: number }) {
  const payload: Omit<TokenPayload, 'sub'> = { role: user.role, tv: user.token_version };
  return jwt.sign(payload, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies the Bearer JWT and re-loads the user so that deactivated / deleted
 * users and tokens issued before a password reset are rejected immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as unknown as TokenPayload;
  } catch {
    throw new HttpError(401, 'Invalid or expired token', 'UNAUTHORIZED');
  }

  const { rows } = await pool.query(
    `SELECT id, username, full_name, role, department_id, is_active, token_version
       FROM users WHERE id = $1`,
    [Number(payload.sub)],
  );
  const user = rows[0];
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    throw new HttpError(401, 'Session is no longer valid, please sign in again', 'UNAUTHORIZED');
  }

  req.user = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    departmentId: user.department_id,
  };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to perform this action', 'FORBIDDEN');
    }
    next();
  };
}

export const requireAdmin = requireRole('Admin');
