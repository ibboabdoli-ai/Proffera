/* eslint-disable react-hooks/purity */
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarDays, Clock3, History, MapPin, XCircle } from "lucide-react";

import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { cancelCustomerCalendarBooking, getCustomerCalendar, type CustomerCalendarBooking } from "@/lib/customer-calendar";
import { getCustomerPortalPresentation, type CustomerPortalLanguage } from "@/lib/customer-portal-language";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import styles from "../customer-portal.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ changed?: string | string[]; cancelled?: string | string[]; error?: string | string[]; lang?: string | string[] }>;
};

const statusLabelsSv: Record<string, string> = {
  draft: "Utkast", requested: "Förfrågad", confirmed: "Bekräftad", completed: "Genomförd", cancelled: "Avbokad", no_show: "Uteblev",
};

const statusLabelsEn: Record<string, string> = {
  draft: "Draft", requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show",
};

const formatDate = (value: string, timeZone: WorkspaceTimeZone, isEnglish: boolean) =>
  new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    timeZone, weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolvePortalLanguage(
  requested: string | undefined,
  presentation: Awaited<ReturnType<typeof getCustomerPortalPresentation>>,
): CustomerPortalLanguage {
  if (requested === "en" && presentation?.englishEnabled) return "en";
  if (requested === "sv" && presentation?.swedishEnabled) return "sv";
  if (presentation?.defaultLanguage === "en" && presentation.englishEnabled) return "en";
  if (presentation?.swedishEnabled !== false) return "sv";
  return "en";
}

function portalHref(token: string, locale: CustomerPortalLanguage, query?: { changed?: string; cancelled?: string; error?: string }) {
  const params = new URLSearchParams();
  if (locale === "en") params.set("lang", "en");
  if (query?.changed) params.set("changed", query.changed);
  if (query?.cancelled) params.set("cancelled", query.cancelled);
  if (query?.error) params.set("error", query.error);
  const suffix = params.toString();
  return `/mina-bokningar/${encodeURIComponent(token)}${suffix ? `?${suffix}` : ""}`;
}

async function cancelBooking(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("booking_id") ?? "");
  const result = await cancelCustomerCalendarBooking(token, id);
  if (result.ok) revalidatePath(`/mina-bokningar/${token}`);
}

function BookingCard({
  booking, token, timeZone, canReschedule, canCancel, cancelNoticeHours, language,
}: {
  booking: CustomerCalendarBooking;
  token: string;
  timeZone: WorkspaceTimeZone;
  canReschedule: boolean;
  canCancel: boolean;
  cancelNoticeHours: number;
  language: CustomerPortalLanguage;
}) {
  const isEnglish = language === "en";
  const calendarUrl = `/api/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(booking.id)}/calendar`;
  const start = new Date(booking.startsAt).getTime();
  const isPast = start <= Date.now();
  const active = ["requested", "confirmed"].includes(booking.status) && !isPast;
  const rescheduleAllowed = active && canReschedule;
  const cancelAllowed = active && canCancel && start > Date.now() + cancelNoticeHours * 3_600_000;
  const labels = isEnglish ? statusLabelsEn : statusLabelsSv;
  const displayStatus = isPast && ["requested", "confirmed"].includes(booking.status)
    ? isEnglish ? "Time has passed" : "Tiden har passerat"
    : labels[booking.status] ?? booking.status;
  const statusClass = booking.status === "confirmed" && !isPast
    ? styles.statusActive
    : ["cancelled", "no_show"].includes(booking.status) || isPast
      ? styles.statusMuted
      : styles.statusNeutral;
  const rescheduleHref = `/mina-bokningar/${encodeURIComponent(token)}/${booking.id}/boka-om${isEnglish ? "?lang=en" : ""}`;

  return (
    <article className={styles.bookingCard}>
      <div className={styles.bookingTop}>
        <div>
          <span className={`${styles.status} ${statusClass}`}>{displayStatus}</span>
          <h3 className={styles.bookingTitle}>{booking.title}</h3>
          <p className={styles.bookingService}>{booking.service}</p>
        </div>
        <span className={`${styles.status} ${styles.statusNeutral}`}>{isEnglish ? "Private booking" : "Privat bokning"}</span>
      </div>

      <div className={styles.bookingMeta}>
        <span><Clock3 aria-hidden="true" />{formatDate(booking.startsAt, timeZone, isEnglish)}</span>
        {booking.city ? <span><MapPin aria-hidden="true" />{booking.city}</span> : null}
      </div>

      <div className={styles.actions}>
        <Link href={calendarUrl} className={styles.secondaryAction}>{isEnglish ? "Add to calendar" : "Lägg till i kalender"}</Link>
        {rescheduleAllowed ? <Link href={rescheduleHref} className={styles.primaryAction}><CalendarClock aria-hidden="true" className="h-4 w-4" />{isEnglish ? "Reschedule" : "Boka om"}</Link> : null}
        {cancelAllowed ? (
          <form action={cancelBooking}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="lang" value={language} />
            <button type="submit" className={styles.dangerAction}><XCircle aria-hidden="true" className="h-4 w-4" />{isEnglish ? "Cancel" : "Avboka"}</button>
          </form>
        ) : null}
      </div>

      {active && !rescheduleAllowed && !cancelAllowed ? <p className={styles.helper}>{isEnglish ? "The company has disabled self-service for this booking." : "Företaget har stängt av självservice för den här bokningen."}</p> : null}
      {active && canCancel && !cancelAllowed ? <p className={styles.helper}>{isEnglish ? `Online cancellation closes ${cancelNoticeHours} hours before the appointment.` : `Avbokning online stänger ${cancelNoticeHours} timmar före start.`}</p> : null}
      {isPast && ["requested", "confirmed"].includes(booking.status) ? <p className={styles.helper}>{isEnglish ? "The booking time has passed. The company can mark it as completed or no-show." : "Bokningstiden har passerat. Företaget kan markera den som genomförd eller utebliven."}</p> : null}
    </article>
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [presentation, requestHeaders] = await Promise.all([
    getCustomerPortalPresentation(token),
    headers(),
  ]);
  const language = resolvePortalLanguage(first(query?.lang), presentation);
  const isEnglish = language === "en";
  const isPrimeView = presentation?.publicBookingSlug === "primeview";

  if (isPrimeView && !isPrimeViewHost(requestHeaders.get("host"))) {
    const url = new URL(`https://www.primeviewwindowcare.co.uk/mina-bokningar/${encodeURIComponent(token)}`);
    if (isEnglish) url.searchParams.set("lang", "en");
    if (first(query?.changed)) url.searchParams.set("changed", first(query?.changed)!);
    if (first(query?.cancelled)) url.searchParams.set("cancelled", first(query?.cancelled)!);
    if (first(query?.error)) url.searchParams.set("error", first(query?.error)!);
    redirect(url.toString());
  }

  const data = await getCustomerCalendar(token);
  if (!data) notFound();

  const card = (booking: CustomerCalendarBooking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      token={token}
      timeZone={data.timeZone}
      canReschedule={data.policy.customerRescheduleEnabled}
      canCancel={data.policy.customerCancelEnabled}
      cancelNoticeHours={data.policy.cancelNoticeHours}
      language={language}
    />
  );

  const companyName = presentation?.companyName || (isPrimeView ? "PrimeView Window Care" : "Proffera");
  const portalPrimary = presentation?.primaryColor || (isPrimeView ? "#1769c2" : "#0a2e63");
  const style = {
    "--portal-primary": portalPrimary,
    "--portal-primary-text": readableBookingTextColor(portalPrimary),
  } as CSSProperties;
  const switchQuery = { changed: first(query?.changed), cancelled: first(query?.cancelled), error: first(query?.error) };
  const showLanguageSwitch = presentation ? presentation.swedishEnabled && presentation.englishEnabled : true;

  return (
    <main className={styles.page} lang={language} style={style}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.identity}>
            {isPrimeView ? (
              <Image src="/brand/primeview-window-care-logo.jpeg" alt="PrimeView Window Care" width={48} height={48} className={styles.logo} />
            ) : presentation?.logoUrl ? (
              // Workspace logos are runtime tenant media and may use Blob/CDN hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={presentation.logoUrl} alt="" className={styles.logo} />
            ) : (
              <span className={styles.mark}><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
            )}
            <div>
              <p className={styles.companyName}>{companyName}</p>
              <p className={styles.portalLabel}>{isEnglish ? "My bookings" : "Mina bokningar"}</p>
            </div>
          </div>

          {showLanguageSwitch ? (
            <nav className={styles.languageNav} aria-label={isEnglish ? "Language" : "Språk"}>
              <Link href={portalHref(token, "sv", switchQuery)} className={language === "sv" ? styles.languageActive : styles.languageLink}>SV</Link>
              <Link href={portalHref(token, "en", switchQuery)} className={language === "en" ? styles.languageActive : styles.languageLink}>EN</Link>
            </nav>
          ) : null}
        </div>

        <header className={styles.hero}>
          <p className={styles.eyebrow}>{isEnglish ? "Customer self-service" : "Kundens självservice"}</p>
          <h1 className={styles.title}>{isEnglish ? "Hello" : "Hej"} {data.customer.name}</h1>
          <p className={styles.lead}>{isEnglish ? "Only your own bookings are shown here. Available actions follow the company’s booking rules." : "Här visas endast dina egna bokningar. Tillgängliga åtgärder styrs av företagets bokningsregler."}</p>
          {isPrimeView ? <Link href="/" className={styles.websiteLink}>PrimeView website</Link> : null}
        </header>

        {first(query?.changed) === "1" ? <p className={styles.noticeSuccess}>{isEnglish ? "The appointment time has been changed." : "Tiden har ändrats."}</p> : null}
        {first(query?.cancelled) === "1" ? <p className={styles.noticeSuccess}>{isEnglish ? "The booking has been cancelled." : "Bokningen har avbokats."}</p> : null}

        <section className={styles.section}>
          <div className={styles.sectionHeader}><CalendarDays aria-hidden="true" /><h2>{isEnglish ? "Upcoming" : "Kommande"}</h2></div>
          <div className={styles.bookingList}>{data.upcoming.length ? data.upcoming.map(card) : <p className={styles.empty}>{isEnglish ? "You have no upcoming bookings." : "Du har inga kommande bokningar."}</p>}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}><History aria-hidden="true" /><h2>{isEnglish ? "History" : "Historik"}</h2></div>
          <div className={styles.bookingList}>{data.history.length ? data.history.map(card) : <p className={styles.empty}>{isEnglish ? "No booking history yet." : "Ingen bokningshistorik ännu."}</p>}</div>
        </section>

        <footer className={styles.footer}>
          <span>{companyName}</span>
          {isPrimeView ? <Link href="/privacy" className={styles.backLink}>Privacy Policy</Link> : <span>{isEnglish ? "Booking self-service via Proffera" : "Bokningssjälvservice via Proffera"}</span>}
        </footer>
      </div>
    </main>
  );
}
