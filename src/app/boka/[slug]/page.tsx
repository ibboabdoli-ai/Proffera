import type { CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookingAiChatWidget } from "@/components/service-ai-chat-widget";
import { JuliusBookingDemo } from "@/components/salon/julius-booking-demo";
import { resolveBookingThemeContent } from "@/lib/booking-theme-templates";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getPublicWorkspaceExperienceSettings, type WorkspaceLanguage } from "@/lib/workspace-experience";

import { BookingRequestForm } from "./booking-request-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ error?: string | string[]; booked?: string | string[]; lang?: string | string[]; service_id?: string | string[] }>;
};

const copy = {
  sv: {
    weekdays: ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"],
    errors: {
      invalid: "Fyll i namn, e-post, tjänst, personal och tid.", unavailable: "Bokningssidan är inte tillgänglig.",
      service: "Den valda tjänsten är inte tillgänglig längre.", staff: "Den valda personalen är inte tillgänglig för den tiden.",
      time: "Välj en tid som ligger framåt i tiden.", notice: "Den valda tiden ligger för nära i tid. Välj en senare tid.",
      advance: "Den valda tiden ligger för långt fram. Välj ett tidigare datum.", hours: "Tiden ligger utanför bokningstiderna.",
      hours_missing: "Bokningstider saknas för den valda dagen.", conflict: "Tiden hann precis bli bokad eller reserverad. Välj gärna en annan tid.",
      rate_limit: "För många försök. Vänta en stund och försök igen.", email: "Verifieringskoden kunde inte skickas. Kontrollera e-postadressen och försök igen.",
    },
    bookOnline: "Boka online", verification: "Vi skickar en sexsiffrig kod till din e-post. Bokningen skapas först efter verifiering.",
    startHint: "Välj först en tjänst. Därefter visas närmaste lediga datum och tider.",
    booked: "Tack! Din e-post är verifierad och bokningsförfrågan är mottagen.", bookAnother: "Gör en ny bokning", hours: "Bokningstider", closed: "Stängt",
    preparing: "Företaget förbereder onlinebokning.", services: "Tjänster", contact: "Kontakt", faq: "Vanliga frågor",
    unavailableTitle: "Bokning är inte tillgänglig ännu", unavailableBody: "Företaget har ännu inte publicerat sin bokningssida.",
  },
  en: {
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    errors: {
      invalid: "Enter your name, email, service, staff member and time.", unavailable: "The booking page is unavailable.",
      service: "The selected service is no longer available.", staff: "The selected staff member is unavailable at that time.",
      time: "Choose a future time.", notice: "The selected time is too close. Choose a later time.",
      advance: "The selected time is too far in the future. Choose an earlier date.", hours: "The time is outside the booking hours.",
      hours_missing: "Booking hours are missing for the selected day.", conflict: "The time was just booked or reserved. Choose another time.",
      rate_limit: "Too many attempts. Wait a moment and try again.", email: "The verification code could not be sent. Check the email address and try again.",
    },
    bookOnline: "Book online", verification: "We will send a six-digit code to your email. The booking is created after verification.",
    startHint: "Choose a service first. The nearest available date and times will then appear.",
    booked: "Thank you! Your email is verified and the booking request has been received.", bookAnother: "Make another booking", hours: "Booking hours", closed: "Closed",
    preparing: "The company is preparing online booking.", services: "Services", contact: "Contact", faq: "Frequently asked questions",
    unavailableTitle: "Booking is not available yet", unavailableBody: "The company has not published its booking page yet.",
  },
} as const;

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function withLang(slug: string, lang: WorkspaceLanguage, params: string) { return `/boka/${slug}?${params}&lang=${lang}`; }

async function requestPublicBooking(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  const lang: WorkspaceLanguage = formData.get("lang") === "en" ? "en" : "sv";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const formStartedAt = Number(formData.get("form_started_at"));
  const sql = getSql();

  if (website) redirect(withLang(slug, lang, "booked=1"));
  const elapsed = Date.now() - formStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) redirect(withLang(slug, lang, "error=rate_limit"));
  const validStaffId = !staffId || /^[0-9a-f-]{36}$/i.test(staffId);
  const validServiceId = /^[0-9a-f-]{36}$/i.test(serviceId);
  if (!sql || !slug || !name || !email || !validServiceId || !startsAt || !validStaffId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(withLang(slug, lang, "error=invalid"));

  const workspaces = await sql`
    select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city,
      nullif(ws.contact_email, '') as contact_email, nullif(ws.contact_phone, '') as contact_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
    limit 1
  `;
  const workspace = workspaces[0];
  const bookingEnabled = workspace ? await hasWorkspaceFeatureAccessForWorkspace(String(workspace.id), "online_booking") : false;
  if (!workspace || !bookingEnabled) redirect(withLang(slug, lang, "error=unavailable"));

  const allowed = await allowPublicSubmission({ scope: "public_booking_verification", requestHeaders: await headers(), identity: `${slug}:${email}`, maxAttempts: 5, windowSeconds: 15 * 60 });
  if (!allowed) redirect(withLang(slug, lang, "error=rate_limit"));

  const services = await sql`
    select id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days
    from workspace_services
    where workspace_id = ${String(workspace.id)} and id = ${serviceId}::uuid and is_active = true
    limit 1
  `;
  const selectedService = services[0];
  if (!selectedService) redirect(withLang(slug, lang, "error=service"));
  const serviceName = String(selectedService.name);

  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(withLang(slug, lang, "error=time"));
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const localClock = `${String(localStart.hours).padStart(2, "0")}:${String(localStart.minutes).padStart(2, "0")}`;

  let bookingHour: { opens_at: unknown; closes_at: unknown; is_closed: unknown } | undefined;
  if (staffId) {
    const staffRows = await sql`
      select s.id, ss.start_time::text as opens_at, ss.end_time::text as closes_at, false as is_closed
      from workspace_staff s join workspace_staff_schedules ss on ss.staff_id = s.id and ss.workspace_id = s.workspace_id
      where s.id = ${staffId}::uuid and s.workspace_id = ${String(workspace.id)} and s.is_active = true
        and ss.weekday = ${weekday} and ss.is_active = true and ${localClock}::time >= ss.start_time and ${localClock}::time < ss.end_time
      order by ss.start_time limit 1
    `;
    if (!staffRows[0]) redirect(withLang(slug, lang, "error=staff"));
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
    startsAt, now: new Date(),
    service: { durationMinutes: duration, bufferBeforeMinutes: bufferBefore, bufferAfterMinutes: bufferAfter, minimumNoticeMinutes: Math.max(0, Number(selectedService.minimum_notice_minutes) || 0), maximumAdvanceDays: Math.max(1, Number(selectedService.maximum_advance_days) || 365) },
    bookingHour: bookingHour ? { opensAt: String(bookingHour.opens_at), closesAt: String(bookingHour.closes_at), isClosed: Boolean(bookingHour.is_closed) } : null,
    timeZone,
  });
  if (validation.error) redirect(withLang(slug, lang, `error=${validation.error}`));
  const { start, end } = validation;

  if (staffId) {
    const timeOff = await sql`select id from workspace_staff_time_off where workspace_id = ${String(workspace.id)} and staff_id = ${staffId}::uuid and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1`;
    if (timeOff[0]) redirect(withLang(slug, lang, "error=staff"));
  }

  const conflict = await sql`
    select id from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show')
      and (${staffId || null}::uuid is null or staff_id = ${staffId || null}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    union all
    select id from public_booking_verifications where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()
      and (${staffId || null}::uuid is null or staff_id = ${staffId || null}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1
  `;
  if (conflict[0]) redirect(withLang(slug, lang, "error=conflict"));

  const result = await beginBookingEmailVerification({
    workspaceId: String(workspace.id), slug, companyName: String(workspace.company_name), ownerEmail: workspace.contact_email ? String(workspace.contact_email) : undefined,
    ownerPhone: workspace.contact_phone ? String(workspace.contact_phone) : undefined, customerName: name, customerEmail: email, customerPhone: phone || undefined,
    serviceId, serviceName, staffId: staffId || undefined, city: String(workspace.primary_city ?? ""), startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone,
  });
  if (!result.ok) redirect(withLang(slug, lang, `error=${result.error === "email" ? "email" : result.error === "service" ? "service" : "conflict"}`));
  redirect(`/boka/verifiera/${result.verificationId}?lang=${lang}`);
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const sql = getSql();
  if (!sql) return <Unavailable locale="sv" />;

  let workspace: Record<string, unknown> | undefined;
  let services: Array<Record<string, unknown>> = [];
  let publishedHours: Array<Record<string, unknown>> = [];
  let busyBookings: Array<Record<string, unknown>> = [];
  let aiChatClientId: string | null = null;

  try {
    const workspaces = await sql`
      select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), w.primary_city) as primary_city, nullif(ws.contact_email, '') as contact_email,
        nullif(ws.contact_phone, '') as contact_phone, coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
      from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug} and w.status in ('active', 'trial')
      limit 1
    `;
    workspace = workspaces[0] as Record<string, unknown> | undefined;
    if (workspace) {
      const workspaceId = String(workspace.id);
      const bookingEnabled = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking");
      if (!bookingEnabled) workspace = undefined;
      else {
        [services, publishedHours, busyBookings] = await Promise.all([
          sql`select id, name, price_label, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days from workspace_services where workspace_id = ${workspaceId} and is_active = true order by sort_order asc, name asc`,
          sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${workspaceId} order by weekday asc`,
          sql`select starts_at, ends_at, 0 as buffer_before_minutes, 0 as buffer_after_minutes from bookings where workspace_id = ${workspaceId} and status not in ('cancelled', 'no_show') and starts_at >= now() - interval '1 day' union all select starts_at, ends_at, 0, 0 from public_booking_verifications where workspace_id = ${workspaceId}::uuid and consumed_at is null and expires_at > now()`,
        ]);
        try {
          const aiChatEnabled = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "ai_chatbot");
          if (aiChatEnabled) {
            const integrations = await sql`select i.remote_client_id from workspace_ai_chat_integrations i where i.workspace_id = ${workspaceId}::uuid and i.lifecycle_state = 'active' limit 1`;
            aiChatClientId = String(integrations[0]?.remote_client_id ?? "").trim() || null;
          }
        } catch { aiChatClientId = null; }
      }
    }
  } catch { workspace = undefined; }
  if (!workspace) return <Unavailable locale="sv" />;

  const experience = await getPublicWorkspaceExperienceSettings(String(workspace.id));
  const requestedLanguage = firstParam(query?.lang) === "en" ? "en" : firstParam(query?.lang) === "sv" ? "sv" : experience.defaultLanguage;
  const locale: WorkspaceLanguage = requestedLanguage === "en" && experience.englishEnabled ? "en" : requestedLanguage === "sv" && experience.swedishEnabled ? "sv" : experience.englishEnabled ? "en" : "sv";
  const t = copy[locale];
  const themeContent = resolveBookingThemeContent(experience.themeKey, locale, experience.themeContentOverrides);
  const error = t.errors[firstParam(query?.error) as keyof typeof t.errors];
  const booked = firstParam(query?.booked) === "1";
  const requestedServiceId = firstParam(query?.service_id) ?? "";
  const initialServiceId = /^[0-9a-f-]{36}$/i.test(requestedServiceId) && services.some((service) => String(service.id) === requestedServiceId) ? requestedServiceId : "";
  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const bookingForm = !booked && services.length && publishedHours.length ? <BookingRequestForm
    action={requestPublicBooking} slug={slug} locale={locale} initialServiceId={initialServiceId}
    services={services.map((service) => ({ id: String(service.id), name: String(service.name), durationMinutes: Number(service.duration_minutes) || 60, priceLabel: String(service.price_label ?? ""), bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0, bufferAfterMinutes: Number(service.buffer_after_minutes) || 0, minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0, maximumAdvanceDays: Number(service.maximum_advance_days) || 365 }))}
    bookingHours={publishedHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
    busyBookings={busyBookings.map((booking) => ({ startsAt: new Date(booking.starts_at as Date).toISOString(), endsAt: new Date(booking.ends_at as Date).toISOString(), bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }))}
    timeZone={timeZone} variant={experience.themeKey === "salon" || slug === "julius-salong" ? "salon" : "default"}
  /> : null;

  const serviceQuery = initialServiceId ? `&service_id=${encodeURIComponent(initialServiceId)}` : "";
  const languageSwitch = experience.swedishEnabled && experience.englishEnabled ? <nav className="flex justify-end gap-2" aria-label="Language"><a href={`/boka/${slug}?lang=sv${serviceQuery}`} className={`rounded-full px-3 py-2 text-xs font-bold ${locale === "sv" ? "bg-white text-black" : "bg-white/15 text-white"}`}>Svenska</a><a href={`/boka/${slug}?lang=en${serviceQuery}`} className={`rounded-full px-3 py-2 text-xs font-bold ${locale === "en" ? "bg-white text-black" : "bg-white/15 text-white"}`}>English</a></nav> : null;
  const errorNotice = error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null;
  const successNotice = booked ? <div data-booking-success className="rounded-2xl bg-[#eef8f0] p-5 text-[#17452f] ring-1 ring-[#c9e6d0]"><p role="status" className="font-bold leading-6">{t.booked}</p><a href={`/boka/${slug}?lang=${locale}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white">{t.bookAnother}</a></div> : null;
  const showChatbot = Boolean(aiChatClientId && experience.chatbotEnabled);

  if (slug === "julius-salong") return <><div className="fixed right-4 top-4 z-50 rounded-full bg-[#173e2b] p-1 shadow-lg">{languageSwitch}</div><JuliusBookingDemo live bookingContent={<div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">{t.bookOnline}</p><h2 className="mt-1 text-2xl font-black">{String(workspace.company_name)}</h2>{booked ? <div className="mt-4">{successNotice}</div> : <><p className="mt-4 rounded-2xl bg-[#e7f1eb] px-4 py-3 text-xs font-bold leading-5 text-[#17452f]">{t.verification}</p><p data-booking-start-hint className="mt-3 text-xs font-semibold leading-5 text-[#5b665f]">{t.startHint}</p>{errorNotice}{bookingForm}</>}</div>} />{showChatbot ? <BookingAiChatWidget clientId={aiChatClientId!} /> : null}</>;

  const dark = experience.appearance === "dark";
  const themeStyles = { "--booking-primary": experience.primaryColor, "--booking-accent": experience.accentColor } as CSSProperties;
  const pageBackground = dark ? "#111713" : experience.themeKey === "premium" ? "#f3efe7" : experience.themeKey === "modern" ? "#eef4f7" : "#f7f7f4";
  const cardBackground = dark ? "#1b241e" : "#ffffff";
  const textColor = dark ? "#f4f7f4" : "#17201a";
  const mutedColor = dark ? "#bac5bd" : "#5b665f";
  const heroImageUrl = experience.heroImageUrl || themeContent.heroImageUrl;
  const visibleServices = services.length
    ? services.map((service) => ({ key: String(service.id), name: String(service.name), meta: `${Number(service.duration_minutes) || 60} min${service.price_label ? ` · ${String(service.price_label)}` : ""}` }))
    : themeContent.serviceSamples.map((service, index) => ({ key: `sample-${index}`, name: service.name, meta: service.description }));

  return <main style={{ ...themeStyles, background: pageBackground, color: textColor }} className="min-h-screen px-4 py-8 sm:px-6">
    <section style={{ background: experience.primaryColor }} className="mx-auto max-w-5xl rounded-[2rem] p-5 text-white shadow-lg sm:p-7">{languageSwitch}{experience.heroEnabled ? <div className="mt-4 grid items-center gap-6 md:grid-cols-[1fr_280px]"><div>{experience.logoUrl ? <img src={experience.logoUrl} alt="" className="mb-4 max-h-16 max-w-48 object-contain" /> : null}<p className="text-sm font-bold uppercase tracking-[.16em] text-white/75">{String(workspace.company_name)}</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{themeContent.heroTitle}</h1><p className="mt-2 text-base font-bold text-white/90">{themeContent.heroSubtitle}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{themeContent.heroDescription}</p><p className="mt-3 flex gap-2 text-white/80"><MapPin className="h-5 w-5 shrink-0" />{String(workspace.primary_city ?? "")}</p><a href="#booking-form" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-[#17201a]">{themeContent.ctaLabel}</a></div>{experience.heroVideoUrl ? <video src={experience.heroVideoUrl} controls muted playsInline className="h-52 w-full rounded-2xl object-cover" /> : heroImageUrl ? <img src={heroImageUrl} alt="" className="h-52 w-full rounded-2xl object-cover" /> : null}</div> : null}</section>
    <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
      <section id="booking-form" style={{ background: cardBackground, color: textColor }} className="rounded-[2rem] p-6 shadow-sm ring-1 ring-black/10 sm:p-8">{booked ? successNotice : <><p style={{ background: dark ? "#26342b" : "#eef8f0", color: dark ? "#dce8df" : experience.primaryColor }} className="rounded-xl p-4 text-sm">{t.verification}</p><p data-booking-start-hint style={{ color: mutedColor }} className="mt-3 text-xs font-semibold leading-5">{t.startHint}</p>{errorNotice}{bookingForm ?? <p style={{ color: mutedColor }} className="mt-6 rounded-xl border border-black/10 p-4 text-sm">{t.preparing}</p>}</>}</section>
      <aside className="grid content-start gap-5">
        {experience.servicesEnabled && visibleServices.length ? <section style={{ background: cardBackground, color: textColor }} className="rounded-3xl p-5 shadow-sm ring-1 ring-black/10"><h2 className="text-lg font-bold">{t.services}</h2><div className="mt-3 grid gap-2">{visibleServices.map((service) => <div key={service.key} className="rounded-xl border border-black/10 p-3"><strong>{service.name}</strong><p style={{ color: mutedColor }} className="mt-1 text-sm">{service.meta}</p></div>)}</div></section> : null}
        {publishedHours.length ? <section style={{ background: cardBackground, color: textColor }} className="rounded-3xl p-5 shadow-sm ring-1 ring-black/10"><h2 className="text-lg font-bold">{t.hours}</h2><ul style={{ color: mutedColor }} className="mt-3 grid gap-1 text-sm">{publishedHours.map((hour) => <li key={String(hour.weekday)}><span className="font-semibold">{t.weekdays[Number(hour.weekday)]}:</span> {hour.is_closed ? t.closed : `${String(hour.opens_at).slice(0, 5)}–${String(hour.closes_at).slice(0, 5)}`}</li>)}</ul></section> : null}
        {experience.contactEnabled && (workspace.contact_email || workspace.contact_phone) ? <section style={{ background: cardBackground, color: textColor }} className="rounded-3xl p-5 shadow-sm ring-1 ring-black/10"><h2 className="text-lg font-bold">{t.contact}</h2><div style={{ color: mutedColor }} className="mt-3 grid gap-2 text-sm">{workspace.contact_email ? <a href={`mailto:${String(workspace.contact_email)}`}>{String(workspace.contact_email)}</a> : null}{workspace.contact_phone ? <a href={`tel:${String(workspace.contact_phone)}`}>{String(workspace.contact_phone)}</a> : null}</div></section> : null}
        {experience.faqEnabled ? <section style={{ background: cardBackground, color: textColor }} className="rounded-3xl p-5 shadow-sm ring-1 ring-black/10"><h2 className="text-lg font-bold">{t.faq}</h2><h3 className="mt-3 font-semibold">{themeContent.faqTitle}</h3><p style={{ color: mutedColor }} className="mt-1 text-sm leading-6">{themeContent.faqBody}</p></section> : null}
      </aside>
    </div>{showChatbot ? <BookingAiChatWidget clientId={aiChatClientId!} /> : null}
  </main>;
}

function Unavailable({ locale }: { locale: WorkspaceLanguage }) {
  const t = copy[locale];
  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]"><h1 className="text-2xl font-bold text-[#17201a]">{t.unavailableTitle}</h1><p className="mt-3 text-[#5b665f]">{t.unavailableBody}</p></section></main>;
}
