import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime, resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

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
  mariaPreview = false,
) {
  const conflicts = await sql`
    select b.id
    from bookings b
    left join workspace_services occupied_service
      on occupied_service.id=b.service_id and occupied_service.workspace_id=b.workspace_id
    where b.workspace_id = ${workspaceId}
      and b.status not in ('cancelled', 'no_show')
      and b.starts_at-(case when ${mariaPreview}::boolean
        then coalesce(occupied_service.buffer_before_minutes,0) else 0 end * interval '1 minute')
        < ${endsAt.toISOString()}::timestamptz
      and b.ends_at+(case when ${mariaPreview}::boolean
        then coalesce(occupied_service.buffer_after_minutes,0) else 0 end * interval '1 minute')
        > ${startsAt.toISOString()}::timestamptz
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
  mariaPreview = false,
) {
  const query = sql`
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
    -- The earlier preflight is for UX only. Under Maria's workspace lock,
    -- recheck BOTH real bookings and unexpired holds before inserting a block.
    where ${!mariaPreview}::boolean or (
      not exists (
        select 1 from bookings existing
        left join workspace_services existing_service
          on existing_service.id=existing.service_id and existing_service.workspace_id=existing.workspace_id
        where existing.workspace_id=${workspaceId}
          and existing.status not in ('cancelled','no_show')
          and existing.starts_at-(coalesce(existing_service.buffer_before_minutes,0)*interval '1 minute')
            < ${endsAt.toISOString()}::timestamptz
          and existing.ends_at+(coalesce(existing_service.buffer_after_minutes,0)*interval '1 minute')
            > ${startsAt.toISOString()}::timestamptz
      )
      and not exists (
      select 1 from public_booking_verifications hold
      left join workspace_services hold_service
        on hold_service.id=hold.service_id and hold_service.workspace_id=hold.workspace_id::text
      where hold.workspace_id=${workspaceId}::uuid
        and hold.consumed_at is null and hold.expires_at>clock_timestamp()
        and hold.starts_at-(coalesce(hold_service.buffer_before_minutes,0)*interval '1 minute')
          < ${endsAt.toISOString()}::timestamptz
        and hold.ends_at+(coalesce(hold_service.buffer_after_minutes,0)*interval '1 minute')
          > ${startsAt.toISOString()}::timestamptz
      )
    )
    returning id
  `;
  const rows = mariaPreview
    ? (await sql.transaction([
        sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}::text, 713))`,
        query,
      ]))[1]
    : await query;
  const id = String(rows[0]?.id ?? "");
  if (!id) throw new AvailabilityBlockValidationError("conflict");
  return id;
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
  const mariaPreview = process.env.VERCEL_ENV === "preview" && access.workspaceSlug === "makeup-by-maria";
  if (await hasConflict(sql, access.workspaceId, startsAt, endsAt, mariaPreview)) {
    throw new AvailabilityBlockValidationError("conflict");
  }

  const id = await insertBlock(sql, access.workspaceId, startsAt, endsAt, reason, "dashboard_availability_block", mariaPreview);
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
  const mariaPreview = process.env.VERCEL_ENV === "preview" && access.workspaceSlug === "makeup-by-maria";
  const batchInsert = sql`
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
      left join workspace_services occupied_service
        on occupied_service.id=b.service_id and occupied_service.workspace_id=b.workspace_id
      where b.starts_at-(case when ${mariaPreview}::boolean
        then coalesce(occupied_service.buffer_before_minutes,0) else 0 end * interval '1 minute')
        < n.ends_at
        and b.ends_at+(case when ${mariaPreview}::boolean
        then coalesce(occupied_service.buffer_after_minutes,0) else 0 end * interval '1 minute')
        > n.starts_at
      limit 1
    ),
    hold_conflicts as (
      select 1 from normalized n
      join public_booking_verifications hold on hold.workspace_id=${access.workspaceId}::uuid
        and hold.consumed_at is null and hold.expires_at>clock_timestamp()
      left join workspace_services hold_service
        on hold_service.id=hold.service_id and hold_service.workspace_id=hold.workspace_id::text
      where ${mariaPreview}::boolean
        and hold.starts_at-(coalesce(hold_service.buffer_before_minutes,0)*interval '1 minute')<n.ends_at
        and hold.ends_at+(coalesce(hold_service.buffer_after_minutes,0)*interval '1 minute')>n.starts_at
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
        and not exists (select 1 from hold_conflicts)
      returning id
    )
    select
      (exists(select 1 from conflicts) or exists(select 1 from hold_conflicts)) as has_conflict,
      coalesce((select json_agg(id) from inserted), '[]'::json) as ids
  `;
  const rows = mariaPreview
    ? (await sql.transaction([
        sql`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
        batchInsert,
      ]))[1]
    : await batchInsert;

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
