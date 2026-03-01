/**
 * SEC-03: Input validation utilities for edge functions.
 * ISO 27001 A.14.2 — Security in development and support processes.
 *
 * Lightweight Zod-like validation without external dependencies.
 * Edge functions should validate all incoming request bodies.
 */

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
  }
}

/** Validate that a value is a non-empty string */
export function requireString(obj: Record<string, unknown>, field: string, maxLen = 500): string {
  const val = obj[field];
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new ValidationError(field, "required string");
  }
  if (val.length > maxLen) {
    throw new ValidationError(field, `must be <= ${maxLen} characters`);
  }
  return val.trim();
}

/** Validate UUID format */
export function requireUUID(obj: Record<string, unknown>, field: string): string {
  const val = requireString(obj, field, 36);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(val)) {
    throw new ValidationError(field, "invalid UUID");
  }
  return val;
}

/** Optional string field */
export function optionalString(obj: Record<string, unknown>, field: string, maxLen = 500): string | undefined {
  const val = obj[field];
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val !== "string") {
    throw new ValidationError(field, "must be a string");
  }
  if (val.length > maxLen) {
    throw new ValidationError(field, `must be <= ${maxLen} characters`);
  }
  return val.trim();
}

/** Validate number */
export function requireNumber(obj: Record<string, unknown>, field: string, min?: number, max?: number): number {
  const val = obj[field];
  if (typeof val !== "number" || isNaN(val)) {
    throw new ValidationError(field, "required number");
  }
  if (min !== undefined && val < min) throw new ValidationError(field, `must be >= ${min}`);
  if (max !== undefined && val > max) throw new ValidationError(field, `must be <= ${max}`);
  return val;
}

/** Validate array */
export function requireArray(obj: Record<string, unknown>, field: string, maxLen = 1000): unknown[] {
  const val = obj[field];
  if (!Array.isArray(val)) {
    throw new ValidationError(field, "required array");
  }
  if (val.length > maxLen) {
    throw new ValidationError(field, `must have <= ${maxLen} items`);
  }
  return val;
}

/** Safe JSON body parser */
export async function parseAndValidateBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("body", "must be a JSON object");
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("body", "invalid JSON");
  }
}
