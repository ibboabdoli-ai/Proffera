import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { getRescheduleBooking, rescheduleCustomerBooking } from "@/lib/customer-booking-reschedule";
import { getCustomerPortalPresentation, type CustomerPortalLanguage } from "@/lib/customer-portal-language";
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

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveLanguage(requested: string | undefined, presentation: Awaited<ReturnType<typeof getCustomerPortalPresentation>>): CustomerPortalLanguage {
  if (requested === "en" && presentation?.englishEnabled) return "en";
  if (requested === "sv" && presentation?.swedishEnabled) return "sv";
  if (presentation?.defaultLanguage === "en" && presentation.englishEnabled) return "en";
  if (presentation?.swedishEnabled !== false) return "sv";
  return "en";
}

function formatDate(value: string, timeZone: string, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
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
  const language = resolveLanguage(first(query?.lang), presentation);
  const isEnglish = language === "en";
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

  const days = getUpcomingRescheduleDays(booking.timeZone, 7);
  const slotEntries = await Promise.all(
    days.map(async (day) => [day.date, await getAvailableRescheduleSlots(token, bookingId, day.date)] as const),
  );
  const slotsByDate = new Map(slotEntries);
  const firstAvailableDate = days.find((day) => (slotsByDate.get(day.date)?.length ?? 0) > 0)?.date;
  const queryDate = first(query?.date);
  const requestedDate = queryDate && (slotsByDate.get(queryDate)?.length ?? 0) > 0
    ? queryDate
    : firstAvailableDate ?? days[0]?.date;
  const slots = requestedDate ? slotsByDate.get(requestedDate) ?? [] : [];
  const selectedDay = days.find((day) => day.date === requestedDate);
  const selectedDayLabel = selectedDay ? (formatDay(selectedDay.date, booking.timeZone, isEnglish, false) ?? selectedDay.label) : undefined;

  async function reschedule(formData: FormData) {
    "use server";
    const startsAtLocal = String(formData.get("startsAtLocal") ?? "");
    const result = await rescheduleCustomerBooking(token, bookingId, startsAtLocal, language);
    const langSuffix = `&lang=${language}`;
    if (!result.ok) {
      const date = startsAtLocal.slice(0, 10);
      redirect(`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?date=${encodeURIComponent(date)}&error=${result.error}${langSuffix}`);
    }
    redirect(`/mina-bokningar/${encodeURIComponent(token)}?changed=1${langSuffix}`);
  }

  const errors = isEnglish ? errorsEn : errorsSv;
  const errorKey = first(query?.error);
  const showLanguageSwitch = presentation ? presentation.swedishEnabled && presentation.englishEnabled : true;
  const portalPrimary = presentation?.primaryColor || (isPrimeView ? "#1769c2" : "#0a2e63");
  const style = {
    "--portal-primary": portalPrimary,
    "--portal-primary-text": readableBookingTextColor(portalPrimary),
  } as CSSProperties;

  return (
    <main className={styles.page} lang={language} style={style}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href={`/mina-bokningar/${encodeURIComponent(token)}?lang=${language}`} className={styles.backLink}>
            ← {isEnglish ? "Back to my bookings" : "Till mina bokningar"}
          </Link>
          {showLanguageSwitch ? (
            <nav className={styles.languageNav} aria-label={isEnglish ? "Language" : "Språk"}>
              <Link href={rescheduleHref(token, bookingId, "sv", requestedDate)} className={language === "sv" ? styles.languageActive : styles.languageLink}>SV</Link>
              <Link href={rescheduleHref(token, bookingId, "en", requestedDate)} className={language === "en" ? styles.languageActive : styles.languageLink}>EN</Link>
            </nav>
          ) : null}
        </div>

        <section className={styles.rescheduleCard}>
          <p className={styles.eyebrow}>{isEnglish ? "Reschedule" : "Boka om"}</p>
          <h1 className={styles.title}>{booking.service}</h1>

          <div className={styles.currentBooking}>
            <p><Clock3 aria-hidden="true" />{isEnglish ? "Current time" : "Nuvarande tid"}: <strong>{formatDate(booking.startsAt, booking.timeZone, isEnglish)}</strong></p>
            {booking.staffName ? <p><UserRound aria-hidden="true" />{isEnglish ? "Staff member" : "Medarbetare"}: <strong>{booking.staffName}</strong></p> : null}
          </div>

          {errorKey ? <p role="alert" className={styles.noticeError}>{errors[errorKey] ?? (isEnglish ? "The appointment could not be changed." : "Tiden kunde inte ändras.")}</p> : null}

          <h2 className={styles.subheading}>{isEnglish ? "Choose a day" : "Välj dag"}</h2>
          <div className={styles.dayGrid}>
            {days.map((day) => {
              const active = day.date === requestedDate;
              const availableCount = slotsByDate.get(day.date)?.length ?? 0;
              const shortLabel = formatDay(day.date, booking.timeZone, isEnglish, true) ?? day.shortLabel;
              if (availableCount === 0) {
                return (
                  <span key={day.date} aria-disabled="true" className={styles.dayDisabled}>
                    {shortLabel}
                    <span className={styles.dayCount}>{isEnglish ? "Fully booked" : "Fullbokad"}</span>
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
                  <span className={styles.dayCount}>{availableCount} {isEnglish ? (availableCount === 1 ? "time" : "times") : "tider"}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-5">
            <div className={styles.timeHeader}>
              <div>
                <h2 className={styles.subheading}>{isEnglish ? "Available times" : "Lediga tider"}</h2>
                {selectedDayLabel ? <p>{selectedDayLabel}</p> : null}
              </div>
              <span className={styles.portalLabel}>{isEnglish ? "Bookable times only" : "Endast bokningsbara tider"}</span>
            </div>

            {slots.length > 0 ? (
              <RescheduleSlotPicker action={reschedule} slots={slots} selectedDayLabel={selectedDayLabel} language={language} />
            ) : (
              <p className={styles.empty}>{isEnglish ? "No available times during the next seven days. Contact the company if you need help finding another time." : "Inga lediga tider under de kommande sju dagarna. Kontakta företaget om du behöver hjälp med en ny tid."}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
