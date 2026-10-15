import bcrypt from 'bcryptjs';
import { generateAssetQr } from '../services/qr';
import { logAudit } from '../services/audit';
import { pool, withTransaction } from './pool';

const DEPARTMENTS = ['Information Technology', 'Finance', 'Human Resources', 'Sales', 'Operations'];

const STAFF = [
  { username: 'ahmet.yilmaz', fullName: 'Ahmet Yılmaz', dept: 'Information Technology' },
  { username: 'elif.kaya', fullName: 'Elif Kaya', dept: 'Finance' },
  { username: 'mehmet.demir', fullName: 'Mehmet Demir', dept: 'Sales' },
  { username: 'zeynep.celik', fullName: 'Zeynep Çelik', dept: 'Human Resources' },
  { username: 'can.ozturk', fullName: 'Can Öztürk', dept: 'Operations' },
  { username: 'sara.aydin', fullName: 'Sara Aydın', dept: 'Sales' },
];

// [category, brand, model, serial, purchaseDate, warrantyEnd, holderUsername | null, faulty]
type Row = [string, string, string, string, string, string | null, string | null, boolean];
const ASSETS: Row[] = [
  ['Laptop', 'Dell', 'Latitude 5440', 'DL5440-8H2K91', '2024-02-12', '2027-02-12', 'ahmet.yilmaz', false],
  ['Laptop', 'Lenovo', 'ThinkPad T14 Gen 4', 'LNV-T14-PF3X8Q', '2023-09-05', '2026-09-05', 'elif.kaya', false],
  ['Laptop', 'Apple', 'MacBook Pro 14 M3', 'C02XK1ZHMD6T', '2024-06-20', '2025-06-20', 'mehmet.demir', false],
  ['Laptop', 'HP', 'EliteBook 840 G10', 'HP840-5CG3421', '2023-03-14', '2026-03-14', null, false],
  ['Desktop', 'Dell', 'OptiPlex 7010', 'OPX7010-JD8812', '2022-11-02', '2025-11-02', 'zeynep.celik', false],
  ['Desktop', 'HP', 'ProDesk 400 G9', 'HPPD-8CC2291', '2023-01-18', '2026-01-18', null, true],
  ['Monitor', 'Dell', 'P2723DE 27"', 'CN-0P2723-74', '2024-02-12', '2027-02-12', 'ahmet.yilmaz', false],
  ['Monitor', 'LG', '27UL550-W', 'LG27-204NTXR', '2023-05-10', '2026-05-10', 'elif.kaya', false],
  ['Monitor', 'Samsung', 'S24R350', 'SMS24-H4ZM90', '2021-08-30', '2024-08-30', null, false],
  ['Server', 'Dell', 'PowerEdge R750', 'PER750-7XQ1K2', '2022-04-01', '2027-04-01', null, false],
  ['Server', 'HPE', 'ProLiant DL380 Gen10', 'HPE-DL380-CZ21', '2021-10-15', '2026-10-15', null, true],
  ['Printer', 'HP', 'LaserJet Pro M404dn', 'PHBQ9-30122', '2022-06-07', '2024-06-07', 'can.ozturk', false],
  ['Network', 'Cisco', 'Catalyst 9200L-24P', 'FOC2433X0K1', '2023-07-22', '2028-07-22', null, false],
  ['Phone', 'Apple', 'iPhone 15', 'F2LXQ0P9N7', '2024-09-25', '2025-09-25', 'sara.aydin', false],
  ['Tablet', 'Samsung', 'Galaxy Tab S9', 'R52W80GKX3E', '2024-01-08', '2026-01-08', null, false],
  ['Peripheral', 'Logitech', 'MX Keys + MX Master 3S', 'LGT-2349MX55', '2024-03-03', null, 'mehmet.demir', false],
];

/** Inserts realistic demo data the first time the app starts with SEED_DEMO_DATA=true. */
export async function seedDemoData() {
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM assets');
  if (rows[0].n > 0) {
    console.log('[seed] assets already exist - skipping demo data');
    return;
  }

  await withTransaction(async (client) => {
    const { rows: admins } = await client.query(`SELECT id, full_name FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1`);
    const admin = { id: admins[0].id as number, fullName: admins[0].full_name as string };

    const deptIds = new Map<string, number>();
    for (const name of DEPARTMENTS) {
      const { rows } = await client.query(
        `INSERT INTO departments (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name],
      );
      deptIds.set(name, rows[0].id);
    }
    await client.query(`UPDATE users SET department_id = $1 WHERE id = $2 AND department_id IS NULL`, [
      deptIds.get('Information Technology'),
      admin.id,
    ]);

    const hash = await bcrypt.hash('Staff@123', 10);
    const userIds = new Map<string, { id: number; fullName: string }>();
    for (const s of STAFF) {
      const { rows } = await client.query(
        `INSERT INTO users (username, password_hash, full_name, email, role, department_id)
         VALUES ($1, $2, $3, $4, 'Staff', $5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [s.username, hash, s.fullName, `${s.username}@company.local`, deptIds.get(s.dept)],
      );
      if (rows[0]) userIds.set(s.username, { id: rows[0].id, fullName: s.fullName });
    }

    for (const [category, brand, model, serial, purchased, warranty, holder, faulty] of ASSETS) {
      const { rows } = await client.query(
        `INSERT INTO assets (category, brand, model, serial_number, purchase_date, warranty_end_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $5::date + TIME '09:00') RETURNING id, asset_tag`,
        [category, brand, model, serial, purchased, warranty, admin.id],
      );
      const { id, asset_tag } = rows[0];
      await client.query('UPDATE assets SET qr_code = $1 WHERE id = $2', [await generateAssetQr(asset_tag), id]);
      await logAudit(client, {
        action: 'ASSET_CREATED',
        entityType: 'ASSET',
        entityId: id,
        assetId: id,
        actor: admin,
        description: `Registered ${brand} ${model} as ${asset_tag}`,
        details: { asset_tag, serial_number: serial, category, seeded: true },
      });

      const user = holder ? userIds.get(holder) : undefined;
      if (user) {
        const { rows: c } = await client.query(
          `INSERT INTO custody_assignments (asset_id, user_id, holder_name, assigned_by, assign_notes)
           VALUES ($1, $2, $3, $4, 'Initial assignment') RETURNING id`,
          [id, user.id, user.fullName, admin.id],
        );
        await client.query(`UPDATE assets SET current_holder_id = $1, status = 'ACTIVE' WHERE id = $2`, [user.id, id]);
        await logAudit(client, {
          action: 'ASSET_ASSIGNED',
          entityType: 'CUSTODY',
          entityId: c[0].id,
          assetId: id,
          actor: admin,
          description: `Assigned ${asset_tag} to ${user.fullName}`,
          details: { user_id: user.id, holder_name: user.fullName },
        });
      }
      if (faulty) {
        await client.query(`UPDATE assets SET status = 'FAULTY' WHERE id = $1`, [id]);
        await logAudit(client, {
          action: 'FAULT_REPORTED',
          entityType: 'ASSET',
          entityId: id,
          assetId: id,
          actor: admin,
          description: `Fault reported on ${asset_tag}: Does not power on`,
          details: { description: 'Does not power on' },
        });
      }
    }
  });
  console.log(`[seed] inserted demo data: ${DEPARTMENTS.length} departments, ${STAFF.length} staff, ${ASSETS.length} assets`);
}

if (require.main === module) {
  seedDemoData()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
