import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { isoDate, ok, paginated, paginationQuery, parse, WhereBuilder } from '../utils/http';

const router = Router();
router.use(requireAdmin);

const listQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  action: z.string().trim().max(40).optional(),
  entityType: z.enum(['USER', 'DEPARTMENT', 'ASSET', 'CUSTODY']).optional(),
  assetId: z.coerce.number().int().positive().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, q, action, entityType, assetId, actorId, from, to } = parse(listQuery, req.query);
  const w = new WhereBuilder();
  if (q) w.add('(l.description ILIKE $? OR l.actor_name ILIKE $?)', `%${q}%`, `%${q}%`);
  if (action) w.add('l.action = $?', action);
  if (entityType) w.add('l.entity_type = $?', entityType);
  if (assetId) w.add('l.asset_id = $?', assetId);
  if (actorId) w.add('l.actor_id = $?', actorId);
  if (from) w.add('l.created_at >= $?::date', from);
  if (to) w.add(`l.created_at < ($?::date + INTERVAL '1 day')`, to);

  const where = w.toSql();
  const countParams = [...w.params];
  const limit = w.param(pageSize);
  const offset = w.param((page - 1) * pageSize);

  const [{ rows }, { rows: count }] = await Promise.all([
    pool.query(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.asset_id, a.asset_tag,
              l.actor_id, l.actor_name, l.description, l.details, l.created_at
         FROM audit_logs l LEFT JOIN assets a ON a.id = l.asset_id
         ${where}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    ),
    pool.query(`SELECT COUNT(*) AS total FROM audit_logs l ${where}`, countParams),
  ]);
  ok(res, paginated(rows, count[0].total, page, pageSize), 'Audit logs retrieved');
});

router.get('/actions', async (_req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  ok(res, rows.map((r) => r.action), 'Audit actions');
});

export default router;
