import "server-only";

import { neon } from "@neondatabase/serverless";

import { isValidStockholmLocalTime, parseLocalDateTime, stockholmDateToUtc } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export class AvailabilityBlockValidationError extends Error {
  constructor(public readonly code: "time" | "past" | "range" | "weekdays" | "conflict") {
    super(code);
    this.name = "AvailabilityBlockValidationError";
  }
}

async function requireWorkspaceAccess() {
  if (!connectionString) throw new Error("Missing database connection for availability blocks");

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for availability blocks");
  }

  return access;
}

function normalizeReason(value: string) {
  return value.trim().slice(0, 180) || "Blockerad tid";
}

async function hasConflict(
  sql: ReturnType<typeof neon>,
  workspaceId: string,
  startsAt: Date,
  endsAt: Date,
) {
  const conflicts = await sql`
    select id
    from bookings
    where workspace_id = ${workspaceId}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${endsAt.toISOString()}::timestamptz
      and ends_at > ${startsAt.toISOString()}::timestamptz
    limit 1
  `;
  return Boolean(conflicts[0]);
}

async function insertBlock(
  sql: ReturnType<typeof neon>,
  workspaceId: string,
  startsAt: Date,
  endsAt: Date,
  reason: string,
  source: "dashboard_availability_block" | "dashboard_availability_recurring_block",
) {
  const rows = await sql`
    insert into bookings (
      workspace_id,
      customer_id,
      title,
      service,
      city,
      status,
      starts_at,
      ends_at,
      source,
      notes
    )
    values (
      ${workspaceId},
      null,
      ${reason},
      'Blockerad tid',
      null,
      'confirmed',
      ${startsAt.toISOString()}::timestamptz,
      ${endsAt.toISOString()}::timestamptz,
      ${source},
      ${reason}
    )
    returning id
  `;
  return String(rows[0]?.id ?? "");
}

export async function createDashboardAvailabilityBlock(input: {
  localStartsAt: string;
  localEndsAt: string;
  reason: string;
}) {
  const access = await requireWorkspaceAccess();
  const startParts = parseLocalDateTime(input.localStartsAt);
  const endParts = parseLocalDateTime(input.localEndsAt);
  if (!startParts || !endParts) throw new AvailabilityBlockValidationError("time");

  const startsAt = stockholmDateToUtc(startParts);
  const endsAt = stockholmDateToUtc(endParts);
  if (
    !isValidStockholmLocalTime(startParts, startsAt) ||
    !isValidStockholmLocalTime(endParts, endsAt) ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new AvailabilityBlockValidationError("time");
  }

  if (startsAt <= new Date()) throw new AvailabilityBlockValidationError("past");
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 31 * 86_400_000) {
    throw new AvailabilityBlockValidationError("range");
  }

  const reason = normalizeReason(input.reason);
  const sql = neon(connectionString!);
  if (await hasConflict(sql, access.workspaceId, startsAt, endsAt)) {
    throw new AvailabilityBlockValidationError("conflict");
  }

  const id = await insertBlock(sql, access.workspaceId, startsAt, endsAt, reason, "dashboard_availability_block");
  return { id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export async function createDashboardRecurringAvailabilityBlocks(input: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  weekdays: number[];
  reason: string;
}) {
  const access = await requireWorkspaceAccess();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    !datePattern.test(input.startDate) ||
    !datePattern.test(input.endDate) ||
    !timePattern.test(input.startTime) ||
    !timePattern.test(input.endTime)
  ) {
    throw new AvailabilityBlockValidationError("time");
  }

  const weekdays = [...new Set(input.weekdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (!weekdays.length) throw new AvailabilityBlockValidationError("weekdays");

  const startDay = new Date(`${input.startDate}T00:00:00Z`);
  const endDay = new Date(`${input.endDate}T00:00:00Z`);
  const rangeMs = endDay.getTime() - startDay.getTime();
  if (!Number.isFinite(rangeMs) || rangeMs < 0 || rangeMs > 366 * 86_400_000 || input.endTime <= input.startTime) {
    throw new AvailabilityBlockValidationError("range");
  }

  const now = new Date();
  const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (let cursor = new Date(startDay); cursor <= endDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!weekdays.includes(cursor.getUTCDay())) continue;
    const date = cursor.toISOString().slice(0, 10);
    const startParts = parseLocalDateTime(`${date}T${input.startTime}`);
    const endParts = parseLocalDateTime(`${date}T${input.endTime}`);
    if (!startParts || !endParts) throw new AvailabilityBlockValidationError("time");

    const startsAt = stockholmDateToUtc(startParts);
    const endsAt = stockholmDateToUtc(endParts);
    if (
      !isValidStockholmLocalTime(startParts, startsAt) ||
      !isValidStockholmLocalTime(endParts, endsAt) ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      throw new AvailabilityBlockValidationError("time");
    }
    if (startsAt <= now) continue;
    occurrences.push({ startsAt, endsAt });
  }

  if (!occurrences.length) throw new AvailabilityBlockValidationError("past");
  if (occurrences.length > 366) throw new AvailabilityBlockValidationError("range");

  const sql = neon(connectionString!);
  for (const occurrence of occurrences) {
    if (await hasConflict(sql, access.workspaceId, occurrence.startsAt, occurrence.endsAt)) {
      throw new AvailabilityBlockValidationError("conflict");
    }
  }

  const reason = normalizeReason(input.reason);
  const ids: string[] = [];
  for (const occurrence of occurrences) {
    ids.push(
      await insertBlock(
        sql,
        access.workspaceId,
        occurrence.startsAt,
        occurrence.endsAt,
        reason,
        "dashboard_availability_recurring_block",
      ),
    );
  }

  return { count: ids.length, ids };
}
