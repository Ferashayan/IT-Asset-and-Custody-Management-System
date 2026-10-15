import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { diff, logAudit } from '../services/audit';
import { HttpError, idParam, notFound, ok, optionalText, paginated, paginationQuery, parse, WhereBuilder } from '../utils/http';
import { USER_COLUMNS } from './auth';

const router = Router();
router.use(requireAdmin);

const listQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  role: z.enum(['Admin', 'Staff']).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, q, role, departmentId, status } = parse(listQuery, req.query);
  const w = new WhereBuilder();
  if (q) {
    w.add(`(u.username ILIKE $? OR u.full_name ILIKE $? OR u.email ILIKE $?)`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (role) w.add('u.role = $?', role);
  if (departmentId) w.add('u.department_id = $?', departmentId);
  if (status) w.add('u.is_active = $?', status === 'active');

  const where = w.toSql();
  const countParams = [...w.params];
  const limit = w.param(pageSize);
  const offset = w.param((page - 1) * pageSize);

  const [{ rows }, { rows: count }] = await Promise.all([
    pool.query(
      `SELECT ${USER_COLUMNS},
              (SELECT COUNT(*) FROM assets a WHERE a.current_holder_id = u.id) AS asset_count
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
         ${where}
        ORDER BY u.full_name ASC
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    ),
    pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, countParams),
  ]);
  ok(res, paginated(rows, count[0].total, page, pageSize), 'Users retrieved');
});

/** Compact list of active users for "assign to" pickers */
router.get('/options', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.full_name, d.name AS department_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.is_active
      ORDER BY u.full_name`,
  );
  ok(res, rows, 'User options retrieved');
});

router.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
    [id],
  );
  if (!rows[0]) throw notFound('User');
  const { rows: assets } = await pool.query(
    `SELECT id, asset_tag, category, brand, model, serial_number, status
       FROM assets WHERE current_holder_id = $1 ORDER BY asset_tag`,
    [id],
  );
  ok(res, { ...rows[0], assets }, 'User retrieved');
});

const userBody = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain letters, numbers, dot, dash and underscore only'),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: optionalText(160).pipe(z.string().email('Invalid email address').nullable()),
  role: z.enum(['Admin', 'Staff']),
  departmentId: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  isActive: z.boolean().default(true),
});

const createSchema = userBody.extend({
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

router.post('/', async (req, res) => {
  const body = parse(createSchema, req.body);
  const hash = await bcrypt.hash(body.password, 10);

  const user = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (username, password_hash, full_name, email, role, department_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [body.username, hash, body.fullName, body.email, body.role, body.departmentId, body.isActive],
    );
    await logAudit(client, {
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: rows[0].id,
      actor: req.user,
      description: `Created user ${body.fullName} (${body.username}) as ${body.role}`,
      details: { username: body.username, role: body.role },
    });
    return rows[0];
  });

  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
    [user.id],
  );
  ok(res, rows[0], 'User created successfully', 201);
});

router.put('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const body = parse(userBody, req.body);

  if (id === req.user!.id && (body.role !== 'Admin' || !body.isActive)) {
    throw new HttpError(400, 'You cannot remove your own admin role or deactivate your own account', 'SELF_MODIFICATION');
  }

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    const before = rows[0];
    if (!before) throw notFound('User');

    await client.query(
      `UPDATE users
          SET username = $1, full_name = $2, email = $3, role = $4::VARCHAR, department_id = $5, is_active = $6::BOOLEAN,
              -- deactivating or changing the role revokes existing sessions
              token_version = token_version + CASE WHEN $6::BOOLEAN = FALSE OR role <> $4::VARCHAR THEN 1 ELSE 0 END,
              updated_at = NOW()
        WHERE id = $7`,
      [body.username, body.fullName, body.email, body.role, body.departmentId, body.isActive, id],
    );

    const changes = diff(
      {
        username: before.username,
        full_name: before.full_name,
        email: before.email,
        role: before.role,
        department_id: before.department_id,
        is_active: before.is_active,
      },
      {
        username: body.username,
        full_name: body.fullName,
        email: body.email,
        role: body.role,
        department_id: body.departmentId,
        is_active: body.isActive,
      },
    );
    await logAudit(client, {
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      actor: req.user,
      description: `Updated user ${body.fullName} (${body.username})`,
      details: { changes },
    });
  });

  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
    [id],
  );
  ok(res, rows[0], 'User updated successfully');
});

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

router.put('/:id/password', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { password } = parse(resetSchema, req.body);
  const hash = await bcrypt.hash(password, 10);

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
        WHERE id = $2 RETURNING full_name, username`,
      [hash, id],
    );
    if (!rows[0]) throw notFound('User');
    await logAudit(client, {
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      actor: req.user,
      description: `Reset password for ${rows[0].full_name} (${rows[0].username})`,
    });
  });
  ok(res, null, 'Password reset successfully');
});

router.delete('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  if (id === req.user!.id) throw new HttpError(400, 'You cannot delete your own account', 'SELF_MODIFICATION');

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT full_name, username FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw notFound('User');

    const { rows: held } = await client.query('SELECT COUNT(*) AS n FROM assets WHERE current_holder_id = $1', [id]);
    if (held[0].n > 0) {
      throw new HttpError(
        409,
        `This user still holds ${held[0].n} asset(s). Return them to stock before deleting the user.`,
        'USER_HAS_ASSETS',
      );
    }

    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await logAudit(client, {
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: id,
      actor: req.user,
      description: `Deleted user ${rows[0].full_name} (${rows[0].username})`,
      details: { username: rows[0].username },
    });
  });
  ok(res, null, 'User deleted successfully');
});

export default router;
