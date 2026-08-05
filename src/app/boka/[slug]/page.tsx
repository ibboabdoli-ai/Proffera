import { MapPin } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookingAiChatWidget } from "@/components/service-ai-chat-widget";
import { JuliusBookingDemo } from "@/components/salon/julius-booking-demo";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";

import { BookingRequestForm } from "./booking-request-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ error?: string | string[]; booked?: string | string[] }>;
};

const weekdayLabels = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
const bookingErrors: Record<string, string> = {
  invalid: "Fyll i namn, e-post, tjänst, personal och tid.",
  unavailable: "Bokningssidan är inte tillgänglig.",
  service: "Den valda tjänsten är inte tillgänglig längre.",
  staff: "Den valda personalen är inte tillgänglig för den tiden.",
  time: "Välj en tid som ligger framåt i tiden.",
  notice: "Den valda tiden ligger för nära i tid. Välj en senare tid.",
  advance: "Den valda tiden ligger för långt fram. Välj ett tidigare datum.",
  hours: "Tiden ligger utanför bokningstiderna.",
  hours_missing: "Bokningstider saknas för den valda dagen.",
  conflict: "Tiden hann precis bli bokad eller reserverad. Välj gärna en annan tid.",
  rate_limit: "För många försök. Vänta en stund och försök igen.",
  email: "Verifieringskoden kunde inte skickas. Kontrollera e-postadressen och försök igen.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function requestPublicBooking(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const serviceName = String(formData.get("service") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const formStartedAt = Number(formData.get("form_started_at"));
  const sql = getSql();

  if (website) redirect(`/boka/${slug}?booked=1`);
  const elapsed = Date.now() - formStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) redirect(`/boka/${slug}?error=rate_limit`);
  const validStaffId = !staffId || /^[0-9a-f-]{36}$/i.test(staffId);
  if (!sql || !slug || !name || !email || !serviceName || !startsAt || !validStaffId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/boka/${slug}?error=invalid`);

  const workspaces = await sql`
    select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
      nullif(ws.contact_email, '') as contact_email, nullif(ws.contact_phone, '') as contact_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
      and exists (select 1 from workspace_feature_flags wff where wff.workspace_id = w.id and wff.feature_key = 'booking_demo' and wff.enabled = true)
      and (select wp.status from workspace_plans wp where wp.workspace_id = w.id order by wp.created_at desc limit 1) in ('active', 'trialing')
    limit 1
  `;
  const workspace = workspaces[0];
  if (!workspace) redirect(`/boka/${slug}?error=unavailable`);

  const allowed = await allowPublicSubmission({ scope: "public_booking_verification", requestHeaders: await headers(), identity: `${slug}:${email}`, maxAttempts: 5, windowSeconds: 15 * 60 });
  if (!allowed) redirect(`/boka/${slug}?error=rate_limit`);

  const services = await sql`
    select name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days
    from workspace_services where workspace_id = ${String(workspace.id)} and name = ${serviceName} and is_active = true limit 1
  `;
  const selectedService = services[0];
  if (!selectedService) redirect(`/boka/${slug}?error=service`);

  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(`/boka/${slug}?error=time`);
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const localClock = `${String(localStart.hours).padStart(2, "0")}:${String(localStart.minutes).padStart(2, "0")}`;

  let bookingHour: { opens_at: unknown; closes_at: unknown; is_closed: unknown } | undefined;
  if (staffId) {
    const staffRows = await sql`
      select s.id, ss.start_time::text as opens_at, ss.end_time::text as closes_at, false as is_closed
      from workspace_staff s
      join workspace_staff_schedules ss on ss.staff_id = s.id and ss.workspace_id = s.workspace_id
      where s.id = ${staffId}::uuid and s.workspace_id = ${String(workspace.id)} and s.is_active = true
        and ss.weekday = ${weekday} and ss.is_active = true
        and ${localClock}::time >= ss.start_time and ${localClock}::time < ss.end_time
      order by ss.start_time limit 1
    `;
    if (!staffRows[0]) redirect(`/boka/${slug}?error=staff`);
    bookingHour = staffRows[0] as typeof bookingHour;
  } else {
    const rows = await sql`select opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} and weekday = ${weekday} limit 1`;
    bookingHour = rows[0] as typeof bookingHour;
  }

  const duration = Math.min(1440, Math.max(1, Number(selectedService.duration_minutes) || 60));
  const bufferBefore = Math.max(0, Number(selectedService.buffer_before_minutes) || 0);
  const bufferAfter = Math.max(0, Number(selectedService.buffer_after_minutes) || 0);
  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const validation = validatePublicBookingPolicy({
    startsAt,
    now: new Date(),
    service: {
      durationMinutes: duration,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      minimumNoticeMinutes: Math.max(0, Number(selectedService.minimum_notice_minutes) || 0),
      maximumAdvanceDays: Math.max(1, Number(selectedService.maximum_advance_days) || 365),
    },
    bookingHour: bookingHour ? { opensAt: String(bookingHour.opens_at), closesAt: String(bookingHour.closes_at), isClosed: Boolean(bookingHour.is_closed) } : null,
    timeZone,
  });
  if (validation.error) redirect(`/boka/${slug}?error=${validation.error}`);
  const { start, end } = validation;

  if (staffId) {
    const timeOff = await sql`
      select id from workspace_staff_time_off
      where workspace_id = ${String(workspace.id)} and staff_id = ${staffId}::uuid
        and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
      limit 1
    `;
    if (timeOff[0]) redirect(`/boka/${slug}?error=staff`);
  }

  const conflict = await sql`
    select id from bookings
    where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show')
      and (${staffId || null}::uuid is null or staff_id = ${staffId || null}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    union all
    select id from public_booking_verifications
    where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()
      and (${staffId || null}::uuid is null or staff_id = ${staffId || null}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    limit 1
  `;
  if (conflict[0]) redirect(`/boka/${slug}?error=conflict`);

  const result = await beginBookingEmailVerification({
    workspaceId: String(workspace.id), slug, companyName: String(workspace.company_name),
    ownerEmail: workspace.contact_email ? String(workspace.contact_email) : undefined,
    ownerPhone: workspace.contact_phone ? String(workspace.contact_phone) : undefined,
    customerName: name, customerEmail: email, customerPhone: phone || undefined,
    serviceName, staffId: staffId || undefined, city: String(workspace.primary_city ?? ""),
    startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone,
  });
  if (!result.ok) redirect(`/boka/${slug}?error=${result.error === "email" ? "email" : "conflict"}`);
  redirect(`/boka/verifiera/${result.verificationId}`);
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const sql = getSql();
  if (!sql) return <Unavailable />;

  let workspace: Record<string, unknown> | undefined;
  let services: Array<Record<string, unknown>> = [];
  let publishedHours: Array<Record<string, unknown>> = [];
  let busyBookings: Array<Record<string, unknown>> = [];
  let aiChatClientId: string | null = null;

  try {
    const workspaces = await sql`
      select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
        coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
      from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
        and exists (select 1 from workspace_feature_flags wff where wff.workspace_id = w.id and wff.feature_key = 'booking_demo' and wff.enabled = true)
        and (select wp.status from workspace_plans wp where wp.workspace_id = w.id order by wp.created_at desc limit 1) in ('active', 'trialing') limit 1
    `;
    workspace = workspaces[0] as Record<string, unknown> | undefined;
    if (workspace) {
      [services, publishedHours, busyBookings] = await Promise.all([
        sql`select name, price_label, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days from workspace_services where workspace_id = ${String(workspace.id)} and is_active = true order by sort_order asc, name asc`,
        sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} order by weekday asc`,
        sql`select starts_at, ends_at, 0 as buffer_before_minutes, 0 as buffer_after_minutes from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show') and starts_at >= now() - interval '1 day' union all select starts_at, ends_at, 0, 0 from public_booking_verifications where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()`,
      ]);
      try {
        const integrations = await sql`select remote_client_id from workspace_ai_chat_integrations where workspace_id = ${String(workspace.id)}::uuid and lifecycle_state = 'active' limit 1`;
        aiChatClientId = String(integrations[0]?.remote_client_id ?? "").trim() || null;
      } catch { aiChatClientId = null; }
    }
  } catch { workspace = undefined; }
  if (!workspace) return <Unavailable />;

  const error = bookingErrors[firstParam(query?.error) ?? ""];
  const booked = firstParam(query?.booked) === "1";
  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const bookingForm = services.length && publishedHours.length ? <BookingRequestForm
    action={requestPublicBooking}
    slug={slug}
    services={services.map((service) => ({
      name: String(service.name), durationMinutes: Number(service.duration_minutes) || 60, priceLabel: String(service.price_label ?? ""),
      bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0, bufferAfterMinutes: Number(service.buffer_after_minutes) || 0,
      minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0, maximumAdvanceDays: Number(service.maximum_advance_days) || 365,
    }))}
    bookingHours={publishedHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
    busyBookings={busyBookings.map((booking) => ({ startsAt: new Date(booking.starts_at as Date).toISOString(), endsAt: new Date(booking.ends_at as Date).toISOString(), bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }))}
    timeZone={timeZone}
    variant={slug === "julius-salong" ? "salon" : "default"}
  /> : null;

  const notices = <>{booked ? <p role="status" className="mt-5 rounded-xl bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">Tack! Din e-post är verifierad och bokningsförfrågan är mottagen.</p> : null}{error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}</>;

  if (slug === "julius-salong") return <><JuliusBookingDemo live bookingContent={<div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Boka online</p><h2 className="mt-1 text-2xl font-black">Julius Salong</h2><p className="mt-4 rounded-2xl bg-[#e7f1eb] px-4 py-3 text-xs font-bold leading-5 text-[#17452f]">Välj tjänst, personal och en ledig tid. Bokningen blir klar efter e-postverifiering.</p>{notices}{bookingForm}</div>} />{aiChatClientId ? <BookingAiChatWidget clientId={aiChatClientId} /> : null}</>;

  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6"><section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">Boka online</p><h1 className="mt-3 text-3xl font-bold text-[#17201a]">{String(workspace.company_name)}</h1><p className="mt-2 flex gap-2 text-[#5b665f]"><MapPin className="h-5 w-5 shrink-0" />{String(workspace.primary_city ?? "Sverige")}</p><p className="mt-6 rounded-xl bg-[#eef8f0] p-4 text-sm text-[#17452f]">Vi skickar en sexsiffrig kod till din e-post. Bokningen skapas först efter verifiering.</p>{notices}{publishedHours.length ? <div className="mt-7 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4"><h2 className="text-sm font-bold text-[#17201a]">Bokningstider</h2><ul className="mt-3 grid gap-1 text-sm text-[#5b665f] sm:grid-cols-2">{publishedHours.map((hour) => <li key={String(hour.weekday)}><span className="font-semibold text-[#344139]">{weekdayLabels[Number(hour.weekday)]}:</span> {hour.is_closed ? "Stängt" : `${String(hour.opens_at).slice(0, 5)}–${String(hour.closes_at).slice(0, 5)}`}</li>)}</ul></div> : null}{bookingForm ?? <p className="mt-8 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Företaget förbereder onlinebokning.</p>}</section>{aiChatClientId ? <BookingAiChatWidget clientId={aiChatClientId} /> : null}</main>;
}

function Unavailable() {
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">Bokning är inte tillgänglig ännu</h1><p className="mt-3 text-[#5b665f]">Företaget har ännu inte publicerat sin bokningssida.</p></section></main>;
}
