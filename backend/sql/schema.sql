-- =====================================================================
-- IT Asset & Custody Management System - PostgreSQL schema (idempotent)
-- Executed automatically by the backend on startup (src/db/migrate.ts)
-- =====================================================================

CREATE TABLE IF NOT EXISTS departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL,
    password_hash  TEXT         NOT NULL,
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(160),
    role           VARCHAR(10)  NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
    department_id  INT REFERENCES departments(id) ON DELETE SET NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    -- incremented on password change/reset to invalidate previously issued JWTs
    token_version  INT          NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq    ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX        IF NOT EXISTS users_department_idx    ON users (department_id);

-- Human-readable, unique asset tags (AST-000001, AST-000002, ...) are encoded in each QR code
CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1;

CREATE TABLE IF NOT EXISTS assets (
    id                 SERIAL PRIMARY KEY,
    asset_tag          VARCHAR(30)  NOT NULL UNIQUE
                       DEFAULT ('AST-' || LPAD(nextval('asset_tag_seq')::TEXT, 6, '0')),
    category           VARCHAR(30)  NOT NULL CHECK (category IN
                       ('Laptop', 'Desktop', 'Server', 'Monitor', 'Printer', 'Network', 'Phone', 'Tablet', 'Peripheral', 'Other')),
    brand              VARCHAR(80)  NOT NULL,
    model              VARCHAR(120) NOT NULL,
    serial_number      VARCHAR(120) NOT NULL UNIQUE,
    purchase_date      DATE         NOT NULL,
    warranty_end_date  DATE,
    status             VARCHAR(10)  NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN ('ACTIVE', 'FAULTY', 'IN_STOCK')),
    notes              TEXT,
    qr_code            TEXT,        -- PNG data URL generated on creation
    current_holder_id  INT REFERENCES users(id) ON DELETE RESTRICT,
    created_by         INT REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT warranty_after_purchase CHECK (warranty_end_date IS NULL OR warranty_end_date >= purchase_date)
);
CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status);
CREATE INDEX IF NOT EXISTS assets_holder_idx ON assets (current_holder_id);

-- One-to-many: an asset has many custody records over time, a user has many custody records
CREATE TABLE IF NOT EXISTS custody_assignments (
    id            SERIAL PRIMARY KEY,
    asset_id      INT          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id       INT          REFERENCES users(id) ON DELETE SET NULL,
    holder_name   VARCHAR(120) NOT NULL,   -- snapshot, survives user deletion
    assigned_by   INT          REFERENCES users(id) ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    assign_notes  TEXT,
    returned_at   TIMESTAMPTZ,
    received_by   INT          REFERENCES users(id) ON DELETE SET NULL,
    return_notes  TEXT,
    CONSTRAINT returned_after_assigned CHECK (returned_at IS NULL OR returned_at >= assigned_at)
);
-- An asset can have at most one open (not yet returned) custody record
CREATE UNIQUE INDEX IF NOT EXISTS custody_one_open_per_asset ON custody_assignments (asset_id) WHERE returned_at IS NULL;
CREATE INDEX        IF NOT EXISTS custody_user_idx           ON custody_assignments (user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    action       VARCHAR(40)  NOT NULL,
    entity_type  VARCHAR(20)  NOT NULL,
    entity_id    INT,
    asset_id     INT          REFERENCES assets(id) ON DELETE SET NULL,
    actor_id     INT          REFERENCES users(id) ON DELETE SET NULL,
    actor_name   VARCHAR(120),
    description  TEXT         NOT NULL,
    details      JSONB        NOT NULL DEFAULT '{}'::JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_asset_idx   ON audit_logs (asset_id);
CREATE INDEX IF NOT EXISTS audit_action_idx  ON audit_logs (action);
