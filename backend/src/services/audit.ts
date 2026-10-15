import { Queryable } from '../db/pool';
import { AuthUser } from '../middleware/auth';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_DELETED'
  | 'ASSET_CREATED'
  | 'ASSET_UPDATED'
  | 'ASSET_DELETED'
  | 'ASSET_ASSIGNED'
  | 'ASSET_RETURNED'
  | 'FAULT_REPORTED'
  | 'FAULT_RESOLVED';

export interface AuditEntry {
  action: AuditAction;
  entityType: 'USER' | 'DEPARTMENT' | 'ASSET' | 'CUSTODY';
  entityId?: number | null;
  assetId?: number | null;
  actor?: Pick<AuthUser, 'id' | 'fullName'> | null;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Append an entry to the audit log. Pass the transaction client when called
 * inside a transaction so the log entry commits/rolls back with the change.
 */
export async function logAudit(db: Queryable, entry: AuditEntry) {
  await db.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, asset_id, actor_id, actor_name, description, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.assetId ?? null,
      entry.actor?.id ?? null,
      entry.actor?.fullName ?? 'System',
      entry.description,
      JSON.stringify(entry.details ?? {}),
    ],
  );
}

/** Returns { field: { from, to } } for fields whose value changed */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (after[key] !== undefined && before[key] !== after[key]) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}
