# IT Asset & Custody Management System
### IT Demirbaş ve Zimmet Yönetim Sistemi

A full-stack corporate application to **register, track and manage IT hardware** (laptops, servers, monitors, …) and **who holds each device**. Every asset gets a unique QR code on creation; every hand-over, return and fault is recorded in a custody ledger and an immutable audit log.

| Layer | Technology |
|---|---|
| Backend API | Node.js 22 · TypeScript · Express 5 · **raw SQL with `pg`** (no ORM) · Zod validation |
| Database | PostgreSQL 16 |
| Auth | JWT (Bearer) · bcrypt · Role-Based Access Control (`Admin`, `Staff`) |
| Web | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui-style components · TanStack React Query · Sonner toasts |
| Mobile (bonus) | Flutter · `mobile_scanner` (camera QR) · `flutter_secure_storage` (JWT) |
| DevOps | Docker multi-stage builds · docker compose · nginx |

---

## Screenshots

| Dashboard | Asset inventory |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Assets](docs/screenshots/assets.png) |

| Asset detail + QR code + custody history | Assigning an asset (zimmetleme) |
|---|---|
| ![Asset detail](docs/screenshots/asset-detail.png) | ![Assign](docs/screenshots/assign-dialog.png) |

| Register asset (QR generated automatically) | Filter by status |
|---|---|
| ![New asset](docs/screenshots/new-asset.png) | ![Filtered](docs/screenshots/assets-filtered.png) |

| User management | Audit log |
|---|---|
| ![Users](docs/screenshots/users.png) | ![Audit](docs/screenshots/audit-logs.png) |

| Custody ledger | Staff view – "My assets" |
|---|---|
| ![Custody](docs/screenshots/custody.png) | ![My assets](docs/screenshots/staff-my-assets.png) |

| Login | Responsive (phone) |
|---|---|
| ![Login](docs/screenshots/login.png) | <img src="docs/screenshots/mobile-dashboard.png" width="200"/> <img src="docs/screenshots/mobile-assets.png" width="200"/> |

---

## Features

### Authentication & roles
- JWT login / logout, session restored on reload, automatic sign-out on expired/revoked tokens.
- **Admin**: full access. **Staff**: read-only inventory, "My assets", report faults on their own devices, change own password.
- Tokens are revoked immediately when a password is changed/reset, a user is deactivated, or their role changes (`token_version`).
- Admin user CRUD with password reset; guards against deleting yourself or a user who still holds assets.

### Inventory
- Asset CRUD (category, brand, model, serial number, purchase date, warranty end, notes).
- **Automatic unique asset tag** (`AST-000001`, from a PostgreSQL sequence) and **QR code** (PNG) on creation — download or print a label from the asset page.
- Real-time debounced search (tag / brand / model / serial / holder), filters by **status**, **category** and **department**, server-side pagination. Filters are kept in the URL, so links are shareable.

### Custody (zimmet) & audit
- Assign to an employee → status `ACTIVE`; return to stock (good or faulty) → `IN_STOCK` / `FAULTY`; report fault / mark repaired.
- **One-to-many** relational model: `users 1─* custody_assignments *─1 assets`; a partial unique index guarantees an asset has at most one open custody record.
- Every multi-table change runs in an explicit `BEGIN / COMMIT / ROLLBACK` transaction with `SELECT … FOR UPDATE` row locks, and writes its audit entry inside the same transaction.
- Audit log of logins, user/department/asset changes (with field-level diffs), assignments, returns and faults — filterable by action and date range.

### Dashboard
- Total / active / faulty / in-stock counts, status breakdown, assets by category, assigned assets by department, warranty expiring ≤ 60 days, recent activity.

### Mobile app (Flutter)
- Secure login (JWT in Android Keystore / iOS Keychain).
- **Camera QR scanner** → asset details (warranty, purchase date, current holder, custody history). Manual tag entry fallback.
- Field operations: **Handover to staff**, **Receive asset back**, **Report fault** (permissions mirror the web).
- **My Assets** screen listing everything in the user's custody; profile screen with sign-out.

---

## Quick start (Docker — one command)

Requirements: Docker Desktop (or Docker Engine + compose plugin).

```bash
git clone <your-repo-url> it-asset-management
cd it-asset-management
cp .env.example .env          # optional – defaults work out of the box
docker compose up -d --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:8080 |
| REST API | http://localhost:4000/api (also proxied at http://localhost:8080/api) |
| PostgreSQL | localhost:5432 (`itam` / `itam_password`) |

On first start the backend creates the schema, an admin account and (with `SEED_DEMO_DATA=true`) demo data.

**Demo accounts**

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Staff | `ahmet.yilmaz`, `elif.kaya`, `mehmet.demir`, `zeynep.celik`, `can.ozturk`, `sara.aydin` | `Staff@123` |

> ⚠️ Change `JWT_SECRET` and `ADMIN_PASSWORD` before deploying anywhere real.

Useful commands:

```bash
docker compose logs -f backend      # follow API logs
docker compose down                 # stop
docker compose down -v              # stop and wipe the database
```

---

## Environment variables

All variables live in [`.env.example`](.env.example). Copy it to `.env` in the project root for Docker, or to `backend/.env` when running the API directly.

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `itam` / `itam` / `itam_password` | Database credentials (Docker) |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `DATABASE_URL` | `postgres://itam:itam_password@localhost:5432/itam` | Connection string (non-Docker backend) |
| `PORT` | `4000` | API port inside the container / process |
| `API_PORT` | `4000` | Host port exposing the API (used by the mobile app) |
| `JWT_SECRET` | *(dev fallback)* | **Required in production**, ≥ 16 chars |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime (`30m`, `8h`, `7d`, …) |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` / `ADMIN_EMAIL` | `admin` / `Admin@123` / … | Initial admin, created only if no admin exists |
| `SEED_DEMO_DATA` | `true` (compose) | Insert demo departments, staff and assets when the DB is empty |
| `WEB_PORT` | `8080` | Host port for the web app |
| `VITE_API_URL` | `/api` | Optional API URL baked into the web build |

---

## Local development (without Docker)

Requirements: Node.js 20+ and PostgreSQL 15+.

```bash
# 1. Database (or run only the db container: docker compose up -d db)
createdb itam

# 2. Backend
cd backend
cp ../.env.example .env        # set DATABASE_URL to your local database
npm install
npm run dev                    # http://localhost:4000 – schema is created automatically
npm run seed                   # optional demo data

# 3. Web (new terminal)
cd web
npm install
npm run dev                    # http://localhost:5173 – /api is proxied to :4000
```

Other scripts: `npm run build`, `npm run typecheck` (both projects), `npm run migrate` (backend).

### Mobile app

Requirements: Flutter 3.22+ and an Android device/emulator or iOS device.

```bash
cd mobile
flutter pub get
# Android emulator reaches your PC at 10.0.2.2 (the default)
flutter run
# Physical device: use your computer's LAN IP
flutter run --dart-define=API_URL=http://192.168.1.50:4000/api
```

The `android/` and `ios/` folders already contain the camera permission (`CAMERA` / `NSCameraUsageDescription`) and allow plain-HTTP traffic for local testing. Use HTTPS in production.

---

## Project structure

```
.
├── docker-compose.yml        # db + backend + web
├── .env.example
├── backend/
│   ├── sql/schema.sql        # tables, constraints, indexes (idempotent)
│   └── src/
│       ├── app.ts / index.ts # Express app, startup (migrate → seed → listen)
│       ├── config.ts
│       ├── db/               # pg pool + withTransaction(), migrate, seed
│       ├── middleware/       # JWT auth + RBAC, error handler
│       ├── routes/           # auth, users, departments, assets, custody, audit-logs, dashboard
│       ├── services/         # audit logger, QR generator
│       └── utils/http.ts     # response envelope, validation, WhereBuilder
├── web/
│   ├── nginx.conf            # serves SPA + proxies /api
│   └── src/
│       ├── components/       # layout, dialogs, ui/ (shadcn-style primitives)
│       ├── context/          # AuthContext
│       ├── hooks/            # useApiMutation (toasts + cache invalidation), useDebounce
│       ├── lib/              # api client, types, utils
│       └── pages/            # Dashboard, Assets, AssetDetail, Custody, Users, Departments, AuditLogs, MyAssets, Profile
├── mobile/
│   └── lib/                  # models, services (api, auth), screens (login, my assets, scanner, detail, profile)
└── docs/screenshots/
```

---

## Database schema

```
departments (id, name)
     │1
     │*
users (id, username, password_hash, full_name, email, role[Admin|Staff], department_id, is_active, token_version)
     │1                                         │1
     │*                                         │* (current_holder_id)
custody_assignments                        assets (id, asset_tag, category, brand, model, serial_number,
 (id, asset_id, user_id, holder_name,  *──1        purchase_date, warranty_end_date, status[ACTIVE|FAULTY|IN_STOCK],
  assigned_by, assigned_at, assign_notes,         notes, qr_code, current_holder_id, created_by)
  returned_at, received_by, return_notes)
                                           audit_logs (id, action, entity_type, entity_id, asset_id,
                                                       actor_id, actor_name, description, details JSONB, created_at)
```

Integrity is enforced in the database: unique serial numbers and case-insensitive usernames, `CHECK` constraints for roles/statuses/categories and warranty ≥ purchase date, and a partial unique index allowing only one open custody record per asset. History keeps a `holder_name` / `actor_name` snapshot so it survives user deletion.

---

## API reference

All responses use one envelope:

```json
{ "success": true, "message": "Action completed successfully", "data": {}, "error": null }
```

Errors: `{ "success": false, "message": "…", "data": null, "error": { "code": "VALIDATION_ERROR", "details": [...] } }`
with status codes 400 (validation), 401 (auth), 403 (role), 404, 409 (conflict, e.g. duplicate serial / already assigned).

Authenticate with `Authorization: Bearer <token>`. 🔒 = Admin only.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Log out (audited) |
| PUT | `/api/auth/password` | `{ currentPassword, newPassword }` → new token |
| GET | `/api/dashboard/stats` 🔒 | Dashboard metrics |
| GET | `/api/assets` | `?q&status&category&departmentId&holderId&page&pageSize&sort&order` |
| GET | `/api/assets/:id` | Detail incl. QR code, custody history, activity |
| GET | `/api/assets/tag/:tag` | Lookup by QR content (mobile scanner) |
| POST | `/api/assets` 🔒 | Create (tag + QR generated) |
| PUT | `/api/assets/:id` 🔒 | Update |
| DELETE | `/api/assets/:id` 🔒 | Delete (must not be assigned) |
| POST | `/api/assets/:id/assign` 🔒 | `{ userId, notes? }` |
| POST | `/api/assets/:id/return` 🔒 | `{ condition: GOOD\|FAULTY, notes? }` |
| POST | `/api/assets/:id/report-fault` | `{ description }` — admin or current holder |
| POST | `/api/assets/:id/resolve-fault` 🔒 | `{ notes? }` |
| GET | `/api/custody/me` | My current assets + past custody |
| GET | `/api/custody` 🔒 | Custody ledger `?q&state=open\|closed&userId&assetId` |
| GET/POST/PUT/DELETE | `/api/users`, `/api/users/:id` 🔒 | User CRUD (`?q&role&departmentId&status`) |
| GET | `/api/users/options` 🔒 | Active users for pickers |
| PUT | `/api/users/:id/password` 🔒 | Reset password (revokes sessions) |
| GET | `/api/departments` | List with user/asset counts |
| POST/PUT/DELETE | `/api/departments[/:id]` 🔒 | Department CRUD |
| GET | `/api/audit-logs` 🔒 | `?q&action&entityType&assetId&actorId&from&to` |
| GET | `/api/health` | Health check |

---

## Security notes
- 100 % parameterized SQL (`pool.query(text, values)`); dynamic `WHERE` clauses are built with numbered placeholders and sort columns come from a whitelist.
- Passwords hashed with bcrypt; constant-time login response for unknown usernames.
- `helmet` security headers, JSON body size limit, CORS allow-list.
- Containers run the API as the non-root `node` user.
