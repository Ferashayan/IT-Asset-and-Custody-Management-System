import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { HttpError, idParam, notFound, ok, parse } from '../utils/http';

const router = Router();

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS user_count,
            (SELECT COUNT(*) FROM assets a JOIN users u ON u.id = a.current_holder_id
              WHERE u.department_id = d.id) AS asset_count
       FROM departments d
      ORDER BY d.name`,
  );
  ok(res, rows, 'Departments retrieved');
});

const body = z.object({ name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100) });

router.post('/', requireAdmin, async (req, res) => {
  const { name } = parse(body, req.body);
  const dept = await withTransaction(async (client) => {
    const { rows } = await client.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
    await logAudit(client, {
      action: 'DEPARTMENT_CREATED',
      entityType: 'DEPARTMENT',
      entityId: rows[0].id,
      actor: req.user,
      description: `Created department "${name}"`,
    });
    return rows[0];
  });
  ok(res, dept, 'Department created successfully', 201);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { name } = parse(body, req.body);
  const dept = await withTransaction(async (client) => {
    const { rows: before } = await client.query('SELECT name FROM departments WHERE id = $1 FOR UPDATE', [id]);
    if (!before[0]) throw notFound('Department');
    const { rows } = await client.query('UPDATE departments SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    await logAudit(client, {
      action: 'DEPARTMENT_UPDATED',
      entityType: 'DEPARTMENT',
      entityId: id,
      actor: req.user,
      description: `Renamed department "${before[0].name}" to "${name}"`,
    });
    return rows[0];
  });
  ok(res, dept, 'Department updated successfully');
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT name FROM departments WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw notFound('Department');
    const { rows: members } = await client.query('SELECT COUNT(*) AS n FROM users WHERE department_id = $1', [id]);
    if (members[0].n > 0) {
      throw new HttpError(409, `Department still has ${members[0].n} user(s). Move them first.`, 'DEPARTMENT_IN_USE');
    }
    await client.query('DELETE FROM departments WHERE id = $1', [id]);
    await logAudit(client, {
      action: 'DEPARTMENT_DELETED',
      entityType: 'DEPARTMENT',
      entityId: id,
      actor: req.user,
      description: `Deleted department "${rows[0].name}"`,
    });
  });
  ok(res, null, 'Department deleted successfully');
});

export default router;
