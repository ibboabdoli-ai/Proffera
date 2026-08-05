import "server-only";

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const portalSecret =
  process.env.CUSTOMER_PORTAL_SECRET ??
  process.env.BETTER_AUTH_SECRET ??
  process.env.AUTH_SECRET;

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type TokenPayload = {
  workspaceId: string;
  customerId: string;
  exp: number;
};

export type CustomerCalendarBooking = {
  id: string;
  title: string;
  service: string;
  city: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export type CustomerCalendarData = {
  timeZone: WorkspaceTimeZone;
  customer: {
    id: string;
    name: string;
  };
  upcoming: CustomerCalendarBooking[];
  history: CustomerCalendarBooking[];
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string) {
  if (!portalSecret) throw new Error("Missing customer portal secret");
  return crypto.createHmac("sha256", portalSecret).update(value).digest("base64url");
}

export function createCustomerCalendarToken(input: {
  workspaceId: string;
  customerId: string;
  expiresInSeconds?: number;
}) {
  const payload: TokenPayload = {
    workspaceId: input.workspaceId,
    customerId: input.customerId,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? TOKEN_TTL_SECONDS),
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCustomerCalendarToken(token: string): TokenPayload | null {
  try {
    const [encoded, suppliedSignature] = token.split(".");
    if (!encoded || !suppliedSignature || !portalSecret) return null;

    const expectedSignature = sign(encoded);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.workspaceId || !payload.customerId || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function toBooking(row: Record<string, unknown>): CustomerCalendarBooking {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.service ?? "Bokning"),
    service: String(row.service ?? "Ej angiven"),
    city: String(row.city ?? ""),
    status: String(row.status ?? "requested"),
    startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(),
  };
}

export async function getCustomerCalendar(token: string): Promise<CustomerCalendarData | null> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString) return null;

  const sql = neon(connectionString);
  const [customers, settings] = await Promise.all([
    sql`
    select id, name
    from customers
    where id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
    limit 1
    `,
    sql`
      select time_zone
      from workspace_settings
      where workspace_id = ${payload.workspaceId}
      limit 1
    `,
  ]);
  const customer = customers[0];
  if (!customer) return null;

  const bookings = await sql`
    select id, title, service, city, status, starts_at, ends_at
    from bookings
    where customer_id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    order by starts_at asc
    limit 200
  `;

  const now = Date.now();
  const all = bookings.map(toBooking);
  return {
    timeZone: resolveBookingTimeZone(settings[0]?.time_zone),
    customer: { id: String(customer.id), name: String(customer.name ?? "Kund") },
    upcoming: all.filter((booking) => new Date(booking.endsAt).getTime() >= now && booking.status !== "cancelled"),
    history: all
      .filter((booking) => new Date(booking.endsAt).getTime() < now || booking.status === "cancelled")
      .reverse(),
  };
}

export async function getCustomerCalendarBooking(token: string, bookingId: string): Promise<CustomerCalendarBooking | null> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !bookingId) return null;

  const sql = neon(connectionString);
  const rows = await sql`
    select id, title, service, city, status, starts_at, ends_at
    from bookings
    where id = ${bookingId}
      and customer_id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;

  return rows[0] ? toBooking(rows[0]) : null;
}

export async function cancelCustomerCalendarBooking(token: string, bookingId: string) {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return { ok: false as const, error: "invalid" };
  }

  const sql = neon(connectionString);
  const rows = await sql`
    update bookings
    set status = 'cancelled', updated_at = now()
    where id = ${bookingId}
      and customer_id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
      and status in ('requested', 'confirmed')
      and starts_at > now()
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    returning id
  `;

  return rows[0]
    ? { ok: true as const }
    : { ok: false as const, error: "not_allowed" };
}
