import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { ok, paginated, paginationQuery, parse, WhereBuilder } from '../utils/http';

const router = Router();

/** Assets currently in the signed-in user's custody + their past custody records */
router.get('/me', async (req, res) => {
  const userId = req.user!.id;
  const [{ rows: assets }, { rows: history }] = await Promise.all([
    pool.query(
      `SELECT a.id, a.asset_tag, a.category, a.brand, a.model, a.serial_number, a.purchase_date,
              a.warranty_end_date, a.status, c.assigned_at, c.assign_notes
         FROM assets a
         LEFT JOIN custody_assignments c ON c.asset_id = a.id AND c.returned_at IS NULL
        WHERE a.current_holder_id = $1
        ORDER BY c.assigned_at DESC NULLS LAST`,
      [userId],
    ),
    pool.query(
      `SELECT c.id, c.asset_id, a.asset_tag, a.brand, a.model, c.assigned_at, c.returned_at
         FROM custody_assignments c
         JOIN assets a ON a.id = c.asset_id
        WHERE c.user_id = $1 AND c.returned_at IS NOT NULL
        ORDER BY c.returned_at DESC
        LIMIT 50`,
      [userId],
    ),
  ]);
  ok(res, { assets, history }, 'Your assets');
});

const listQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  state: z.enum(['open', 'closed']).optional(),
  userId: z.coerce.number().int().positive().optional(),
  assetId: z.coerce.number().int().positive().optional(),
});

/** Full custody ledger (admin) */
router.get('/', requireAdmin, async (req, res) => {
  const { page, pageSize, q, state, userId, assetId } = parse(listQuery, req.query);
  const w = new WhereBuilder();
  if (q) {
    const like = `%${q}%`;
    w.add('(a.asset_tag ILIKE $? OR c.holder_name ILIKE $? OR a.brand ILIKE $? OR a.model ILIKE $?)', like, like, like, like);
  }
  if (state === 'open') w.add('c.returned_at IS NULL');
  if (state === 'closed') w.add('c.returned_at IS NOT NULL');
  if (userId) w.add('c.user_id = $?', userId);
  if (assetId) w.add('c.asset_id = $?', assetId);

  const where = w.toSql();
  const countParams = [...w.params];
  const limit = w.param(pageSize);
  const offset = w.param((page - 1) * pageSize);

  const from = `FROM custody_assignments c JOIN assets a ON a.id = c.asset_id`;
  const [{ rows }, { rows: count }] = await Promise.all([
    pool.query(
      `SELECT c.id, c.asset_id, a.asset_tag, a.category, a.brand, a.model, c.user_id, c.holder_name,
              c.assigned_at, c.assign_notes, c.returned_at, c.return_notes,
              ab.full_name AS assigned_by_name, rb.full_name AS received_by_name
         ${from}
         LEFT JOIN users ab ON ab.id = c.assigned_by
         LEFT JOIN users rb ON rb.id = c.received_by
         ${where}
        ORDER BY COALESCE(c.returned_at, c.assigned_at) DESC, c.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    ),
    pool.query(`SELECT COUNT(*) AS total ${from} ${where}`, countParams),
  ]);
  ok(res, paginated(rows, count[0].total, page, pageSize), 'Custody records retrieved');
});

export default router;
