import { Response } from 'express';
import { z } from 'zod';

/** Standard success envelope: { success, message, data, error } */
export function ok<T>(res: Response, data: T, message = 'Action completed successfully', status = 200) {
  return res.status(status).json({ success: true, message, data, error: null });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`, 'NOT_FOUND');

/** Parse and validate input; throws ZodError (handled by the error middleware) */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input);
}

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

/** Empty strings from HTML forms become null */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format');

/**
 * Small helper to build dynamic WHERE clauses while keeping every value parameterized.
 * Usage: w.add('a.status = $?', status) -> placeholders are numbered automatically.
 */
export class WhereBuilder {
  readonly params: unknown[] = [];
  private readonly clauses: string[] = [];

  add(clause: string, ...values: unknown[]) {
    let sql = clause;
    for (const value of values) {
      this.params.push(value);
      sql = sql.replace('$?', `$${this.params.length}`);
    }
    this.clauses.push(sql);
    return this;
  }

  /** Reference a new parameter without adding a clause (e.g. LIMIT/OFFSET) */
  param(value: unknown) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  toSql() {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}
