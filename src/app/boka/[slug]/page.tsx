import type { CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookingAiChatWidget } from "@/components/service-ai-chat-widget";
import { JuliusBookingDemo } from "@/components/salon/julius-booking-demo";
import { resolveBookingThemeContent } from "@/lib/booking-theme-templates";
import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getPublicWorkspaceExperienceSettings, type WorkspaceLanguage } from "@/lib/workspace-experience";

import { BookingRequestForm } from "./booking-request-form";
import styles from "./public-booking-marketplace.module.css";

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
function formText(formData: FormData, key: string, maxLength = 1200) { return String(formData.get(key) ?? "").trim().slice(0, maxLength); }

async function requestPublicBooking(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  let lang: WorkspaceLanguage = formData.get("lang") === "en" ? "en" : "sv";
  const name = formText(formData, "name", 160);
  const email = formText(formData, "email", 320);
  const phone = formText(formData, "phone", 80);
  const serviceId = formText(formData, "service_id", 80);
  const staffId = formText(formData, "staff_id", 80);
  const startsAt = formText(formData, "starts_at", 80);
  const website = formText(formData, "website", 200);
  const address = formText(formData, "address", 300);
  const postcode = formText(formData, "postcode", 24).toUpperCase();
  const propertyType = formText(formData, "property_type", 80);
  const floors = formText(formData, "floors", 80);
  const windowCount = formText(formData, "window_count", 12);
  const cleaningScope = formText(formData, "cleaning_scope", 80);
  const framesSills = formText(formData, "frames_sills", 40);
  const frequency = formText(formData, "frequency", 80);
  const difficultAccess = formText(formData, "difficult_access", 40);
  const additionalNotes = formText(formData, "additional_notes", 1200);
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

  const actionExperience = await getPublicWorkspaceExperienceSettings(String(workspace.id));
  lang = lang === "en" && actionExperience.englishEnabled
    ? "en"
    : lang === "sv" && actionExperience.swedishEnabled
      ? "sv"
      : actionExperience.englishEnabled
        ? "en"
        : "sv";

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

  let bookingDetails = "";
  if (slug === "primeview") {
    if (!address || !postcode || !propertyType) redirect(withLang(slug, lang, "error=invalid"));
    const detailLines = [`Property type: ${propertyType}`];
    if (serviceName.toLowerCase().includes("window cleaning")) {
      const count = Number(windowCount);
      if (!floors || !Number.isInteger(count) || count < 1 || count > 500 || !cleaningScope || !framesSills || !frequency || !difficultAccess) {
        redirect(withLang(slug, lang, "error=invalid"));
      }
      detailLines.push(
        `Floors: ${floors}`,
        `Approx. windows: ${count}`,
        `Cleaning: ${cleaningScope}`,
        `Frames & sills: ${framesSills}`,
        `Frequency: ${frequency}`,
        `Difficult access: ${difficultAccess}`,
      );
    }
    if (additionalNotes) detailLines.push(`Additional details: ${additionalNotes}`);
    bookingDetails = detailLines.join("\n");
  }

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
    serviceId, serviceName, staffId: staffId || undefined, city: String(workspace.primary_city ?? ""), address: address || undefined, postcode: postcode || undefined,
    bookingDetails: bookingDetails || undefined, startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone, language: lang,
  });
  if (!result.ok) redirect(withLang(slug, lang, `error=${result.error === "email" ? "email" : result.error === "service" ? "service" : "conflict"}`));
  redirect(`/boka/verifiera/${result.verificationId}?lang=${lang}`);
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const requestedQueryLocale: WorkspaceLanguage = firstParam(query?.lang) === "en" ? "en" : "sv";
  const sql = getSql();
  if (!sql) return <Unavailable locale={requestedQueryLocale} />;

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
  if (!workspace) return <Unavailable locale={requestedQueryLocale} />;

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
  const languageSwitch = experience.swedishEnabled && experience.englishEnabled ? (
    <nav className={styles.languageNav} aria-label={locale === "sv" ? "Språk" : "Language"}>
      <a
        href={`/boka/${slug}?lang=sv${serviceQuery}`}
        className={locale === "sv" ? styles.languageActive : styles.languageLink}
      >
        Svenska
      </a>
      <a
        href={`/boka/${slug}?lang=en${serviceQuery}`}
        className={locale === "en" ? styles.languageActive : styles.languageLink}
      >
        English
      </a>
    </nav>
  ) : null;
  const errorNotice = error ? <p role="alert" className={styles.errorNotice}>{error}</p> : null;
  const successNotice = booked ? (
    <div data-booking-success className={styles.successNotice}>
      <p role="status">{t.booked}</p>
      <a href={`/boka/${slug}?lang=${locale}`} className={styles.successAction}>{t.bookAnother}</a>
    </div>
  ) : null;
  const showChatbot = Boolean(aiChatClientId && experience.chatbotEnabled);
  const dark = experience.appearance === "dark";
  const pageBackground = dark ? "#101512" : experience.themeKey === "premium" ? "#f4f0e8" : experience.themeKey === "modern" ? "#edf4f6" : "#f6f8fb";
  const cardBackground = dark ? "#19211c" : "#ffffff";
  const textColor = dark ? "#f5f7f5" : "#11213b";
  const mutedColor = dark ? "#b9c3bc" : "#617085";
  const lineColor = dark ? "rgba(255,255,255,.16)" : "#dce4ee";
  const themeStyles = {
    "--booking-primary": experience.primaryColor,
    "--booking-primary-text": readableBookingTextColor(experience.primaryColor),
    "--booking-accent": experience.accentColor,
    "--booking-bg": pageBackground,
    "--booking-card": cardBackground,
    "--booking-text": textColor,
    "--booking-muted": mutedColor,
    "--booking-line": lineColor,
  } as CSSProperties;

  if (slug === "julius-salong") return <main lang={locale} style={themeStyles}><div className="fixed right-4 top-4 z-50 rounded-full bg-[#0a2e63] p-1 shadow-lg">{languageSwitch}</div><JuliusBookingDemo live bookingContent={<div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#11213b] shadow-2xl lg:mt-0 lg:p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#1469d8]">{t.bookOnline}</p><h2 className="mt-1 text-2xl font-black">{String(workspace.company_name)}</h2>{booked ? <div className="mt-4">{successNotice}</div> : <><p className="mt-4 rounded-2xl bg-[#eef5ff] px-4 py-3 text-xs font-bold leading-5 text-[#1469d8]">{t.verification}</p><p data-booking-start-hint className="mt-3 text-xs font-semibold leading-5 text-[#617085]">{t.startHint}</p>{errorNotice}{bookingForm}</>}</div>} />{showChatbot ? <BookingAiChatWidget clientId={aiChatClientId!} /> : null}</main>;
  const heroImageUrl = experience.heroImageUrl || themeContent.heroImageUrl;
  const visibleServices = services.length
    ? services.map((service) => ({ key: String(service.id), name: String(service.name), meta: `${Number(service.duration_minutes) || 60} min${service.price_label ? ` · ${String(service.price_label)}` : ""}` }))
    : themeContent.serviceSamples.map((service, index) => ({ key: `sample-${index}`, name: service.name, meta: service.description }));

  if (experience.themeKey === "restaurant") {
    return (
      <main lang={locale} style={themeStyles} className={styles.page}>
        <div id="restaurant-booking" className={styles.shell}>
          <section id="booking-form" className={styles.bookingPanel}>
            {languageSwitch}
            {booked ? successNotice : (
              <>
                <p className={styles.verification}>{t.verification}</p>
                <p data-booking-start-hint className={styles.startHint}>{t.startHint}</p>
                {errorNotice}
                {bookingForm ?? <p className={styles.preparing}>{t.preparing}</p>}
              </>
            )}
          </section>
        </div>
        {showChatbot ? <BookingAiChatWidget clientId={aiChatClientId!} /> : null}
      </main>
    );
  }

  return (
    <main lang={locale} style={themeStyles} className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.tenantHeader}>
          <div className={styles.tenantIdentity}>
            {experience.logoUrl ? (
              // Public tenant media can live on tenant-specific Blob/CDN hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={experience.logoUrl} alt="" className={styles.tenantLogo} />
            ) : (
              <span className={styles.tenantMark}>{String(workspace.company_name).slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <p className={styles.tenantName}>{String(workspace.company_name)}</p>
              {workspace.primary_city ? <p className={styles.tenantCity}>{String(workspace.primary_city)}</p> : null}
            </div>
          </div>
          {languageSwitch}
        </header>

        {experience.heroEnabled ? (
          <section className={styles.hero}>
            <div className={`${styles.heroGrid} ${experience.heroVideoUrl || heroImageUrl ? "" : styles.heroSolo}`}>
              <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}>{String(workspace.company_name)}</p>
                <h1 className={styles.heroTitle}>{themeContent.heroTitle}</h1>
                <p className={styles.heroSubtitle}>{themeContent.heroSubtitle}</p>
                <p className={styles.heroDescription}>{themeContent.heroDescription}</p>
                {workspace.primary_city ? (
                  <p className={styles.heroLocation}><MapPin aria-hidden="true" />{String(workspace.primary_city)}</p>
                ) : null}
                <a href="#booking-form" className={styles.heroCta}>{themeContent.ctaLabel}</a>
              </div>

              {experience.heroVideoUrl ? (
                <div className={styles.heroMedia}><video src={experience.heroVideoUrl} controls muted playsInline /></div>
              ) : heroImageUrl ? (
                <div className={styles.heroMedia}>
                  {/* Public tenant media can live on tenant-specific Blob/CDN hosts. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImageUrl} alt="" />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className={styles.bookingLayout}>
          <section id="booking-form" className={styles.bookingPanel}>
            {booked ? successNotice : (
              <>
                <p className={styles.verification}>{t.verification}</p>
                <p data-booking-start-hint className={styles.startHint}>{t.startHint}</p>
                {errorNotice}
                {bookingForm ?? <p className={styles.preparing}>{t.preparing}</p>}
              </>
            )}
          </section>

          <aside className={styles.sideColumn}>
            {experience.servicesEnabled && visibleServices.length ? (
              <section className={styles.sidePanel}>
                <h2 className={styles.sideTitle}>{t.services}</h2>
                <div className={styles.serviceList}>
                  {visibleServices.map((service) => (
                    <div key={service.key} className={styles.serviceRow}>
                      <strong>{service.name}</strong>
                      <span>{service.meta}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {publishedHours.length ? (
              <section className={styles.sidePanel}>
                <h2 className={styles.sideTitle}>{t.hours}</h2>
                <div className={styles.hoursList}>
                  {publishedHours.map((hour) => (
                    <div key={String(hour.weekday)} className={styles.hoursRow}>
                      <strong>{t.weekdays[Number(hour.weekday)]}</strong>
                      <span>{hour.is_closed ? t.closed : `${String(hour.opens_at).slice(0, 5)}–${String(hour.closes_at).slice(0, 5)}`}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {experience.contactEnabled && (workspace.contact_email || workspace.contact_phone) ? (
              <section className={styles.sidePanel}>
                <h2 className={styles.sideTitle}>{t.contact}</h2>
                <div className={styles.contactList}>
                  {workspace.contact_email ? <a href={`mailto:${String(workspace.contact_email)}`} className={styles.contactLink}>{String(workspace.contact_email)}</a> : null}
                  {workspace.contact_phone ? <a href={`tel:${String(workspace.contact_phone)}`} className={styles.contactLink}>{String(workspace.contact_phone)}</a> : null}
                </div>
              </section>
            ) : null}

            {experience.faqEnabled ? (
              <section className={styles.sidePanel}>
                <h2 className={styles.sideTitle}>{t.faq}</h2>
                <h3 className={styles.faqTitle}>{themeContent.faqTitle}</h3>
                <p className={styles.faqBody}>{themeContent.faqBody}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      {showChatbot ? <BookingAiChatWidget clientId={aiChatClientId!} /> : null}
    </main>
  );
}

function Unavailable({ locale }: { locale: WorkspaceLanguage }) {
  const t = copy[locale];
  return (
    <main className={styles.unavailablePage} lang={locale}>
      <section className={styles.unavailableCard}>
        <h1>{t.unavailableTitle}</h1>
        <p>{t.unavailableBody}</p>
      </section>
    </main>
  );
}
