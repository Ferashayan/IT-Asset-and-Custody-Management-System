import { Router } from 'express';
import { z } from 'zod';
import { pool, Queryable, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { diff, logAudit } from '../services/audit';
import { generateAssetQr } from '../services/qr';
import {
  HttpError,
  idParam,
  isoDate,
  notFound,
  ok,
  optionalText,
  paginated,
  paginationQuery,
  parse,
  WhereBuilder,
} from '../utils/http';

const router = Router();

export const CATEGORIES = [
  'Laptop',
  'Desktop',
  'Server',
  'Monitor',
  'Printer',
  'Network',
  'Phone',
  'Tablet',
  'Peripheral',
  'Other',
] as const;
export const STATUSES = ['ACTIVE', 'FAULTY', 'IN_STOCK'] as const;

const ASSET_COLUMNS = `
  a.id, a.asset_tag, a.category, a.brand, a.model, a.serial_number, a.purchase_date,
  a.warranty_end_date, a.status, a.notes, a.current_holder_id, a.created_at, a.updated_at,
  u.full_name AS holder_name, u.username AS holder_username, u.email AS holder_email,
  d.id AS department_id, d.name AS department_name`;

const ASSET_FROM = `
  FROM assets a
  LEFT JOIN users u ON u.id = a.current_holder_id
  LEFT JOIN departments d ON d.id = u.department_id`;

/** Full asset record including QR code, custody history and audit trail */
async function loadAssetDetail(db: Queryable, where: 'id' | 'tag', value: number | string) {
  const condition = where === 'id' ? 'a.id = $1' : 'UPPER(a.asset_tag) = UPPER($1)';
  const { rows } = await db.query(`SELECT ${ASSET_COLUMNS}, a.qr_code ${ASSET_FROM} WHERE ${condition}`, [value]);
  const asset = rows[0];
  if (!asset) return null;

  const [{ rows: custody }, { rows: activity }] = await Promise.all([
    db.query(
      `SELECT c.id, c.user_id, c.holder_name, c.assigned_at, c.assign_notes, c.returned_at, c.return_notes,
              ab.full_name AS assigned_by_name, rb.full_name AS received_by_name
         FROM custody_assignments c
         LEFT JOIN users ab ON ab.id = c.assigned_by
         LEFT JOIN users rb ON rb.id = c.received_by
        WHERE c.asset_id = $1
        ORDER BY c.assigned_at DESC`,
      [asset.id],
    ),
    db.query(
      `SELECT id, action, actor_name, description, details, created_at
         FROM audit_logs WHERE asset_id = $1
        ORDER BY created_at DESC, id DESC LIMIT 50`,
      [asset.id],
    ),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return {
    ...asset,
    under_warranty: asset.warranty_end_date ? asset.warranty_end_date >= today : false,
    custody_history: custody,
    activity,
  };
}

// ---------------------------------------------------------------- list / read

const listQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  holderId: z.coerce.number().int().positive().optional(),
  sort: z.enum(['asset_tag', 'brand', 'purchase_date', 'status', 'updated_at']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

router.get('/', async (req, res) => {
  const { page, pageSize, q, status, category, departmentId, holderId, sort, order } = parse(listQuery, req.query);
  const w = new WhereBuilder();
  if (q) {
    const like = `%${q}%`;
    w.add(
      `(a.asset_tag ILIKE $? OR a.brand ILIKE $? OR a.model ILIKE $? OR a.serial_number ILIKE $? OR u.full_name ILIKE $?)`,
      like,
      like,
      like,
      like,
      like,
    );
  }
  if (status) w.add('a.status = $?', status);
  if (category) w.add('a.category = $?', category);
  if (departmentId) w.add('u.department_id = $?', departmentId);
  if (holderId) w.add('a.current_holder_id = $?', holderId);

  const where = w.toSql();
  const countParams = [...w.params];
  const limit = w.param(pageSize);
  const offset = w.param((page - 1) * pageSize);

  // `sort` and `order` are validated against a fixed whitelist above
  const [{ rows }, { rows: count }] = await Promise.all([
    pool.query(
      `SELECT ${ASSET_COLUMNS} ${ASSET_FROM} ${where}
        ORDER BY a.${sort} ${order.toUpperCase()}, a.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    ),
    pool.query(`SELECT COUNT(*) AS total ${ASSET_FROM} ${where}`, countParams),
  ]);
  ok(res, paginated(rows, count[0].total, page, pageSize), 'Assets retrieved');
});

router.get('/meta', (_req, res) => {
  ok(res, { categories: CATEGORIES, statuses: STATUSES }, 'Asset metadata');
});

/** Lookup by the tag encoded in the QR code (used by the mobile scanner) */
router.get('/tag/:tag', async (req, res) => {
  const tag = z.string().trim().min(1).max(30).parse(req.params.tag);
  const asset = await loadAssetDetail(pool, 'tag', tag);
  if (!asset) throw notFound('Asset');
  ok(res, asset, 'Asset retrieved');
});

router.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const asset = await loadAssetDetail(pool, 'id', id);
  if (!asset) throw notFound('Asset');
  ok(res, asset, 'Asset retrieved');
});

// ---------------------------------------------------------------- create / update / delete

const assetBody = z.object({
  category: z.enum(CATEGORIES),
  brand: z.string().trim().min(1, 'Brand is required').max(80),
  model: z.string().trim().min(1, 'Model is required').max(120),
  serialNumber: z.string().trim().min(1, 'Serial number is required').max(120),
  purchaseDate: isoDate,
  warrantyEndDate: isoDate.nullish().or(z.literal('')).transform((v) => v || null),
  notes: optionalText(2000),
});

router.post('/', requireAdmin, async (req, res) => {
  const body = parse(assetBody, req.body);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO assets (category, brand, model, serial_number, purchase_date, warranty_end_date, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_STOCK', $8)
       RETURNING id, asset_tag`,
      [body.category, body.brand, body.model, body.serialNumber, body.purchaseDate, body.warrantyEndDate, body.notes, req.user!.id],
    );
    const { id, asset_tag } = rows[0];

    // Unique QR code is generated automatically from the DB-assigned asset tag
    const qr = await generateAssetQr(asset_tag);
    await client.query('UPDATE assets SET qr_code = $1 WHERE id = $2', [qr, id]);

    await logAudit(client, {
      action: 'ASSET_CREATED',
      entityType: 'ASSET',
      entityId: id,
      assetId: id,
      actor: req.user,
      description: `Registered ${body.brand} ${body.model} as ${asset_tag}`,
      details: { asset_tag, serial_number: body.serialNumber, category: body.category },
    });
    return id as number;
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Asset created and QR code generated', 201);
});

const updateBody = assetBody.extend({ status: z.enum(STATUSES).optional() });

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const body = parse(updateBody, req.body);

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const before = rows[0];
    if (!before) throw notFound('Asset');

    // Keep status consistent with custody: ACTIVE <=> has a holder (unless FAULTY)
    const status = body.status ?? before.status;
    if (status === 'ACTIVE' && !before.current_holder_id) {
      throw new HttpError(400, 'Use "Assign" to activate an asset - it has no holder', 'INVALID_STATUS');
    }
    if (status === 'IN_STOCK' && before.current_holder_id) {
      throw new HttpError(400, 'Use "Return to stock" - this asset is still assigned', 'INVALID_STATUS');
    }

    await client.query(
      `UPDATE assets
          SET category = $1, brand = $2, model = $3, serial_number = $4, purchase_date = $5,
              warranty_end_date = $6, notes = $7, status = $8, updated_at = NOW()
        WHERE id = $9`,
      [body.category, body.brand, body.model, body.serialNumber, body.purchaseDate, body.warrantyEndDate, body.notes, status, id],
    );

    const changes = diff(
      {
        category: before.category,
        brand: before.brand,
        model: before.model,
        serial_number: before.serial_number,
        purchase_date: before.purchase_date,
        warranty_end_date: before.warranty_end_date,
        notes: before.notes,
        status: before.status,
      },
      {
        category: body.category,
        brand: body.brand,
        model: body.model,
        serial_number: body.serialNumber,
        purchase_date: body.purchaseDate,
        warranty_end_date: body.warrantyEndDate,
        notes: body.notes,
        status,
      },
    );
    await logAudit(client, {
      action: 'ASSET_UPDATED',
      entityType: 'ASSET',
      entityId: id,
      assetId: id,
      actor: req.user,
      description: `Updated ${before.asset_tag} (${Object.keys(changes).join(', ') || 'no changes'})`,
      details: { changes },
    });
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Asset updated successfully');
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const asset = rows[0];
    if (!asset) throw notFound('Asset');
    if (asset.current_holder_id) {
      throw new HttpError(409, 'This asset is assigned to an employee. Return it to stock before deleting.', 'ASSET_ASSIGNED');
    }
    // Log first; asset_id is set to NULL by the FK when the asset row is removed,
    // the tag and serial number are preserved in the description/details.
    await logAudit(client, {
      action: 'ASSET_DELETED',
      entityType: 'ASSET',
      entityId: id,
      assetId: id,
      actor: req.user,
      description: `Deleted asset ${asset.asset_tag} (${asset.brand} ${asset.model})`,
      details: { asset_tag: asset.asset_tag, serial_number: asset.serial_number },
    });
    await client.query('DELETE FROM assets WHERE id = $1', [id]);
  });
  ok(res, null, 'Asset deleted successfully');
});

// ---------------------------------------------------------------- custody operations

const assignBody = z.object({
  userId: z.coerce.number().int().positive(),
  notes: optionalText(1000),
});

router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { userId, notes } = parse(assignBody, req.body);

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const asset = rows[0];
    if (!asset) throw notFound('Asset');
    if (asset.current_holder_id) throw new HttpError(409, `${asset.asset_tag} is already assigned. Return it first.`, 'ASSET_ASSIGNED');
    if (asset.status === 'FAULTY') throw new HttpError(409, 'Faulty assets cannot be assigned. Resolve the fault first.', 'ASSET_FAULTY');

    const { rows: users } = await client.query('SELECT id, full_name, is_active FROM users WHERE id = $1', [userId]);
    const holder = users[0];
    if (!holder) throw notFound('Employee');
    if (!holder.is_active) throw new HttpError(409, 'Cannot assign assets to a deactivated user', 'USER_INACTIVE');

    const { rows: custody } = await client.query(
      `INSERT INTO custody_assignments (asset_id, user_id, holder_name, assigned_by, assign_notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, holder.id, holder.full_name, req.user!.id, notes],
    );
    await client.query(
      `UPDATE assets SET current_holder_id = $1, status = 'ACTIVE', updated_at = NOW() WHERE id = $2`,
      [holder.id, id],
    );
    await logAudit(client, {
      action: 'ASSET_ASSIGNED',
      entityType: 'CUSTODY',
      entityId: custody[0].id,
      assetId: id,
      actor: req.user,
      description: `Assigned ${asset.asset_tag} to ${holder.full_name}`,
      details: { user_id: holder.id, holder_name: holder.full_name, notes },
    });
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Asset assigned successfully');
});

const returnBody = z.object({
  condition: z.enum(['GOOD', 'FAULTY']).default('GOOD'),
  notes: optionalText(1000),
});

router.post('/:id/return', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { condition, notes } = parse(returnBody, req.body);

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const asset = rows[0];
    if (!asset) throw notFound('Asset');
    if (!asset.current_holder_id) throw new HttpError(409, `${asset.asset_tag} is not assigned to anyone`, 'ASSET_NOT_ASSIGNED');

    const { rows: closed } = await client.query(
      `UPDATE custody_assignments
          SET returned_at = NOW(), received_by = $1, return_notes = $2
        WHERE asset_id = $3 AND returned_at IS NULL
        RETURNING id, holder_name`,
      [req.user!.id, notes, id],
    );
    const newStatus = condition === 'FAULTY' ? 'FAULTY' : 'IN_STOCK';
    await client.query(
      `UPDATE assets SET current_holder_id = NULL, status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id],
    );
    const holderName = closed[0]?.holder_name ?? 'unknown holder';
    await logAudit(client, {
      action: 'ASSET_RETURNED',
      entityType: 'CUSTODY',
      entityId: closed[0]?.id ?? null,
      assetId: id,
      actor: req.user,
      description: `Received ${asset.asset_tag} back from ${holderName}${condition === 'FAULTY' ? ' (faulty)' : ''}`,
      details: { user_id: asset.current_holder_id, holder_name: holderName, condition, notes },
    });
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Asset returned to stock');
});

const faultBody = z.object({
  description: z.string().trim().min(3, 'Please describe the fault').max(1000),
});

/** Admins can report any asset; staff can only report assets in their own custody */
router.post('/:id/report-fault', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { description } = parse(faultBody, req.body);

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const asset = rows[0];
    if (!asset) throw notFound('Asset');
    if (req.user!.role !== 'Admin' && asset.current_holder_id !== req.user!.id) {
      throw new HttpError(403, 'You can only report faults for assets assigned to you', 'FORBIDDEN');
    }
    if (asset.status === 'FAULTY') throw new HttpError(409, `${asset.asset_tag} is already marked as faulty`, 'ALREADY_FAULTY');

    await client.query(`UPDATE assets SET status = 'FAULTY', updated_at = NOW() WHERE id = $1`, [id]);
    await logAudit(client, {
      action: 'FAULT_REPORTED',
      entityType: 'ASSET',
      entityId: id,
      assetId: id,
      actor: req.user,
      description: `Fault reported on ${asset.asset_tag}: ${description}`,
      details: { description, previous_status: asset.status },
    });
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Fault reported successfully');
});

const resolveBody = z.object({ notes: optionalText(1000) });

router.post('/:id/resolve-fault', requireAdmin, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { notes } = parse(resolveBody, req.body);

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const asset = rows[0];
    if (!asset) throw notFound('Asset');
    if (asset.status !== 'FAULTY') throw new HttpError(409, `${asset.asset_tag} is not marked as faulty`, 'NOT_FAULTY');

    const newStatus = asset.current_holder_id ? 'ACTIVE' : 'IN_STOCK';
    await client.query('UPDATE assets SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, id]);
    await logAudit(client, {
      action: 'FAULT_RESOLVED',
      entityType: 'ASSET',
      entityId: id,
      assetId: id,
      actor: req.user,
      description: `Fault resolved on ${asset.asset_tag}${notes ? `: ${notes}` : ''}`,
      details: { notes, new_status: newStatus },
    });
  });

  ok(res, await loadAssetDetail(pool, 'id', id), 'Fault marked as resolved');
});

export default router;
