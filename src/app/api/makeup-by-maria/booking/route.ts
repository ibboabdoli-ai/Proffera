import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import {
  parseLocalDateTime,
  resolveBookingTimeZone,
  validatePublicBookingPolicy,
} from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: privateHeaders });
}

function field(value: unknown, max = 250) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max)
    : "";
}

/**
 * Preview-only bridge to the existing email-verified booking flow.
 * The admin must explicitly enable booking and satisfy normal Proffera
 * entitlements before any visitor data is sent or stored.
 */
export async function POST(request: Request) {
  const readiness = await getMariaPreviewBookingReadiness();
  if (!readiness.enabled) return failure("unavailable", 403);

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return failure("origin", 403);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 8192) return failure("invalid", 413);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("invalid", 415);
  }

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return failure("invalid", 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return failure("invalid", 400);
    input = parsed as Record<string, unknown>;
  } catch {
    return failure("invalid", 400);
  }

  const year = Number(input.year);
  const kind = field(input.kind, 32);
  const name = field(input.name, 160);
  const email = field(input.email, 320).toLowerCase();
  const phone = field(input.phone, 80);
  const city = field(input.city, 120);
  const notes = field(input.notes, 600);
  const date = field(input.date, 10);
  const time = field(input.time, 5);
  const lang = input.lang === "en" || input.lang === "ar" ? "en" : "sv";
  const startedAt = Number(input.startedAt);

  if (
    !Number.isInteger(year) || year < 2026 || year > 2036
    || (kind !== "trial" && kind !== "without")
    || name.length < 2 || phone.length < 5
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !/^\d{2}:\d{2}$/.test(time)
    || !Number.isFinite(startedAt)
    || Date.now() - startedAt < 2500
    || Date.now() - startedAt > 86_400_000
  ) return failure("invalid", 400);

  const localStart = parseLocalDateTime(`${date}T${time}`);
  if (!localStart || localStart.year !== year) return failure("time", 400);
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  if (weekday !== 5 && weekday !== 6) return failure("hours", 400);

  const sql = getSql();
  if (!sql) return failure("unavailable", 503);
  const slug = `maria-bridal-${kind === "trial" ? "trial" : "without-trial"}-${year}`;
  const rows = await sql`
    select id::text as id, name, duration_minutes, buffer_before_minutes,
      buffer_after_minutes, minimum_notice_minutes, maximum_advance_days
    from workspace_services
    where workspace_id = ${readiness.workspaceId}
      and public_slug = ${slug}
      and is_active = true
      and public_status = 'published'
      and duration_minutes between 1 and 1440
    limit 1
  `;
  const service = rows[0];
  if (!service) return failure("service", 409);

  const schedule = await sql`
    select opens_at::text, closes_at::text, is_closed
    from workspace_booking_hours
    where workspace_id = ${readiness.workspaceId} and weekday = ${weekday}
    limit 1
  `;
  const hour = schedule[0];
  const timeZone = resolveBookingTimeZone(readiness.timeZone);
  const validation = validatePublicBookingPolicy({
    startsAt: `${date}T${time}`,
    now: new Date(),
    service: {
      durationMinutes: Number(service.duration_minutes),
      bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0,
      bufferAfterMinutes: Number(service.buffer_after_minutes) || 0,
      minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0,
      maximumAdvanceDays: Number(service.maximum_advance_days) || 365,
    },
    bookingHour: hour
      ? { opensAt: String(hour.opens_at), closesAt: String(hour.closes_at), isClosed: Boolean(hour.is_closed) }
      : null,
    timeZone,
  });
  if (validation.error || !validation.start || !validation.end) {
    return failure(validation.error ?? "time", 409);
  }

  const allowed = await allowPublicSubmission({
    scope: "maria_preview_booking_verification",
    requestHeaders: request.headers,
    identity: `makeup-by-maria:${email}`,
    maxAttempts: 4,
    windowSeconds: 15 * 60,
  });
  if (!allowed) return failure("rate_limit", 429);

  const start = validation.start.toISOString();
  const end = validation.end.toISOString();
  const conflict = await sql`
    select id from bookings
      where workspace_id = ${readiness.workspaceId}
        and status not in ('cancelled', 'no_show')
        and starts_at < ${end}::timestamptz
        and ends_at > ${start}::timestamptz
    union all
    select id from public_booking_verifications
      where workspace_id = ${readiness.workspaceId}::uuid
        and consumed_at is null and expires_at > now()
        and starts_at < ${end}::timestamptz
        and ends_at > ${start}::timestamptz
    limit 1
  `;
  if (conflict[0]) return failure("conflict", 409);

  try {
    const result = await beginBookingEmailVerification({
      workspaceId: readiness.workspaceId,
      slug: readiness.publicSlug,
      companyName: readiness.companyName,
      ownerEmail: readiness.ownerEmail,
      ownerPhone: readiness.ownerPhone || undefined,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      serviceId: String(service.id),
      serviceName: String(service.name),
      city: city || readiness.primaryCity,
      bookingDetails: [
        `Wedding year: ${year}`,
        `Package: ${kind}`,
        notes ? `Customer notes: ${notes}` : "",
      ].filter(Boolean).join("\n"),
      startsAt: start,
      endsAt: end,
      timeZone,
      language: lang,
      verificationSms: false,
    });

    if (!result.ok) return failure(result.error === "email" ? "email" : "conflict", 409);
    return NextResponse.json({
      ok: true,
      verificationUrl: `/boka/verifiera/${result.verificationId}?lang=${lang}`,
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("Maria preview booking preparation failed", error);
    return failure("unavailable", 503);
  }
}
