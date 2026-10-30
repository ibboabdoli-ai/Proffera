import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { localizeMariaPreviewServiceName } from "@/lib/maria-preview-service-copy";
import { getRescheduleBooking, rescheduleCustomerBooking } from "@/lib/customer-booking-reschedule";
import { getCustomerPortalPresentation, resolveCustomerPortalLanguage, type CustomerPortalLanguage } from "@/lib/customer-portal-language";
import { getAvailableRescheduleSlots, getUpcomingRescheduleDays } from "@/lib/customer-reschedule-slots";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import styles from "../../../customer-portal.module.css";
import { RescheduleSlotPicker } from "./reschedule-slot-picker";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string; bookingId: string }>;
  searchParams?: Promise<{ error?: string | string[]; date?: string | string[]; lang?: string | string[] }>;
};

const errorsSv: Record<string, string> = {
  time: "Välj en giltig ledig tid.", notice: "Tiden ligger för nära. Välj en senare tid.", advance: "Tiden ligger för långt fram.",
  hours: "Tiden ligger utanför bokningstiderna.", hours_missing: "Det finns inga publicerade arbetstider den dagen.",
  conflict: "Tiden hann bokas av någon annan. Välj en ny tid.", time_off: "Medarbetaren är inte tillgänglig den tiden.",
  not_allowed: "Bokningen kan inte längre ändras.",
};

const errorsEn: Record<string, string> = {
  time: "Choose a valid available time.", notice: "That time is too soon. Choose a later time.", advance: "That time is too far in advance.",
  hours: "That time is outside the booking hours.", hours_missing: "There are no published working hours for that day.",
  conflict: "Someone else has just booked that time. Choose another time.", time_off: "The staff member is not available at that time.",
  not_allowed: "This booking can no longer be changed.",
};
const errorsAr: Record<string, string> = {
  time: "اختر موعدًا متاحًا وصحيحًا.", notice: "هذا الموعد قريب جدًا. اختر موعدًا لاحقًا.",
  advance: "هذا الموعد بعيد جدًا.", hours: "الوقت خارج ساعات الحجز.",
  hours_missing: "لا توجد ساعات عمل منشورة لهذا اليوم.",
  conflict: "حجز شخص آخر هذا الموعد. اختر موعدًا جديدًا.",
  time_off: "الموظف غير متاح في هذا الوقت.", not_allowed: "لا يمكن تغيير هذا الحجز الآن.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string, timeZone: string, language: CustomerPortalLanguage) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : language === "en" ? "en-GB" : "sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function formatDay(date: string, timeZone: string, isEnglish: boolean, short: boolean) {
  if (!isEnglish) return null;
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", short
    ? { timeZone, weekday: "short", day: "numeric" }
    : { timeZone, weekday: "long", day: "numeric", month: "long" }
  ).format(value);
}

function rescheduleHref(token: string, bookingId: string, language: CustomerPortalLanguage, date?: string) {
  const query = new URLSearchParams();
  query.set("lang", language);
  if (date) query.set("date", date);
  const suffix = query.toString();
  return `/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om${suffix ? `?${suffix}` : ""}`;
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const { token, bookingId } = await params;
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
    const url = new URL(`https://www.primeviewwindowcare.co.uk/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(bookingId)}/boka-om`);
    url.searchParams.set("lang", language);
    if (first(query?.date)) url.searchParams.set("date", first(query?.date)!);
    if (first(query?.error)) url.searchParams.set("error", first(query?.error)!);
    redirect(url.toString());
  }

  const booking = await getRescheduleBooking(token, bookingId);
  if (!booking) notFound();

  const isMaria = presentation?.publicBookingSlug === "makeup-by-maria"
    && process.env.VERCEL_ENV === "preview";
  const days = isMaria ? [] : getUpcomingRescheduleDays(booking.timeZone, 7);
  const slotEntries = await Promise.all(
    days.map(async (day) => [day.date, await getAvailableRescheduleSlots(token, bookingId, day.date)] as const),
  );
  const slotsByDate = new Map(slotEntries);
  // Bridal appointments may be months away: show an explicit date selector
  // rather than requesting 730 separate day availability queries.
  const mariaHorizon = isMaria ? getUpcomingRescheduleDays(booking.timeZone, 731) : [];
  const earliestMariaDate = mariaHorizon[0]?.date;
  const latestMariaDate = mariaHorizon[mariaHorizon.length - 1]?.date;
  const originalLocalParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(booking.startsAt));
  const localPart = (type: string) => originalLocalParts.find((part) => part.type === type)?.value ?? "";
  const originalDate = `${localPart("year")}-${localPart("month")}-${localPart("day")}`;
  const queryDate = first(query?.date);
  const selectedMariaDate = queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)
    && earliestMariaDate && latestMariaDate && queryDate >= earliestMariaDate && queryDate <= latestMariaDate
    ? queryDate
    : originalDate >= (earliestMariaDate ?? "") && originalDate <= (latestMariaDate ?? "")
      ? originalDate : earliestMariaDate;
  const firstAvailableDate = days.find((day) => (slotsByDate.get(day.date)?.length ?? 0) > 0)?.date;
  const requestedDate = isMaria ? selectedMariaDate : queryDate && (slotsByDate.get(queryDate)?.length ?? 0) > 0
    ? queryDate : firstAvailableDate ?? days[0]?.date;
  const slots = isMaria
    ? requestedDate ? await getAvailableRescheduleSlots(token, bookingId, requestedDate) : []
    : requestedDate ? slotsByDate.get(requestedDate) ?? [] : [];
  const selectedDay = days.find((day) => day.date === requestedDate);
  const selectedDayLabel = isMaria && requestedDate
    ? new Intl.DateTimeFormat(isArabic ? "ar-SA" : isEnglish ? "en-GB" : "sv-SE", {
        timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(new Date(`${requestedDate}T12:00:00Z`))
    : selectedDay ? (formatDay(selectedDay.date, booking.timeZone, isEnglish, false) ?? selectedDay.label) : undefined;

  async function reschedule(formData: FormData) {
    "use server";
    const startsAtLocal = String(formData.get("startsAtLocal") ?? "");
    const currentPresentation = await getCustomerPortalPresentation(token);
    const currentLanguage = resolveCustomerPortalLanguage(language, currentPresentation);
    const result = await rescheduleCustomerBooking(token, bookingId, startsAtLocal, currentLanguage);
    const langSuffix = `&lang=${currentLanguage}`;
    if (!result.ok) {
      const date = startsAtLocal.slice(0, 10);
      redirect(`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?date=${encodeURIComponent(date)}&error=${result.error}${langSuffix}`);
    }
    redirect(`/mina-bokningar/${encodeURIComponent(token)}?changed=1${langSuffix}`);
  }

  const errors = isArabic ? errorsAr : isEnglish ? errorsEn : errorsSv;
  const errorKey = first(query?.error);
  const showLanguageSwitch = isMaria || (presentation ? presentation.swedishEnabled && presentation.englishEnabled : true);
  const portalPrimary = isMaria ? "#845363" : presentation?.primaryColor || (isPrimeView ? "#1769c2" : "#0a2e63");
  const style = {
    "--portal-primary": portalPrimary,
    "--portal-primary-text": readableBookingTextColor(portalPrimary),
  } as CSSProperties;

  return (
    <main className={isMaria ? `${styles.page} ${styles.mariaPage}` : styles.page} lang={language} dir={isArabic ? "rtl" : "ltr"} style={style}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          {isMaria ? <Image src="/demo/makeup-by-maria/assets/maria-mark.svg" alt="Makeup by Maria" width={44} height={44} className={styles.mariaLogo} /> : null}
          <Link href={`/mina-bokningar/${encodeURIComponent(token)}?lang=${language}`} className={styles.backLink}>
            ← {t("Till mina bokningar", "Back to my bookings", "العودة إلى حجوزاتي")}
          </Link>
          {showLanguageSwitch ? (
            <nav className={styles.languageNav} aria-label={t("Språk", "Language", "اللغة")}>
              <Link href={rescheduleHref(token, bookingId, "sv", requestedDate)} className={language === "sv" ? styles.languageActive : styles.languageLink}>SV</Link>
              <Link href={rescheduleHref(token, bookingId, "en", requestedDate)} className={language === "en" ? styles.languageActive : styles.languageLink}>EN</Link>
              {isMaria ? <Link href={rescheduleHref(token, bookingId, "ar", requestedDate)} className={isArabic ? styles.languageActive : styles.languageLink}>AR</Link> : null}
            </nav>
          ) : null}
        </div>

        <section className={styles.rescheduleCard}>
          <p className={styles.eyebrow}>{t("Boka om", "Reschedule", "تغيير الموعد")}</p>
          <h1 className={styles.title}>{localizeMariaPreviewServiceName(booking.service, language, isMaria)}</h1>

          <div className={styles.currentBooking}>
            <p><Clock3 aria-hidden="true" />{t("Nuvarande tid", "Current time", "الموعد الحالي")}: <strong>{formatDate(booking.startsAt, booking.timeZone, language)}</strong></p>
            {booking.staffName ? <p><UserRound aria-hidden="true" />{t("Medarbetare", "Staff member", "الموظف")}: <strong>{booking.staffName}</strong></p> : null}
          </div>

          {errorKey ? <p role="alert" className={styles.noticeError}>{errors[errorKey] ?? t("Tiden kunde inte ändras.", "The appointment could not be changed.", "تعذّر تغيير الموعد.")}</p> : null}

          <h2 className={styles.subheading}>{t("Välj dag", "Choose a day", "اختر يومًا")}</h2>
          {isMaria ? (
            <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="lang" value={language} />
              <label className="flex flex-col gap-2 text-sm">
                {t("Datum för brudsminkning", "Wedding appointment date", "تاريخ موعد العروس")}
                <input type="date" name="date" required min={earliestMariaDate} max={latestMariaDate}
                  defaultValue={requestedDate} className="min-h-11 rounded-lg border px-3" />
              </label>
              <button type="submit" className="min-h-11 rounded-lg border px-4 font-semibold">
                {t("Visa lediga tider", "Show available times", "عرض الأوقات المتاحة")}
              </button>
            </form>
          ) : <div className={styles.dayGrid}>
            {days.map((day) => {
              const active = day.date === requestedDate;
              const availableCount = slotsByDate.get(day.date)?.length ?? 0;
              const shortLabel = formatDay(day.date, booking.timeZone, isEnglish, true) ?? day.shortLabel;
              if (availableCount === 0) {
                return (
                  <span key={day.date} aria-disabled="true" className={styles.dayDisabled}>
                    {shortLabel}
                    <span className={styles.dayCount}>{t("Fullbokad", "Fully booked", "محجوز بالكامل")}</span>
                  </span>
                );
              }
              return (
                <Link
                  key={day.date}
                  href={rescheduleHref(token, bookingId, language, day.date)}
                  className={active ? styles.dayActive : styles.dayLink}
                >
                  {shortLabel}
                  <span className={styles.dayCount}>{availableCount} {isArabic ? "وقت متاح" : isEnglish ? (availableCount === 1 ? "time" : "times") : "tider"}</span>
                </Link>
              );
            })}
          </div>}

          <div className="mt-5">
            <div className={styles.timeHeader}>
              <div>
                <h2 className={styles.subheading}>{t("Lediga tider", "Available times", "الأوقات المتاحة")}</h2>
                {selectedDayLabel ? <p>{selectedDayLabel}</p> : null}
              </div>
              <span className={styles.portalLabel}>{t("Endast bokningsbara tider", "Bookable times only", "الأوقات القابلة للحجز فقط")}</span>
            </div>

            {slots.length > 0 ? (
              <RescheduleSlotPicker action={reschedule} slots={slots} selectedDayLabel={selectedDayLabel} language={language} />
            ) : (
              <p className={styles.empty}>{isMaria
                ? t("Inga lediga starttider detta datum. Välj en annan fredag eller lördag.", "No available starts on this date. Choose another Friday or Saturday.", "لا توجد أوقات متاحة في هذا اليوم. اختر يوم جمعة أو سبت آخر.")
                : t("Inga lediga tider under de kommande sju dagarna. Kontakta företaget om du behöver hjälp med en ny tid.", "No available times during the next seven days. Contact the company if you need help finding another time.", "لا توجد أوقات متاحة خلال الأيام السبعة القادمة. تواصل مع الشركة للمساعدة.")}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
