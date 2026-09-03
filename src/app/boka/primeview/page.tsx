import { CheckCircle2, Clock3, MapPin, Phone, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

import { PrimeViewBookingForm } from "./primeview-booking-form";

export const dynamic = "force-dynamic";

const SLUG = "primeview";
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

type Locale = "sv" | "en";
type PageProps = {
  searchParams?: Promise<{ error?: string | string[]; booked?: string | string[]; lang?: string | string[]; service_id?: string | string[] }>;
};

const text = {
  en: {
    top: "West & North London's exterior cleaning specialists",
    heroEyebrow: "Professional exterior cleaning",
    heroTitle: "Book PrimeView online — with a clear guide price before you send.",
    heroBody: "Choose a service, tell us about your property and pick a preferred time. For Window Cleaning, your guide price updates instantly as you enter the job details.",
    bookNow: "Start booking", backSite: "Back to PrimeView website", fair: "Fair pricing", fairSub: "Clear quotes, no pressure", flexible: "Flexible visits", flexibleSub: "A time that suits you", careful: "Careful finish", carefulSub: "Attention to every detail",
    sectionEyebrow: "Online booking", sectionTitle: "Tell us what needs cleaning.", sectionBody: "Your details go directly to PrimeView. After email verification, the request appears in the PrimeView booking panel for review and confirmation.",
    successTitle: "Booking request received", successBody: "Your email has been verified and PrimeView has received your booking request. The team will review the property details and confirm the job.", another: "Make another booking",
    verify: "Email verification protects your booking request", secure: "Your details are used only to manage your PrimeView enquiry and booking.", area: "Serving West & North London", response: "Response target: within 24 hours",
    errors: {
      invalid: "Please complete all required booking fields.", postcode: "Enter a valid UK postcode, for example W4 3ES.", unavailable: "Online booking is temporarily unavailable.", service: "That service is no longer available.", time: "Choose a valid future booking time.", notice: "That time is too close. Choose a later slot.", advance: "That date is too far ahead.", hours: "That time is outside PrimeView's booking hours.", hours_missing: "No booking hours are available for that day.", conflict: "That slot has just been booked or reserved. Please choose another time.", rate_limit: "Too many attempts. Please wait a moment and try again.", email: "The verification email could not be sent. Check the email address and try again.",
    },
  },
  sv: {
    top: "PrimeView — utvändig rengöring i West & North London",
    heroEyebrow: "Professionell utvändig rengöring",
    heroTitle: "Boka PrimeView online — med en tydlig prisindikation innan du skickar.",
    heroBody: "Välj tjänst, beskriv fastigheten och välj önskad tid. För fönsterputs uppdateras prisindikationen direkt när du fyller i jobbdetaljerna.",
    bookNow: "Starta bokning", backSite: "Till PrimeViews webbplats", fair: "Tydlig prissättning", fairSub: "Tydliga offerter utan press", flexible: "Flexibla besök", flexibleSub: "En tid som passar dig", careful: "Noggrant resultat", carefulSub: "Omsorg om varje detalj",
    sectionEyebrow: "Onlinebokning", sectionTitle: "Berätta vad som behöver rengöras.", sectionBody: "Uppgifterna går direkt till PrimeView. Efter e-postverifiering visas förfrågan i PrimeViews bokningspanel för granskning och bekräftelse.",
    successTitle: "Bokningsförfrågan mottagen", successBody: "Din e-post är verifierad och PrimeView har fått bokningsförfrågan. Teamet granskar fastighetsinformationen och bekräftar jobbet.", another: "Gör en ny bokning",
    verify: "E-postverifiering skyddar din bokningsförfrågan", secure: "Dina uppgifter används endast för att hantera din PrimeView-förfrågan och bokning.", area: "West & North London", response: "Svarsmål: inom 24 timmar",
    errors: {
      invalid: "Fyll i alla obligatoriska bokningsuppgifter.", postcode: "Ange ett giltigt brittiskt postnummer, till exempel W4 3ES.", unavailable: "Onlinebokningen är tillfälligt otillgänglig.", service: "Tjänsten är inte längre tillgänglig.", time: "Välj en giltig framtida bokningstid.", notice: "Tiden ligger för nära. Välj en senare tid.", advance: "Datumet ligger för långt fram.", hours: "Tiden ligger utanför PrimeViews bokningstider.", hours_missing: "Det finns inga bokningstider den dagen.", conflict: "Tiden har precis bokats eller reserverats. Välj en annan tid.", rate_limit: "För många försök. Vänta en stund och försök igen.", email: "Verifieringsmejlet kunde inte skickas. Kontrollera e-postadressen och försök igen.",
    },
  },
} as const;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: FormDataEntryValue | null, max = 1200) { return String(value ?? "").trim().slice(0, max); }
function bookingUrl(lang: Locale, params: string) { return `/boka/primeview?lang=${lang}&${params}`; }

function estimateWindowCleaning(input: { count: number; scope: string; propertyType: string; floors: string; access: string }) {
  if (!Number.isFinite(input.count) || input.count < 1 || !input.scope) return null;
  const low = input.count * (input.scope === "Inside & outside" ? 7 : 4);
  const high = input.count * (input.scope === "Inside & outside" ? 9 : 5);
  let multiplier = 1;
  if (input.propertyType === "Commercial") multiplier *= 1.1;
  if (input.floors === "Ground + 2 floors") multiplier *= 1.1;
  if (input.floors === "Other") multiplier *= 1.15;
  if (input.access === "Yes") multiplier *= 1.15;
  return { low: Math.ceil(low * multiplier), high: Math.ceil(high * multiplier) };
}

async function requestPrimeViewBooking(formData: FormData) {
  "use server";

  const lang: Locale = formData.get("lang") === "sv" ? "sv" : "en";
  const name = clean(formData.get("name"), 160);
  const email = clean(formData.get("email"), 240).toLowerCase();
  const phone = clean(formData.get("phone"), 80);
  const serviceId = clean(formData.get("service_id"), 80);
  const startsAt = clean(formData.get("starts_at"), 80);
  const website = clean(formData.get("website"), 300);
  const formStartedAt = Number(formData.get("form_started_at"));
  const propertyType = clean(formData.get("property_type"), 80);
  const address = clean(formData.get("address"), 300);
  const postcode = clean(formData.get("postcode"), 20).toUpperCase();
  const floors = clean(formData.get("floors"), 80);
  const windowCountRaw = clean(formData.get("window_count"), 10);
  const cleaningScope = clean(formData.get("cleaning_scope"), 80);
  const framesSills = clean(formData.get("frames_sills"), 20);
  const frequency = clean(formData.get("frequency"), 80);
  const difficultAccess = clean(formData.get("difficult_access"), 40);
  const additionalNotes = clean(formData.get("additional_notes"), 1200);

  if (website) redirect(bookingUrl(lang, "booked=1"));
  const elapsed = Date.now() - formStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) redirect(bookingUrl(lang, "error=rate_limit"));
  if (!name || !email || !phone || !serviceId || !startsAt || !propertyType || !address || !postcode || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9a-f-]{36}$/i.test(serviceId)) redirect(bookingUrl(lang, "error=invalid"));
  if (!UK_POSTCODE.test(postcode)) redirect(bookingUrl(lang, "error=postcode"));

  const sql = getSql();
  if (!sql) redirect(bookingUrl(lang, "error=unavailable"));

  const workspaces = await sql`
    select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city, 'London') as primary_city,
      nullif(ws.contact_email, '') as contact_email, nullif(ws.contact_phone, '') as contact_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/London') as time_zone
    from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${SLUG} and w.status in ('active', 'trial') limit 1
  `;
  const workspace = workspaces[0];
  if (!workspace || !(await hasWorkspaceFeatureAccessForWorkspace(String(workspace.id), "online_booking"))) redirect(bookingUrl(lang, "error=unavailable"));

  const allowed = await allowPublicSubmission({ scope: "public_booking_verification", requestHeaders: await headers(), identity: `${SLUG}:${email}`, maxAttempts: 5, windowSeconds: 15 * 60 });
  if (!allowed) redirect(bookingUrl(lang, "error=rate_limit"));

  const serviceRows = await sql`
    select id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days
    from workspace_services where workspace_id = ${String(workspace.id)} and id = ${serviceId}::uuid and is_active = true limit 1
  `;
  const service = serviceRows[0];
  if (!service) redirect(bookingUrl(lang, "error=service"));
  const serviceName = String(service.name);
  const isWindowCleaning = serviceName.toLowerCase().includes("window cleaning");

  const windowCount = Number(windowCountRaw);
  if (isWindowCleaning && (!floors || !Number.isInteger(windowCount) || windowCount < 1 || windowCount > 500 || !cleaningScope || !framesSills || !frequency || !difficultAccess)) redirect(bookingUrl(lang, "error=invalid"));

  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(bookingUrl(lang, "error=time"));
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const hourRows = await sql`select opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} and weekday = ${weekday} limit 1`;
  const bookingHour = hourRows[0];

  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const validation = validatePublicBookingPolicy({
    startsAt,
    now: new Date(),
    service: {
      durationMinutes: Math.min(1440, Math.max(1, Number(service.duration_minutes) || 60)),
      bufferBeforeMinutes: Math.max(0, Number(service.buffer_before_minutes) || 0),
      bufferAfterMinutes: Math.max(0, Number(service.buffer_after_minutes) || 0),
      minimumNoticeMinutes: Math.max(0, Number(service.minimum_notice_minutes) || 0),
      maximumAdvanceDays: Math.max(1, Number(service.maximum_advance_days) || 365),
    },
    bookingHour: bookingHour ? { opensAt: String(bookingHour.opens_at), closesAt: String(bookingHour.closes_at), isClosed: Boolean(bookingHour.is_closed) } : null,
    timeZone,
  });
  if (validation.error) redirect(bookingUrl(lang, `error=${validation.error}`));
  const { start, end } = validation;

  const conflict = await sql`
    select id from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show')
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    union all
    select id from public_booking_verifications where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1
  `;
  if (conflict[0]) redirect(bookingUrl(lang, "error=conflict"));

  const detailLines = [`Property type: ${propertyType}`, `Address: ${address}`, `Postcode: ${postcode}`];
  if (isWindowCleaning) {
    const estimate = estimateWindowCleaning({ count: windowCount, scope: cleaningScope, propertyType, floors, access: difficultAccess });
    detailLines.push(`Floors: ${floors}`, `Approx. windows: ${windowCount}`, `Cleaning: ${cleaningScope}`, `Frames & sills: ${framesSills}`, `Frequency: ${frequency}`, `Difficult access: ${difficultAccess}`);
    if (estimate) detailLines.push(`Guide estimate shown to customer: £${estimate.low}–£${estimate.high} (non-binding)`);
  }
  if (additionalNotes) detailLines.push(`Additional details: ${additionalNotes}`);

  const result = await beginBookingEmailVerification({
    workspaceId: String(workspace.id), slug: SLUG, companyName: String(workspace.company_name),
    ownerEmail: workspace.contact_email ? String(workspace.contact_email) : undefined,
    ownerPhone: workspace.contact_phone ? String(workspace.contact_phone) : undefined,
    customerName: name, customerEmail: email, customerPhone: phone, serviceId, serviceName,
    city: String(workspace.primary_city ?? "London"), address, postcode, bookingDetails: detailLines.join("\n"),
    startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone,
  });
  if (!result.ok) redirect(bookingUrl(lang, `error=${result.error === "email" ? "email" : result.error === "service" ? "service" : "conflict"}`));
  redirect(`/boka/verifiera/${result.verificationId}?lang=${lang}`);
}

export default async function PrimeViewBookingPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : undefined;
  const locale: Locale = first(query?.lang) === "sv" ? "sv" : "en";
  const t = text[locale];
  const booked = first(query?.booked) === "1";
  const errorKey = first(query?.error) as keyof typeof t.errors | undefined;
  const error = errorKey ? t.errors[errorKey] : undefined;
  const requestedServiceId = first(query?.service_id) ?? "";
  const sql = getSql();

  let workspace: Record<string, unknown> | undefined;
  let services: Array<Record<string, unknown>> = [];
  let bookingHours: Array<Record<string, unknown>> = [];
  let busyBookings: Array<Record<string, unknown>> = [];

  if (sql) {
    try {
      const rows = await sql`
        select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
          coalesce(nullif(ws.primary_city, ''), w.primary_city, 'London') as primary_city,
          nullif(ws.contact_email, '') as contact_email, nullif(ws.contact_phone, '') as contact_phone,
          coalesce(nullif(ws.time_zone, ''), 'Europe/London') as time_zone
        from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
        where w.public_booking_slug = ${SLUG} and w.status in ('active', 'trial') limit 1
      `;
      workspace = rows[0] as Record<string, unknown> | undefined;
      if (workspace && await hasWorkspaceFeatureAccessForWorkspace(String(workspace.id), "online_booking")) {
        [services, bookingHours, busyBookings] = await Promise.all([
          sql`select id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days from workspace_services where workspace_id = ${String(workspace.id)} and is_active = true order by sort_order asc, name asc`,
          sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} order by weekday asc`,
          sql`select starts_at, ends_at, 0 as buffer_before_minutes, 0 as buffer_after_minutes from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show') and starts_at >= now() - interval '1 day' union all select starts_at, ends_at, 0, 0 from public_booking_verifications where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()`,
        ]);
      } else workspace = undefined;
    } catch { workspace = undefined; }
  }

  const timeZone = resolveBookingTimeZone(workspace?.time_zone ?? "Europe/London");
  const initialServiceId = /^[0-9a-f-]{36}$/i.test(requestedServiceId) && services.some((service) => String(service.id) === requestedServiceId) ? requestedServiceId : "";

  return (
    <main lang={locale} className="min-h-screen bg-[#f5f8fc] text-[#0b2a4a]">
      <div className="bg-[#071f37] px-4 py-2.5 text-center text-xs font-bold tracking-wide text-[#d6e9ff] sm:text-sm">{t.top} · <a href="tel:+447500338585" className="text-white underline decoration-white/30 underline-offset-4">07500 338 585</a></div>

      <header className="border-b border-[#dce7f2] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="https://www.primeviewwindowcare.co.uk/" className="flex items-center gap-3">
            <img src="https://www.primeviewwindowcare.co.uk/brand/primeview-window-care-logo.jpeg" alt="PrimeView Window Care" className="h-12 w-12 rounded-xl object-cover ring-1 ring-[#d5e1ed]" />
            <div><p className="text-sm font-black tracking-wide text-[#0b2a4a]">PRIMEVIEW</p><p className="text-xs font-bold text-[#52708d]">WINDOW CARE</p></div>
          </a>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-full bg-[#eef4fb] p-1 text-xs font-bold"><Link href="/boka/primeview?lang=en" className={`rounded-full px-3 py-2 ${locale === "en" ? "bg-white text-[#0b2a4a] shadow-sm" : "text-[#627b93]"}`}>English</Link><Link href="/boka/primeview?lang=sv" className={`rounded-full px-3 py-2 ${locale === "sv" ? "bg-white text-[#0b2a4a] shadow-sm" : "text-[#627b93]"}`}>Svenska</Link></nav>
            <a href="https://www.primeviewwindowcare.co.uk/" className="hidden rounded-xl border border-[#cddbea] px-4 py-2.5 text-sm font-bold text-[#174f83] hover:bg-[#f5f9fd] sm:inline-flex">{t.backSite}</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#0b2a4a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(47,128,237,.32),transparent_34%),radial-gradient(circle_at_15%_80%,rgba(60,166,255,.16),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_360px] lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#8ec5ff]">{t.heroEyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.06] tracking-[-.03em] sm:text-5xl">{t.heroTitle}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#cfe0f1] sm:text-lg">{t.heroBody}</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#booking" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2f80ed] px-5 py-3 font-black text-white shadow-lg shadow-black/15 hover:bg-[#2373db]">{t.bookNow}</a><a href="tel:+447500338585" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-bold text-white"><Phone className="h-4 w-4" />07500 338 585</a></div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-[#8ec5ff]" /><div><p className="font-black">{t.verify}</p><p className="mt-1 text-xs leading-5 text-[#c8dced]">{t.secure}</p></div></div>
            <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 text-sm"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#8ec5ff]" />{t.area}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#8ec5ff]" />{t.response}</p></div></div>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-5 grid max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {[[t.fair, t.fairSub], [t.flexible, t.flexibleSub], [t.careful, t.carefulSub]].map(([title, body]) => <div key={title} className="relative rounded-2xl border border-[#dce7f2] bg-white p-4 shadow-[0_10px_35px_rgba(11,42,74,.08)]"><p className="flex items-center gap-2 font-black text-[#0b2a4a]"><CheckCircle2 className="h-5 w-5 text-[#2f80ed]" />{title}</p><p className="mt-1 pl-7 text-sm text-[#617990]">{body}</p></div>)}
      </section>

      <section id="booking" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-7 max-w-3xl"><p className="text-xs font-black uppercase tracking-[.18em] text-[#2f80ed]">{t.sectionEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-.02em] text-[#0b2a4a] sm:text-4xl">{t.sectionTitle}</h2><p className="mt-3 text-base leading-7 text-[#60778e]">{t.sectionBody}</p></div>

        {error ? <p role="alert" className="mb-6 rounded-2xl border border-[#f0c7c1] bg-[#fff5f3] p-4 text-sm font-bold text-[#9c3a2e]">{error}</p> : null}

        {booked ? <section className="max-w-2xl rounded-3xl border border-[#cfe4d7] bg-white p-7 shadow-[0_14px_45px_rgba(11,42,74,.07)]"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f7ed] text-[#18703d]"><CheckCircle2 className="h-7 w-7" /></div><h2 className="mt-5 text-2xl font-black text-[#0b2a4a]">{t.successTitle}</h2><p className="mt-3 leading-7 text-[#60778e]">{t.successBody}</p><Link href={`/boka/primeview?lang=${locale}`} className="mt-6 inline-flex rounded-xl bg-[#1769c2] px-5 py-3 font-black text-white">{t.another}</Link></section> : workspace && services.length && bookingHours.length ? <PrimeViewBookingForm
          action={requestPrimeViewBooking}
          locale={locale}
          initialServiceId={initialServiceId}
          timeZone={timeZone}
          services={services.map((service) => ({ id: String(service.id), name: String(service.name), durationMinutes: Number(service.duration_minutes) || 60, bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0, bufferAfterMinutes: Number(service.buffer_after_minutes) || 0, minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0, maximumAdvanceDays: Number(service.maximum_advance_days) || 365 }))}
          bookingHours={bookingHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
          busyBookings={busyBookings.map((booking) => ({ startsAt: new Date(booking.starts_at as Date).toISOString(), endsAt: new Date(booking.ends_at as Date).toISOString(), bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }))}
        /> : <div className="rounded-3xl border border-[#dce7f2] bg-white p-7 text-[#60778e]">Online booking is temporarily unavailable. Please call <a href="tel:+447500338585" className="font-bold text-[#1769c2]">07500 338 585</a>.</div>}
      </section>

      <footer className="border-t border-[#dce7f2] bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 text-sm text-[#617990] sm:flex-row sm:items-center sm:justify-between sm:px-6"><p><strong className="text-[#0b2a4a]">PrimeView Window Care</strong> · Professional exterior cleaning across West & North London.</p><div className="flex gap-4"><a href="tel:+447500338585">Call</a><a href="mailto:am@primeviewlondon.co.uk">Email</a><a href="https://www.primeviewwindowcare.co.uk/">Website</a></div></div></footer>
    </main>
  );
}
