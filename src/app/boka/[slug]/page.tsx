import { MapPin } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { sendBookingConfirmationEmail, sendBookingOwnerNotificationEmail } from "@/features/email/lead-email";
import { sendBookingOwnerSms } from "@/features/sms/booking-sms";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { BookingAiChatWidget } from "@/components/service-ai-chat-widget";

import { BookingRequestForm } from "./booking-request-form";
import { JuliusBookingDemo } from "@/components/salon/julius-booking-demo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ error?: string | string[]; booked?: string | string[] }>;
};

const weekdayLabels = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

const bookingErrors: Record<string, string> = {
  invalid: "Fyll i namn, kontaktuppgift, tjänst och tid.",
  unavailable: "Bokningssidan är inte tillgänglig.",
  service: "Den valda tjänsten är inte tillgänglig längre.",
  time: "Välj en tid som ligger framåt i tiden.",
  notice: "Den valda tiden ligger för nära i tid. Välj en senare tid.",
  advance: "Den valda tiden ligger för långt fram. Välj ett tidigare datum.",
  hours: "Tiden ligger utanför företagets bokningstider.",
  hours_missing: "Företaget har inte publicerat sina bokningstider ännu.",
  conflict: "Tiden hann precis bli bokad. Välj gärna en annan tid.",
  rate_limit: "För många försök. Vänta en stund och försök igen.",
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
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const formStartedAt = Number(formData.get("form_started_at"));
  const sql = getSql();

  if (website) redirect(`/boka/${slug}?booked=1`);

  const elapsed = Date.now() - formStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) {
    redirect(`/boka/${slug}?error=rate_limit`);
  }

  const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (name.length > 160 || email.length > 180 || phone.length > 80 || serviceName.length > 140 || startsAt.length > 32 || !isValidEmail) {
    redirect(`/boka/${slug}?error=invalid`);
  }

  if (!sql || !slug || !name || (!email && !phone) || !serviceName || !startsAt) redirect(`/boka/${slug}?error=invalid`);

  const workspaces = await sql`
    select
      w.id,
      coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
      nullif(ws.contact_email, '') as contact_email,
      nullif(ws.contact_phone, '') as contact_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${slug}
      and w.status in ('active', 'trial')
      and exists (
        select 1
        from workspace_feature_flags wff
        where wff.workspace_id = w.id
          and wff.feature_key = 'booking_demo'
          and wff.enabled = true
      )
      and (
        select wp.status
        from workspace_plans wp
        where wp.workspace_id = w.id
        order by wp.created_at desc
        limit 1
      ) in ('active', 'trialing')
    limit 1
  `;
  const workspace = workspaces[0];
  if (!workspace) redirect(`/boka/${slug}?error=unavailable`);
  const timeZone = resolveBookingTimeZone(workspace.time_zone);

  const allowed = await allowPublicSubmission({
    scope: "public_booking",
    requestHeaders: await headers(),
    identity: `${slug}:${email}:${phone}`,
    maxAttempts: 5,
    windowSeconds: 15 * 60,
  });
  if (!allowed) redirect(`/boka/${slug}?error=rate_limit`);

  const services = await sql`
    select
      name,
      duration_minutes,
      buffer_before_minutes,
      buffer_after_minutes,
      minimum_notice_minutes,
      maximum_advance_days
    from workspace_services
    where workspace_id = ${String(workspace.id)} and name = ${serviceName} and is_active = true
    limit 1
  `;
  const selectedService = services[0];
  if (!selectedService) redirect(`/boka/${slug}?error=service`);

  const now = new Date();
  const minimumNotice = Math.max(0, Number(selectedService.minimum_notice_minutes) || 0);
  const maximumAdvance = Math.max(1, Number(selectedService.maximum_advance_days) || 365);
  const duration = Math.min(1440, Math.max(1, Number(selectedService.duration_minutes) || 60));
  const bufferBefore = Math.max(0, Number(selectedService.buffer_before_minutes) || 0);
  const bufferAfter = Math.max(0, Number(selectedService.buffer_after_minutes) || 0);
  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(`/boka/${slug}?error=time`);
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const bookingHours = await sql`
    select opens_at::text as opens_at, closes_at::text as closes_at, is_closed
    from workspace_booking_hours
    where workspace_id = ${String(workspace.id)} and weekday = ${weekday}
    limit 1
  `;
  const bookingHour = bookingHours[0];
  const validation = validatePublicBookingPolicy({
    startsAt,
    now,
    service: {
      durationMinutes: duration,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      minimumNoticeMinutes: minimumNotice,
      maximumAdvanceDays: maximumAdvance,
    },
    bookingHour: bookingHour
      ? {
          opensAt: String(bookingHour.opens_at),
          closesAt: String(bookingHour.closes_at),
          isClosed: Boolean(bookingHour.is_closed),
        }
      : null,
    timeZone,
  });
  if (validation.error) {
    redirect(`/boka/${slug}?error=${validation.error}`);
  }
  const { start, end } = validation;

  const conflict = await sql`
    select existing.id
    from bookings existing
    left join workspace_services existing_service
      on existing_service.workspace_id = existing.workspace_id
     and existing_service.name = existing.service
    where existing.workspace_id = ${String(workspace.id)}
      and existing.status not in ('cancelled', 'no_show')
      and existing.starts_at - make_interval(mins => coalesce(existing_service.buffer_before_minutes, 0))
        < ${end.toISOString()}::timestamptz + make_interval(mins => ${bufferAfter})
      and existing.ends_at + make_interval(mins => coalesce(existing_service.buffer_after_minutes, 0))
        > ${start.toISOString()}::timestamptz - make_interval(mins => ${bufferBefore})
    limit 1
  `;
  if (conflict[0]) redirect(`/boka/${slug}?error=conflict`);

  try {
    await sql`
      with existing_customer as (
        select id
        from customers
        where workspace_id = ${String(workspace.id)}
          and (
            (${email} <> '' and lower(email) = lower(${email}))
            or (${phone} <> '' and phone = ${phone})
          )
        order by created_at asc
        limit 1
      ),
      created_customer as (
        insert into customers (workspace_id, name, email, phone, city, status, source)
        select
          ${String(workspace.id)},
          ${name},
          ${email || null},
          ${phone || null},
          ${String(workspace.primary_city ?? "") || null},
          'prospect',
          'public_booking'
        where not exists (select 1 from existing_customer)
        returning id
      ),
      selected_customer as (
        select id from existing_customer
        union all
        select id from created_customer
      )
      insert into bookings (workspace_id, customer_id, title, service, city, status, starts_at, ends_at, source)
      select
        ${String(workspace.id)},
        selected_customer.id,
        ${serviceName},
        ${serviceName},
        ${String(workspace.primary_city ?? "") || null},
        'requested',
        ${start.toISOString()}::timestamptz,
        ${end.toISOString()}::timestamptz,
        'public_booking'
      from selected_customer
      returning id
    `;
  } catch (error) {
    console.error("Failed to create public booking", error);
    redirect(`/boka/${slug}?error=conflict`);
  }

  if (email) {
    await sendBookingConfirmationEmail({
      customerName: name,
      customerEmail: email,
      companyName: String(workspace.company_name),
      bookingTitle: serviceName,
      service: serviceName,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      city: String(workspace.primary_city ?? ""),
      timeZone,
    }).catch(() => null);
  }

  if (workspace.contact_email) {
    await sendBookingOwnerNotificationEmail({
      ownerEmail: String(workspace.contact_email),
      companyName: String(workspace.company_name),
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      service: serviceName,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      city: String(workspace.primary_city ?? ""),
      timeZone,
    }).catch(() => null);
  }

  if (workspace.contact_phone) {
    await sendBookingOwnerSms({
      ownerPhone: String(workspace.contact_phone),
      companyName: String(workspace.company_name),
      customerName: name,
      customerPhone: phone,
      service: serviceName,
      startsAt: start.toISOString(),
      timeZone,
    }).catch(() => null);
  }

  redirect(`/boka/${slug}?booked=1`);
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
      select
        w.id,
        coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
        coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug}
        and w.status in ('active', 'trial')
        and exists (
          select 1
          from workspace_feature_flags wff
          where wff.workspace_id = w.id
            and wff.feature_key = 'booking_demo'
            and wff.enabled = true
        )
        and (
          select wp.status
          from workspace_plans wp
          where wp.workspace_id = w.id
          order by wp.created_at desc
          limit 1
        ) in ('active', 'trialing')
      limit 1
    `;
    workspace = workspaces[0] as Record<string, unknown> | undefined;
    if (workspace) {
      [services, publishedHours, busyBookings] = await Promise.all([
        sql`select name, description, price_label, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days from workspace_services where workspace_id = ${String(workspace.id)} and is_active = true order by sort_order asc, name asc`,
        sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} order by weekday asc`,
        sql`select b.starts_at, b.ends_at, coalesce(ws.buffer_before_minutes, 0) as buffer_before_minutes, coalesce(ws.buffer_after_minutes, 0) as buffer_after_minutes from bookings b left join workspace_services ws on ws.workspace_id = b.workspace_id and ws.name = b.service where b.workspace_id = ${String(workspace.id)} and b.status not in ('cancelled', 'no_show') and b.starts_at >= now() - interval '1 day' and b.ends_at is not null`,
      ]);
    }
  } catch {
    workspace = undefined;
  }

  if (!workspace) return <Unavailable />;

  // Booking pages are public, so only an explicitly active integration may
  // provide a widget client id. This keeps every conversation in the
  // booking company's own tenant and hides the widget after suspension.
  try {
    const integrations = await sql`
      select remote_client_id
      from workspace_ai_chat_integrations
      where workspace_id = ${String(workspace.id)}::uuid
        and lifecycle_state = 'active'
      limit 1
    `;
    const clientId = String(integrations[0]?.remote_client_id ?? "").trim();
    aiChatClientId = clientId || null;
  } catch (error) {
    // A booking page must still work if an older environment has not yet
    // received the optional AI integration migration.
    console.error("Failed to read booking page AI Chat integration", error);
  }

  const bookingAiChatWidget = aiChatClientId ? <BookingAiChatWidget clientId={aiChatClientId} /> : null;

  const error = bookingErrors[firstParam(query?.error) ?? ""];
  const booked = firstParam(query?.booked) === "1";
  const hasServices = services.length > 0;
  const hasHours = publishedHours.length > 0;
  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const bookingForm = hasServices && hasHours ? (
    <BookingRequestForm
      action={requestPublicBooking}
      slug={slug}
      services={services.map((service) => ({
        name: String(service.name),
        durationMinutes: Number(service.duration_minutes) || 60,
        priceLabel: String(service.price_label ?? ""),
        bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0,
        bufferAfterMinutes: Number(service.buffer_after_minutes) || 0,
        minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0,
        maximumAdvanceDays: Number(service.maximum_advance_days) || 365,
      }))}
      bookingHours={publishedHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
      busyBookings={busyBookings.map((booking) => ({
        startsAt: String(booking.starts_at),
        endsAt: String(booking.ends_at),
        bufferBeforeMinutes: Number(booking.buffer_before_minutes) || 0,
        bufferAfterMinutes: Number(booking.buffer_after_minutes) || 0,
      }))}
      timeZone={timeZone}
      variant={slug === "julius-salong" ? "salon" : "default"}
    />
  ) : null;

  if (slug === "julius-salong") {
    return (
      <>
        <JuliusBookingDemo
          live
          bookingContent={(
            <div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Boka online</p>
                  <h2 className="mt-1 text-2xl font-black">Boka hos Elias</h2>
                </div>
                <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-bold text-[#17452f]">Riktiga tider</span>
              </div>
              <p className="mt-4 rounded-2xl bg-[#e7f1eb] px-4 py-3 text-xs font-bold leading-5 text-[#17452f]">
                Välj tjänst och en ledig tid. Julius Salong bekräftar din bokningsförfrågan separat.
              </p>
              {booked ? <p role="status" className="mt-4 rounded-2xl bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">Tack! Din bokningsförfrågan är mottagen. En bekräftelse har skickats via e-post.</p> : null}
              {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}
              {bookingForm ?? <p className="mt-5 rounded-2xl bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Bokningen förbereds. Försök igen senare.</p>}
            </div>
          )}
        />
        {bookingAiChatWidget}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">Boka online</p>
        <h1 className="mt-3 text-3xl font-bold text-[#17201a]">{String(workspace.company_name)}</h1>
        <p className="mt-2 flex gap-2 text-[#5b665f]"><MapPin className="h-5 w-5 shrink-0" />{String(workspace.primary_city ?? "Sverige")}</p>

        {booked ? <p role="status" className="mt-6 rounded-xl bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">Tack! Din bokningsförfrågan är mottagen.</p> : null}
        {error ? <p role="alert" className="mt-6 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}

        {hasHours ? (
          <div className="mt-7 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
            <h2 className="text-sm font-bold text-[#17201a]">Bokningstider</h2>
            <ul className="mt-3 grid gap-1 text-sm text-[#5b665f] sm:grid-cols-2">
              {publishedHours.map((hour) => <li key={String(hour.weekday)}><span className="font-semibold text-[#344139]">{weekdayLabels[Number(hour.weekday)]}:</span> {hour.is_closed ? "Stängt" : `${String(hour.opens_at).slice(0, 5)}–${String(hour.closes_at).slice(0, 5)}`}</li>)}
            </ul>
          </div>
        ) : null}

        {bookingForm ?? (
          <p className="mt-8 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Företaget förbereder onlinebokning. Kom tillbaka snart.</p>
        )}
      </section>
      {bookingAiChatWidget}
    </main>
  );
}

function Unavailable() {
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">Bokning är inte tillgänglig ännu</h1><p className="mt-3 text-[#5b665f]">Företaget har ännu inte publicerat sin bokningssida.</p></section></main>;
}
