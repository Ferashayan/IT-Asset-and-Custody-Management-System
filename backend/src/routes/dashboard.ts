import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { ok } from '../utils/http';

const router = Router();
router.use(requireAdmin);

router.get('/stats', async (_req, res) => {
  const [totals, byCategory, byDepartment, warranty, users, recent] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)                                    AS total,
              COUNT(*) FILTER (WHERE status = 'ACTIVE')   AS active,
              COUNT(*) FILTER (WHERE status = 'FAULTY')   AS faulty,
              COUNT(*) FILTER (WHERE status = 'IN_STOCK') AS in_stock
         FROM assets`,
    ),
    pool.query(
      `SELECT category, COUNT(*) AS count
         FROM assets GROUP BY category ORDER BY count DESC, category`,
    ),
    pool.query(
      `SELECT COALESCE(d.name, 'No department') AS department, COUNT(*) AS count
         FROM assets a
         JOIN users u ON u.id = a.current_holder_id
         LEFT JOIN departments d ON d.id = u.department_id
        GROUP BY d.name ORDER BY count DESC`,
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE warranty_end_date < CURRENT_DATE) AS expired,
              COUNT(*) FILTER (WHERE warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60) AS expiring_soon
         FROM assets`,
    ),
    pool.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM users`,
    ),
    pool.query(
      `SELECT l.id, l.action, l.actor_name, l.description, l.asset_id, l.created_at
         FROM audit_logs l
        WHERE l.action NOT IN ('LOGIN', 'LOGOUT')
        ORDER BY l.created_at DESC, l.id DESC LIMIT 8`,
    ),
  ]);

  ok(
    res,
    {
      assets: totals.rows[0],
      byCategory: byCategory.rows,
      byDepartment: byDepartment.rows,
      warranty: warranty.rows[0],
      users: users.rows[0],
      recentActivity: recent.rows,
    },
    'Dashboard statistics',
  );
});

export default router;
