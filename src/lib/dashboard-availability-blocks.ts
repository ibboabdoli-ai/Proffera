import "server-only";

import { neon } from "@neondatabase/serverless";

import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime, resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function createSqlClient() {
  return neon(connectionString!);
}

type SqlClient = ReturnType<typeof createSqlClient>;

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

async function getWorkspaceTimeZone(sql: SqlClient, workspaceId: string) {
  const rows = await sql`
    select time_zone
    from workspace_settings
    where workspace_id = ${workspaceId}
    limit 1
  `;
  return resolveBookingTimeZone(rows[0]?.time_zone);
}

async function hasConflict(
  sql: SqlClient,
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
  sql: SqlClient,
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
  const sql = createSqlClient();
  const timeZone = await getWorkspaceTimeZone(sql, access.workspaceId);
  const startParts = parseLocalDateTime(input.localStartsAt);
  const endParts = parseLocalDateTime(input.localEndsAt);
  if (!startParts || !endParts) throw new AvailabilityBlockValidationError("time");

  const startsAt = localDateTimeToUtc(startParts, timeZone);
  const endsAt = localDateTimeToUtc(endParts, timeZone);
  if (
    !isValidLocalTime(startParts, startsAt, timeZone) ||
    !isValidLocalTime(endParts, endsAt, timeZone) ||
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
  const sql = createSqlClient();
  const timeZone = await getWorkspaceTimeZone(sql, access.workspaceId);
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
  const occurrences: Array<{ startsAt: string; endsAt: string }> = [];
  for (let cursor = new Date(startDay); cursor <= endDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!weekdays.includes(cursor.getUTCDay())) continue;
    const date = cursor.toISOString().slice(0, 10);
    const startParts = parseLocalDateTime(`${date}T${input.startTime}`);
    const endParts = parseLocalDateTime(`${date}T${input.endTime}`);
    if (!startParts || !endParts) throw new AvailabilityBlockValidationError("time");

    const startsAt = localDateTimeToUtc(startParts, timeZone);
    const endsAt = localDateTimeToUtc(endParts, timeZone);
    if (
      !isValidLocalTime(startParts, startsAt, timeZone) ||
      !isValidLocalTime(endParts, endsAt, timeZone) ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      throw new AvailabilityBlockValidationError("time");
    }
    if (startsAt <= now) continue;
    occurrences.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
  }

  if (!occurrences.length) throw new AvailabilityBlockValidationError("past");
  if (occurrences.length > 366) throw new AvailabilityBlockValidationError("range");

  const reason = normalizeReason(input.reason);
  const rows = await sql`
    with requested as (
      select
        value->>'startsAt' as starts_at_text,
        value->>'endsAt' as ends_at_text
      from jsonb_array_elements(${JSON.stringify(occurrences)}::jsonb)
    ),
    normalized as (
      select
        starts_at_text::timestamptz as starts_at,
        ends_at_text::timestamptz as ends_at
      from requested
    ),
    conflicts as (
      select 1
      from normalized n
      join bookings b
        on b.workspace_id = ${access.workspaceId}
       and b.status not in ('cancelled', 'no_show')
       and b.starts_at < n.ends_at
       and b.ends_at > n.starts_at
      limit 1
    ),
    inserted as (
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
      select
        ${access.workspaceId},
        null,
        ${reason},
        'Blockerad tid',
        null,
        'confirmed',
        n.starts_at,
        n.ends_at,
        'dashboard_availability_recurring_block',
        ${reason}
      from normalized n
      where not exists (select 1 from conflicts)
      returning id
    )
    select
      exists(select 1 from conflicts) as has_conflict,
      coalesce((select json_agg(id) from inserted), '[]'::json) as ids
  `;

  if (Boolean(rows[0]?.has_conflict)) {
    throw new AvailabilityBlockValidationError("conflict");
  }

  const idsValue = rows[0]?.ids;
  const ids = Array.isArray(idsValue) ? idsValue.map((id) => String(id)) : [];
  if (ids.length !== occurrences.length) {
    throw new Error("Recurring availability block insert count mismatch");
  }

  return { count: ids.length, ids };
}
