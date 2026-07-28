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
  constructor(public readonly code: "time" | "past" | "range" | "conflict") {
    super(code);
    this.name = "AvailabilityBlockValidationError";
  }
}

export async function createDashboardAvailabilityBlock(input: {
  localStartsAt: string;
  localEndsAt: string;
  reason: string;
}) {
  if (!connectionString) throw new Error("Missing database connection for availability blocks");

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for availability blocks");
  }

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

  const reason = input.reason.trim().slice(0, 180) || "Blockerad tid";
  const sql = neon(connectionString);
  const conflicts = await sql`
    select id
    from bookings
    where workspace_id = ${access.workspaceId}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${endsAt.toISOString()}::timestamptz
      and ends_at > ${startsAt.toISOString()}::timestamptz
    limit 1
  `;
  if (conflicts[0]) throw new AvailabilityBlockValidationError("conflict");

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
      ${access.workspaceId},
      null,
      ${reason},
      'Blockerad tid',
      null,
      'confirmed',
      ${startsAt.toISOString()}::timestamptz,
      ${endsAt.toISOString()}::timestamptz,
      'dashboard_availability_block',
      ${reason}
    )
    returning id
  `;

  return { id: String(rows[0]?.id ?? ""), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
