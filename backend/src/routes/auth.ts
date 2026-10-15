import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authenticate, signToken } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { HttpError, ok, parse } from '../utils/http';

const router = Router();

// Used to keep response time constant when the username does not exist
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy-password', 10);

export const USER_COLUMNS = `
  u.id, u.username, u.full_name, u.email, u.role, u.department_id,
  d.name AS department_name, u.is_active, u.created_at, u.updated_at`;

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);

  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}, u.password_hash, u.token_version
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE LOWER(u.username) = LOWER($1)`,
    [username],
  );
  const user = rows[0];
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
  if (!user.is_active) throw new HttpError(403, 'This account has been disabled', 'ACCOUNT_DISABLED');

  const token = signToken(user);
  await logAudit(pool, {
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    actor: { id: user.id, fullName: user.full_name },
    description: `${user.full_name} signed in`,
    details: { userAgent: req.get('user-agent') ?? null },
  });

  delete user.password_hash;
  delete user.token_version;
  ok(res, { token, user }, 'Login successful');
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS},
            (SELECT COUNT(*) FROM assets a WHERE a.current_holder_id = u.id) AS asset_count
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1`,
    [req.user!.id],
  );
  ok(res, rows[0], 'Current user');
});

router.post('/logout', authenticate, async (req, res) => {
  // JWTs are stateless: the client discards the token. We record the event for auditing.
  await logAudit(pool, {
    action: 'LOGOUT',
    entityType: 'USER',
    entityId: req.user!.id,
    actor: req.user,
    description: `${req.user!.fullName} signed out`,
  });
  ok(res, null, 'Logged out');
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, 'Current password is incorrect', 'INVALID_PASSWORD');
  }

  const hash = await bcrypt.hash(newPassword, 10);
  const { rows: updated } = await pool.query(
    `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
      WHERE id = $2 RETURNING id, role, token_version`,
    [hash, req.user!.id],
  );
  await logAudit(pool, {
    action: 'PASSWORD_CHANGED',
    entityType: 'USER',
    entityId: req.user!.id,
    actor: req.user,
    description: `${req.user!.fullName} changed their password`,
  });
  // Older tokens are now invalid - hand back a fresh one so this session continues
  ok(res, { token: signToken(updated[0]) }, 'Password changed successfully');
});

export default router;
