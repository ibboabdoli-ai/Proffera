import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { sendBookingConfirmationEmail, sendBookingOwnerNotificationEmail } from "@/features/email/lead-email";
import { sendBookingOwnerSms } from "@/features/sms/booking-sms";

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
  hours: "Tiden ligger utanför företagets bokningstider.",
  hours_missing: "Företaget har inte publicerat sina bokningstider ännu.",
  conflict: "Tiden hann precis bli bokad. Välj gärna en annan tid.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match;
  const parts = [Number(year), Number(month), Number(day), Number(hours), Number(minutes)];
  if (parts.some((part) => !Number.isInteger(part))) return null;
  const [y, m, d, h, min] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  return { year: y, month: m, day: d, hours: h, minutes: min };
}

function stockholmDateToUtc(parts: NonNullable<ReturnType<typeof parseLocalDateTime>>) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const inStockholm = (date: Date) => {
    const formatted = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return Date.UTC(Number(formatted.year), Number(formatted.month) - 1, Number(formatted.day), Number(formatted.hour), Number(formatted.minute));
  };
  let date = new Date(desired);
  date = new Date(desired - (inStockholm(date) - desired));
  return date;
}

function timeToMinutes(value: unknown) {
  const [hours, minutes] = String(value ?? "").slice(0, 5).split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
}

async function requestPublicBooking(formData: FormData) {
  "use server";

  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const serviceName = String(formData.get("service") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const sql = getSql();

  if (!sql || !slug || !name || (!email && !phone) || !serviceName || !startsAt) redirect(`/boka/${slug}?error=invalid`);

  const workspaces = await sql`
    select
      w.id,
      coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
      nullif(ws.contact_email, '') as contact_email,
      nullif(ws.contact_phone, '') as contact_phone
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
    limit 1
  `;
  const workspace = workspaces[0];
  if (!workspace) redirect(`/boka/${slug}?error=unavailable`);

  const services = await sql`
    select name, duration_minutes
    from workspace_services
    where workspace_id = ${String(workspace.id)} and name = ${serviceName} and is_active = true
    limit 1
  `;
  const selectedService = services[0];
  if (!selectedService) redirect(`/boka/${slug}?error=service`);

  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(`/boka/${slug}?error=time`);
  const start = stockholmDateToUtc(localStart);
  if (Number.isNaN(start.getTime()) || start <= new Date()) redirect(`/boka/${slug}?error=time`);

  const duration = Math.min(1440, Math.max(1, Number(selectedService.duration_minutes) || 60));
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const bookingHours = await sql`
    select opens_at::text as opens_at, closes_at::text as closes_at, is_closed
    from workspace_booking_hours
    where workspace_id = ${String(workspace.id)} and weekday = ${weekday}
    limit 1
  `;
  const bookingHour = bookingHours[0];
  if (!bookingHour) redirect(`/boka/${slug}?error=hours_missing`);
  const opensAt = timeToMinutes(bookingHour.opens_at);
  const closesAt = timeToMinutes(bookingHour.closes_at);
  const requestedStart = localStart.hours * 60 + localStart.minutes;
  if (bookingHour.is_closed || opensAt === null || closesAt === null || requestedStart < opensAt || requestedStart + duration > closesAt) {
    redirect(`/boka/${slug}?error=hours`);
  }

  const conflict = await sql`
    select id from bookings
    where workspace_id = ${String(workspace.id)}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${end.toISOString()}::timestamptz
      and ends_at > ${start.toISOString()}::timestamptz
    limit 1
  `;
  if (conflict[0]) redirect(`/boka/${slug}?error=conflict`);

  try {
    const customer = await sql`
      insert into customers (workspace_id, name, email, phone, city, status, source)
      values (${String(workspace.id)}, ${name}, ${email || null}, ${phone || null}, ${String(workspace.primary_city ?? "") || null}, 'prospect', 'public_booking')
      returning id
    `;
    await sql`
      insert into bookings (workspace_id, customer_id, title, service, city, status, starts_at, ends_at, source)
      values (${String(workspace.id)}, ${String(customer[0]?.id)}, ${serviceName}, ${serviceName}, ${String(workspace.primary_city ?? "") || null}, 'requested', ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, 'public_booking')
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

  try {
    const workspaces = await sql`
      select
        w.id,
        coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
      limit 1
    `;
    workspace = workspaces[0] as Record<string, unknown> | undefined;
    if (workspace) {
      [services, publishedHours, busyBookings] = await Promise.all([
        sql`select name, description, price_label, duration_minutes from workspace_services where workspace_id = ${String(workspace.id)} and is_active = true order by sort_order asc, name asc`,
        sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} order by weekday asc`,
        sql`select starts_at, ends_at from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show') and starts_at >= now() - interval '1 day' and ends_at is not null`,
      ]);
    }
  } catch {
    workspace = undefined;
  }

  if (!workspace) return <Unavailable />;

  const error = bookingErrors[firstParam(query?.error) ?? ""];
  const booked = firstParam(query?.booked) === "1";
  const hasServices = services.length > 0;
  const hasHours = publishedHours.length > 0;
  const bookingForm = hasServices && hasHours ? (
    <BookingRequestForm
      action={requestPublicBooking}
      slug={slug}
      services={services.map((service) => ({ name: String(service.name), durationMinutes: Number(service.duration_minutes) || 60, priceLabel: String(service.price_label ?? "") }))}
      bookingHours={publishedHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
      busyBookings={busyBookings.map((booking) => ({ startsAt: String(booking.starts_at), endsAt: String(booking.ends_at) }))}
      variant={slug === "julius-salong" ? "salon" : "default"}
    />
  ) : null;

  if (slug === "julius-salong") {
    return (
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
    </main>
  );
}

function Unavailable() {
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">Bokning är inte tillgänglig ännu</h1><p className="mt-3 text-[#5b665f]">Företaget har ännu inte publicerat sin bokningssida.</p></section></main>;
}
