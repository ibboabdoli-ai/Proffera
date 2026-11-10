/**
 * PostgreSQL drivers may return timestamptz as a Date rather than a string.
 * String(date) drops milliseconds; retain them when checking persisted
 * booking revisions and appointment times after a Maria email lock.
 */
export function postgresTimestampIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid PostgreSQL booking timestamp");
  return date.toISOString();
}
