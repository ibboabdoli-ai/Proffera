/* eslint-disable react-hooks/purity */
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarDays, Clock3, History, MapPin, XCircle } from "lucide-react";

import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { localizeMariaPreviewServiceName } from "@/lib/maria-preview-service-copy";
import { cancelCustomerCalendarBooking, getCustomerCalendar, type CustomerCalendarBooking } from "@/lib/customer-calendar";
import { getCustomerPortalPresentation, resolveCustomerPortalLanguage, type CustomerPortalLanguage } from "@/lib/customer-portal-language";
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

const statusLabelsAr: Record<string, string> = {
  draft: "مسودة", requested: "قيد المراجعة", confirmed: "مؤكد", completed: "مكتمل",
  cancelled: "ملغى", no_show: "لم يحضر",
};

const formatDate = (value: string, timeZone: WorkspaceTimeZone, language: CustomerPortalLanguage) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : language === "en" ? "en-GB" : "sv-SE", {
    timeZone, weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function portalHref(token: string, locale: CustomerPortalLanguage, query?: { changed?: string; cancelled?: string; error?: string }) {
  const params = new URLSearchParams();
  params.set("lang", locale);
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
  const presentation = await getCustomerPortalPresentation(token);
  const language = resolveCustomerPortalLanguage(String(formData.get("lang") ?? ""), presentation);
  const result = await cancelCustomerCalendarBooking(token, id, language);
  if (result.ok) redirect(portalHref(token, language, { cancelled: "1" }));
  redirect(portalHref(token, language, { error: "cancel" }));
}

export function BookingCard({
  booking, token, timeZone, canReschedule, canCancel, cancelNoticeHours, language, isMariaPreview,
}: {
  booking: CustomerCalendarBooking;
  token: string;
  timeZone: WorkspaceTimeZone;
  canReschedule: boolean;
  canCancel: boolean;
  cancelNoticeHours: number;
  language: CustomerPortalLanguage;
  isMariaPreview: boolean;
}) {
  const isEnglish = language === "en";
  const isArabic = language === "ar";
  const t = (sv: string, en: string, ar: string) => isArabic ? ar : isEnglish ? en : sv;
  const calendarUrl = `/api/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(booking.id)}/calendar`;
  const start = new Date(booking.startsAt).getTime();
  const isPast = start <= Date.now();
  const active = ["requested", "confirmed"].includes(booking.status) && !isPast;
  const rescheduleAllowed = active && canReschedule;
  const cancelAllowed = active && canCancel && start > Date.now() + cancelNoticeHours * 3_600_000;
  const labels = isArabic ? statusLabelsAr : isEnglish ? statusLabelsEn : statusLabelsSv;
  const displayStatus = isPast && ["requested", "confirmed"].includes(booking.status)
    ? t("Tiden har passerat", "Time has passed", "انتهى الموعد")
    : labels[booking.status] ?? booking.status;
  const statusClass = booking.status === "confirmed" && !isPast
    ? styles.statusActive
    : ["cancelled", "no_show"].includes(booking.status) || isPast
      ? styles.statusMuted
      : styles.statusNeutral;
  const rescheduleHref = `/mina-bokningar/${encodeURIComponent(token)}/${booking.id}/boka-om?lang=${language}`;
  const displayTitle = localizeMariaPreviewServiceName(booking.title, language, isMariaPreview);
  const displayService = localizeMariaPreviewServiceName(booking.service, language, isMariaPreview);

  return (
    <article className={styles.bookingCard}>
      <div className={styles.bookingTop}>
        <div>
          <span className={`${styles.status} ${statusClass}`}>{displayStatus}</span>
          <h3 className={styles.bookingTitle}>{displayTitle}</h3>
          {displayService !== displayTitle ? <p className={styles.bookingService}>{displayService}</p> : null}
        </div>
        <span className={`${styles.status} ${styles.statusNeutral}`}>{t("Privat bokning", "Private booking", "حجز خاص")}</span>
      </div>

      <div className={styles.bookingMeta}>
        <span><Clock3 aria-hidden="true" />{formatDate(booking.startsAt, timeZone, language)}</span>
        {booking.city ? <span><MapPin aria-hidden="true" />{booking.city}</span> : null}
      </div>

      <div className={styles.actions}>
        <Link href={calendarUrl} className={styles.secondaryAction}>{t("Lägg till i kalender", "Add to calendar", "إضافة إلى التقويم")}</Link>
        {rescheduleAllowed ? <Link href={rescheduleHref} className={styles.primaryAction}><CalendarClock aria-hidden="true" className="h-4 w-4" />{t("Boka om", "Reschedule", "تغيير الموعد")}</Link> : null}
        {cancelAllowed ? (
          <form action={cancelBooking}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="lang" value={language} />
            <button type="submit" className={styles.dangerAction}><XCircle aria-hidden="true" className="h-4 w-4" />{t("Avboka", "Cancel", "إلغاء الحجز")}</button>
          </form>
        ) : null}
      </div>

      {active && !rescheduleAllowed && !cancelAllowed ? <p className={styles.helper}>{t("Företaget har stängt av självservice för den här bokningen.", "The company has disabled self-service for this booking.", "خدمة تعديل الحجز غير متاحة لهذا الموعد.")}</p> : null}
      {active && canCancel && !cancelAllowed ? <p className={styles.helper}>{t(`Avbokning online stänger ${cancelNoticeHours} timmar före start.`, `Online cancellation closes ${cancelNoticeHours} hours before the appointment.`, `يتوقف الإلغاء الإلكتروني قبل الموعد بـ ${cancelNoticeHours} ساعة.`)}</p> : null}
      {isPast && ["requested", "confirmed"].includes(booking.status) ? <p className={styles.helper}>{t("Bokningstiden har passerat. Företaget kan markera den som genomförd eller utebliven.", "The booking time has passed. The company can mark it as completed or no-show.", "انتهى وقت الحجز. يمكن للشركة تحديده كمكتمل أو عدم حضور.")}</p> : null}
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
  const language = resolveCustomerPortalLanguage(first(query?.lang), presentation);
  const isEnglish = language === "en";
  const isArabic = language === "ar";
  const t = (sv: string, en: string, ar: string) => isArabic ? ar : isEnglish ? en : sv;
  const isPrimeView = presentation?.publicBookingSlug === "primeview";

  if (isPrimeView && !isPrimeViewHost(requestHeaders.get("host"))) {
    const url = new URL(`https://www.primeviewwindowcare.co.uk/mina-bokningar/${encodeURIComponent(token)}`);
    url.searchParams.set("lang", language);
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
      isMariaPreview={presentation?.publicBookingSlug === "makeup-by-maria" && process.env.VERCEL_ENV === "preview"}
    />
  );

  const companyName = presentation?.companyName || (isPrimeView ? "PrimeView Window Care" : "Proffera");
  const portalPrimary = presentation?.primaryColor || (isPrimeView ? "#1769c2" : "#0a2e63");
  const style = {
    "--portal-primary": portalPrimary,
    "--portal-primary-text": readableBookingTextColor(portalPrimary),
  } as CSSProperties;
  const switchQuery = { changed: first(query?.changed), cancelled: first(query?.cancelled), error: first(query?.error) };
  const isMaria = presentation?.publicBookingSlug === "makeup-by-maria"
    && process.env.VERCEL_ENV === "preview";
  const showLanguageSwitch = isMaria || (presentation ? presentation.swedishEnabled && presentation.englishEnabled : true);

  return (
    <main className={styles.page} lang={language} dir={isArabic ? "rtl" : "ltr"} style={style}>
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
              <p className={styles.portalLabel}>{t("Mina bokningar", "My bookings", "حجوزاتي")}</p>
            </div>
          </div>

          {showLanguageSwitch ? (
            <nav className={styles.languageNav} aria-label={t("Språk", "Language", "اللغة")}>
              <Link href={portalHref(token, "sv", switchQuery)} className={language === "sv" ? styles.languageActive : styles.languageLink}>SV</Link>
              <Link href={portalHref(token, "en", switchQuery)} className={language === "en" ? styles.languageActive : styles.languageLink}>EN</Link>
              {isMaria ? <Link href={portalHref(token, "ar", switchQuery)} className={isArabic ? styles.languageActive : styles.languageLink}>AR</Link> : null}
            </nav>
          ) : null}
        </div>

        <header className={styles.hero}>
          <p className={styles.eyebrow}>{t("Kundens självservice", "Customer self-service", "خدمة العملاء الذاتية")}</p>
          <h1 className={styles.title}>{t("Hej", "Hello", "مرحبًا")} {data.customer.name}</h1>
          <p className={styles.lead}>{t("Här visas endast dina egna bokningar. Tillgängliga åtgärder styrs av företagets bokningsregler.", "Only your own bookings are shown here. Available actions follow the company’s booking rules.", "تظهر هنا حجوزاتك فقط. تخضع التغييرات والإلغاء لسياسة الشركة.")}</p>
          {isPrimeView ? <Link href="/" className={styles.websiteLink}>{isEnglish ? "PrimeView website" : "PrimeViews webbplats"}</Link> : null}
        </header>

        {first(query?.changed) === "1" ? <p className={styles.noticeSuccess}>{t("Tiden har ändrats.", "The appointment time has been changed.", "تم تغيير موعد الحجز.")}</p> : null}
        {first(query?.cancelled) === "1" ? <p className={styles.noticeSuccess}>{t("Bokningen har avbokats.", "The booking has been cancelled.", "تم إلغاء الحجز.")}</p> : null}
        {first(query?.error) === "cancel" ? <p role="alert" className={styles.noticeError}>{t("Bokningen kunde inte avbokas. Den kan redan vara avbokad eller ligga för nära starttiden.", "The booking could not be cancelled. It may already be cancelled or too close to the appointment time.", "تعذّر إلغاء الحجز. ربما أُلغي مسبقًا أو اقترب موعده.")}</p> : null}

        <section className={styles.section}>
          <div className={styles.sectionHeader}><CalendarDays aria-hidden="true" /><h2>{t("Kommande", "Upcoming", "الحجوزات القادمة")}</h2></div>
          <div className={styles.bookingList}>{data.upcoming.length ? data.upcoming.map(card) : <p className={styles.empty}>{t("Du har inga kommande bokningar.", "You have no upcoming bookings.", "لا توجد حجوزات قادمة.")}</p>}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}><History aria-hidden="true" /><h2>{t("Historik", "History", "السجل")}</h2></div>
          <div className={styles.bookingList}>{data.history.length ? data.history.map(card) : <p className={styles.empty}>{t("Ingen bokningshistorik ännu.", "No booking history yet.", "لا يوجد سجل للحجوزات بعد.")}</p>}</div>
        </section>

        <footer className={styles.footer}>
          <span>{companyName}</span>
          {isPrimeView ? <Link href="/privacy" className={styles.backLink}>{isEnglish ? "Privacy Policy" : "Integritetspolicy"}</Link> : <span>{t("Bokningssjälvservice via Proffera", "Booking self-service via Proffera", "إدارة الحجوزات عبر Proffera")}</span>}
        </footer>
      </div>
    </main>
  );
}
