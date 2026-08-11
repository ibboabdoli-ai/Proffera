"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronRight, CirclePoundSterling, Clock3, Home, Mail, MapPin, Phone, Sparkles } from "lucide-react";

import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type Locale = "sv" | "en";
type BookingService = BookingAvailabilityService & { id: string; name: string };
type BookingHour = BookingAvailabilityHour & { weekday: number };
type BusyBooking = BookingAvailabilityBusyBooking;

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  timeZone: WorkspaceTimeZone;
  locale: Locale;
  initialServiceId?: string;
};

type PriceRange = { low: number; high: number } | null;

const copy = {
  en: {
    stepService: "1. Choose your service",
    stepProperty: "2. Tell us about the property",
    stepTime: "3. Choose a preferred time",
    stepContact: "4. Your contact details",
    serviceHelp: "Choose the job you need. Window Cleaning includes a live guide estimate.",
    propertyType: "Property type", address: "Full address", postcode: "UK postcode", floors: "Number of floors",
    windows: "Approx. number of windows", scope: "Cleaning required", frames: "Include frames & sills?", frequency: "How often?", access: "Any difficult-access windows?",
    notes: "Additional details", name: "Name", phone: "Phone", email: "Email", choose: "Choose",
    house: "House", flat: "Flat", commercial: "Commercial", ground: "Ground floor only", first: "Ground + 1st floor", two: "Ground + 2 floors", other: "Other",
    outside: "Outside only", both: "Inside & outside", yes: "Yes", no: "No", unsure: "Not sure", oneOff: "One-off", every4: "Every 4 weeks", every6: "Every 6 weeks", every8: "Every 8 weeks",
    date: "Preferred date", time: "Preferred time", chooseTime: "Choose time", noTimes: "No available times on this date",
    estimate: "Guide price", estimateHelp: "Live estimate for Window Cleaning", enterWindows: "Enter the window count and cleaning type to see a guide price.",
    customQuote: "Custom quote", customQuoteHelp: "PrimeView will confirm the price after reviewing your property details.",
    guideOnly: "Guide estimate only — the final quote is confirmed by PrimeView after reviewing access, window size and property details.",
    basedOn: "Exterior window cleaning is based on £4–£5 per window. Inside cleaning and difficult access can increase the guide range.",
    included: "Frames & sills are included in the exterior guide rate when selected.",
    send: "Send verification code", secure: "Your booking request is created only after email verification.",
    postcodeHint: "PrimeView serves West & North London. Please enter a valid UK postcode, e.g. W4 3ES.",
    serviceArea: "West & North London", summary: "Booking summary", selectedService: "Service", preferredVisit: "Preferred visit",
  },
  sv: {
    stepService: "1. Välj tjänst",
    stepProperty: "2. Beskriv fastigheten",
    stepTime: "3. Välj önskad tid",
    stepContact: "4. Dina kontaktuppgifter",
    serviceHelp: "Välj tjänsten du behöver. Fönsterputs visar ett ungefärligt pris direkt.",
    propertyType: "Typ av fastighet", address: "Fullständig adress", postcode: "Brittiskt postnummer", floors: "Antal våningar",
    windows: "Ungefärligt antal fönster", scope: "Rengöring", frames: "Ramar & fönsterbleck?", frequency: "Hur ofta?", access: "Svåråtkomliga fönster?",
    notes: "Övrig information", name: "Namn", phone: "Telefon", email: "E-post", choose: "Välj",
    house: "Hus", flat: "Lägenhet", commercial: "Företag / lokal", ground: "Endast bottenvåning", first: "Botten + 1:a våningen", two: "Botten + 2 våningar", other: "Annat",
    outside: "Endast utsida", both: "In- och utsida", yes: "Ja", no: "Nej", unsure: "Osäker", oneOff: "Engångsjobb", every4: "Var 4:e vecka", every6: "Var 6:e vecka", every8: "Var 8:e vecka",
    date: "Önskat datum", time: "Önskad tid", chooseTime: "Välj tid", noTimes: "Inga lediga tider detta datum",
    estimate: "Ungefärligt pris", estimateHelp: "Direkt prisindikation för fönsterputs", enterWindows: "Ange antal fönster och rengöringstyp för att se ett ungefärligt pris.",
    customQuote: "Offert efter granskning", customQuoteHelp: "PrimeView bekräftar priset efter att fastighetsinformationen har granskats.",
    guideOnly: "Endast prisindikation — slutligt pris bekräftas av PrimeView efter kontroll av åtkomst, fönsterstorlek och fastigheten.",
    basedOn: "Utvändig fönsterputs beräknas från £4–£5 per fönster. Invändig rengöring och svår åtkomst kan höja prisintervallet.",
    included: "Ramar och fönsterbleck ingår i prisindikationen för utvändig rengöring när det väljs.",
    send: "Skicka verifieringskod", secure: "Bokningsförfrågan skapas först efter e-postverifiering.",
    postcodeHint: "PrimeView arbetar i West & North London. Ange ett giltigt brittiskt postnummer, t.ex. W4 3ES.",
    serviceArea: "West & North London", summary: "Bokningsöversikt", selectedService: "Tjänst", preferredVisit: "Önskat besök",
  },
} as const;

const serviceDescriptions: Record<string, string> = {
  "window cleaning": "Streak-free window cleaning for homes, shops and business premises.",
  "fascia & soffit cleaning": "Refresh fascias, soffits, cladding and exterior trims.",
  "conservatory roof cleaning": "Restore light and clarity to conservatory roofs and surrounding frames.",
  "gutter cleaning": "Clear gutters and downpipes to help prevent overflowing rainwater.",
  "driveway & patio cleaning": "Pressure washing for driveways, patios, paths and outdoor areas.",
  "solar panel cleaning": "Safe specialist cleaning to help keep solar panels performing well.",
};

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function calculateWindowEstimate(input: {
  count: number;
  scope: string;
  propertyType: string;
  floors: string;
  access: string;
}): PriceRange {
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

function fieldClass() {
  return "min-h-12 w-full rounded-xl border border-[#cbd8e6] bg-white px-4 py-3 text-[15px] text-[#0b2a4a] outline-none transition placeholder:text-[#7b8da1] focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10";
}

export function PrimeViewBookingForm({ action, services, bookingHours, busyBookings, timeZone, locale, initialServiceId = "" }: Props) {
  const t = copy[locale];
  const [formStartedAt] = useState(() => Date.now());
  const [referenceTime] = useState(() => Date.now());
  const today = dateInputInTimeZone(new Date(referenceTime), timeZone);
  const [serviceId, setServiceId] = useState(() => services.some((service) => service.id === initialServiceId) ? initialServiceId : services[0]?.id ?? "");
  const [propertyType, setPropertyType] = useState("");
  const [floors, setFloors] = useState("");
  const [windowCount, setWindowCount] = useState("");
  const [scope, setScope] = useState("");
  const [frames, setFrames] = useState("");
  const [frequency, setFrequency] = useState("");
  const [access, setAccess] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");

  const selectedService = services.find((service) => service.id === serviceId);
  const isWindowCleaning = selectedService?.name.toLowerCase().includes("window cleaning") ?? false;
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;

  const times = useMemo(() => {
    if (!selectedService || !date) return [];
    const hour = bookingHours.find((item) => item.weekday === weekdayForDate(date));
    if (!hour) return [];
    return getAvailableBookingTimes({ date, service: selectedService, hours: hour, busyBookings, referenceTimeMs: referenceTime, timeZone });
  }, [bookingHours, busyBookings, date, referenceTime, selectedService, timeZone]);

  const estimate = useMemo(() => calculateWindowEstimate({
    count: Number(windowCount), scope, propertyType, floors, access,
  }), [access, floors, propertyType, scope, windowCount]);

  function chooseService(id: string) {
    setServiceId(id);
    setTime("");
    const service = services.find((item) => item.id === id);
    if (!service) return;
    for (let offset = 0; offset <= Math.min(service.maximumAdvanceDays, 28); offset += 1) {
      const candidate = addDaysToDateInput(today, offset);
      const hour = bookingHours.find((item) => item.weekday === weekdayForDate(candidate));
      if (!hour) continue;
      const slots = getAvailableBookingTimes({ date: candidate, service, hours: hour, busyBookings, referenceTimeMs: referenceTime, timeZone });
      if (slots.length) { setDate(candidate); return; }
    }
  }

  const input = fieldClass();

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} />
      <input type="hidden" name="form_started_at" value={formStartedAt} />
      <label className="absolute left-[-10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} /></label>

      <div className="grid gap-5">
        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Sparkles className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-black text-[#0b2a4a]">{t.stepService}</h2><p className="mt-1 text-sm leading-6 text-[#5d7187]">{t.serviceHelp}</p></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const active = service.id === serviceId;
              const description = serviceDescriptions[service.name.toLowerCase()] ?? "Professional exterior cleaning by PrimeView.";
              return <button key={service.id} type="button" onClick={() => chooseService(service.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#2f80ed] bg-[#eef6ff] ring-2 ring-[#2f80ed]/15" : "border-[#d9e4ef] bg-white hover:border-[#9fc1e8] hover:bg-[#f8fbff]"}`}>
                <div className="flex items-start justify-between gap-3"><strong className="text-[15px] text-[#0b2a4a]">{service.name}</strong>{active ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f80ed] text-white"><Check className="h-4 w-4" /></span> : null}</div>
                <p className="mt-2 text-xs leading-5 text-[#667b91]">{description}</p>
              </button>;
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Home className="h-5 w-5" /></div><h2 className="text-xl font-black text-[#0b2a4a]">{t.stepProperty}</h2></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.propertyType}<select name="property_type" required value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={input}><option value="">{t.choose}</option><option value="House">{t.house}</option><option value="Flat">{t.flat}</option><option value="Commercial">{t.commercial}</option></select></label>
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.postcode}<input name="postcode" required autoComplete="postal-code" placeholder="W4 3ES" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" className={input} /><span className="text-[11px] font-medium leading-4 text-[#6c8095]">{t.postcodeHint}</span></label>
            <label className="grid gap-2 text-sm font-bold text-[#183e63] sm:col-span-2">{t.address}<input name="address" required autoComplete="street-address" placeholder="House number and street" className={input} /></label>

            {isWindowCleaning ? <>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.floors}<select name="floors" required value={floors} onChange={(e) => setFloors(e.target.value)} className={input}><option value="">{t.choose}</option><option value="Ground floor only">{t.ground}</option><option value="Ground + 1st floor">{t.first}</option><option value="Ground + 2 floors">{t.two}</option><option value="Other">{t.other}</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.windows}<input name="window_count" required type="number" min="1" max="500" inputMode="numeric" value={windowCount} onChange={(e) => setWindowCount(e.target.value)} placeholder="e.g. 10" className={input} /></label>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.scope}<select name="cleaning_scope" required value={scope} onChange={(e) => setScope(e.target.value)} className={input}><option value="">{t.choose}</option><option value="Outside only">{t.outside}</option><option value="Inside & outside">{t.both}</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.frames}<select name="frames_sills" required value={frames} onChange={(e) => setFrames(e.target.value)} className={input}><option value="">{t.choose}</option><option value="Yes">{t.yes}</option><option value="No">{t.no}</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.frequency}<select name="frequency" required value={frequency} onChange={(e) => setFrequency(e.target.value)} className={input}><option value="">{t.choose}</option><option value="One-off">{t.oneOff}</option><option value="Every 4 weeks">{t.every4}</option><option value="Every 6 weeks">{t.every6}</option><option value="Every 8 weeks">{t.every8}</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.access}<select name="difficult_access" required value={access} onChange={(e) => setAccess(e.target.value)} className={input}><option value="">{t.choose}</option><option value="Yes">{t.yes}</option><option value="No">{t.no}</option><option value="Not sure">{t.unsure}</option></select></label>
            </> : null}
            <label className="grid gap-2 text-sm font-bold text-[#183e63] sm:col-span-2">{t.notes}<textarea name="additional_notes" rows={3} maxLength={1200} placeholder="Access notes, gates, parking, unusual windows or anything else we should know" className={input} /></label>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><CalendarDays className="h-5 w-5" /></div><h2 className="text-xl font-black text-[#0b2a4a]">{t.stepTime}</h2></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.date}<input type="date" required min={today} max={maximumDate} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} className={input} /></label>
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.time}<select required value={time} onChange={(e) => setTime(e.target.value)} className={input}><option value="">{times.length ? t.chooseTime : t.noTimes}</option>{times.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Mail className="h-5 w-5" /></div><h2 className="text-xl font-black text-[#0b2a4a]">{t.stepContact}</h2></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.name}<input name="name" required autoComplete="name" className={input} /></label>
            <label className="grid gap-2 text-sm font-bold text-[#183e63]">{t.phone}<input name="phone" required type="tel" autoComplete="tel" placeholder="07... or +44..." className={input} /></label>
            <label className="grid gap-2 text-sm font-bold text-[#183e63] sm:col-span-2">{t.email}<input name="email" required type="email" autoComplete="email" className={input} /></label>
          </div>
          <button disabled={!selectedService || !time} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1769c2] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#1769c2]/20 transition hover:bg-[#0f5aa9] disabled:cursor-not-allowed disabled:opacity-45">{t.send}<ChevronRight className="h-5 w-5" /></button>
          <p className="mt-3 text-center text-xs leading-5 text-[#6b7f94]">{t.secure}</p>
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className="overflow-hidden rounded-3xl bg-[#0b2a4a] text-white shadow-[0_18px_55px_rgba(11,42,74,.22)]">
          <div className="border-b border-white/10 bg-[#123b64] px-5 py-4"><div className="flex items-center gap-2 text-sm font-bold text-[#cfe5ff]"><CirclePoundSterling className="h-5 w-5" />{isWindowCleaning ? t.estimateHelp : t.customQuote}</div></div>
          <div className="p-5">
            {isWindowCleaning ? estimate ? <><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9caee]">{t.estimate}</p><p className="mt-2 text-4xl font-black tracking-tight">£{estimate.low}–£{estimate.high}</p><p className="mt-3 text-xs leading-5 text-[#d3e2f2]">{t.guideOnly}</p></> : <><p className="text-2xl font-black">{t.estimate}</p><p className="mt-3 text-sm leading-6 text-[#d3e2f2]">{t.enterWindows}</p></> : <><p className="text-2xl font-black">{t.customQuote}</p><p className="mt-3 text-sm leading-6 text-[#d3e2f2]">{t.customQuoteHelp}</p></>}
          </div>
          {isWindowCleaning ? <div className="grid gap-2 border-t border-white/10 bg-[#09243f] p-5 text-xs leading-5 text-[#c8d9eb]"><p>{t.basedOn}</p>{frames === "Yes" ? <p className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6db2ff]" />{t.included}</p> : null}</div> : null}
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_12px_36px_rgba(11,42,74,.06)]">
          <h3 className="font-black text-[#0b2a4a]">{t.summary}</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">{t.selectedService}</p><p className="mt-1 font-bold text-[#183e63]">{selectedService?.name ?? "—"}</p></div></div>
            <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">{t.serviceArea}</p><p className="mt-1 font-bold text-[#183e63]">West & North London</p></div></div>
            <div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">{t.preferredVisit}</p><p className="mt-1 font-bold text-[#183e63]">{date}{time ? ` · ${time}` : ""}</p></div></div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-[#f4f9ff] p-5 text-sm text-[#315574]">
          <p className="font-black text-[#0b2a4a]">Need help before booking?</p>
          <a href="tel:+447500338585" className="mt-3 flex items-center gap-2 font-bold text-[#1769c2]"><Phone className="h-4 w-4" />07500 338 585</a>
          <a href="mailto:am@primeviewlondon.co.uk" className="mt-2 flex items-center gap-2 font-bold text-[#1769c2]"><Mail className="h-4 w-4" />am@primeviewlondon.co.uk</a>
        </section>
      </aside>
    </form>
  );
}
