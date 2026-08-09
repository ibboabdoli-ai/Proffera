/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MailCheck, Scissors, UserRound, UsersRound } from "lucide-react";

import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type BookingService = BookingAvailabilityService & { id: string; name: string; priceLabel: string };
type BookingHour = BookingAvailabilityHour & { weekday: number };
type BusyBooking = BookingAvailabilityBusyBooking;
type BookingStaff = { id: string; name: string; roleLabel: string; schedules: BookingHour[]; busy: BusyBooking[] };
type Locale = "sv" | "en";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  timeZone: WorkspaceTimeZone;
  variant?: "default" | "salon";
  locale?: Locale;
  initialServiceId?: string;
};

type SalonStep = "service" | "staff" | "time" | "details";

const copy = {
  sv: {
    weekdays: ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"],
    months: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
    name: "Namn", email: "E-post", phone: "Telefon", service: "Tjänst", staff: "Personal", time: "Tid", details: "Uppgifter",
    chooseService: "Välj tjänst", chooseTime: "Välj tid", sendCode: "Skicka verifieringskod", book: "Boka",
    serviceIntro: "Se pris, behandlingstid och närmaste lediga tid.", available: "Ledig", noTimes: "Inga lediga tider",
    changeService: "Byt tjänst", chooseStaff: "Välj personal", staffIntro: "Välj en specifik person eller första lediga.",
    firstStaff: "Första lediga personal", fastest: "Snabbaste tillgängliga tiden", back: "Tillbaka", chooseDayTime: "Välj dag och tid",
    noTimesDay: "Inga lediga tider denna dag.", nearestAvailable: "Visa närmaste lediga tid", continue: "Fortsätt", changeTime: "Byt tid", yourDetails: "Dina uppgifter",
    verificationInfo: "Vi skickar en sexsiffrig kod. Bokningen blir klar efter verifiering.", website: "Webbplats", at: "kl.", genericStaff: "Personal",
  },
  en: {
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    name: "Name", email: "Email", phone: "Phone", service: "Service", staff: "Staff", time: "Time", details: "Details",
    chooseService: "Choose service", chooseTime: "Choose time", sendCode: "Send verification code", book: "Book",
    serviceIntro: "See the price, duration and nearest available time.", available: "Available", noTimes: "No available times",
    changeService: "Change service", chooseStaff: "Choose staff", staffIntro: "Choose a specific person or the first available.",
    firstStaff: "First available staff", fastest: "Fastest available appointment", back: "Back", chooseDayTime: "Choose day and time",
    noTimesDay: "No available times on this day.", nearestAvailable: "Show nearest available time", continue: "Continue", changeTime: "Change time", yourDetails: "Your details",
    verificationInfo: "We will send a six-digit code. The booking is completed after verification.", website: "Website", at: "at", genericStaff: "Staff",
  },
} as const;

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

export function BookingRequestForm({ action, slug, services, bookingHours, busyBookings, timeZone, variant = "default", locale = "sv", initialServiceId = "" }: Props) {
  const t = copy[locale];
  const formatDateLabel = (value: string) => {
    const { day, month, weekday } = dateParts(value);
    return `${t.weekdays[weekday]} ${day} ${t.months[month - 1]}`;
  };
  const [formStartedAt] = useState(() => Date.now());
  const [referenceTime, setReferenceTime] = useState(formStartedAt);
  const today = dateInputInTimeZone(new Date(referenceTime), timeZone);
  const [serviceId, setServiceId] = useState(() => services.some((service) => service.id === initialServiceId) ? initialServiceId : "");
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffChoice, setStaffChoice] = useState("any");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [step, setStep] = useState<SalonStep>("service");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (variant !== "salon") return;
    let active = true;
    fetch(`/api/public-booking/${encodeURIComponent(slug)}/staff`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { staff: [] })
      .then((payload) => { if (active) setStaff(Array.isArray(payload.staff) ? payload.staff : []); })
      .finally(() => { if (active) setStaffLoaded(true); });
    return () => { active = false; };
  }, [slug, variant]);

  useEffect(() => {
    const timer = window.setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedService = services.find((service) => service.id === serviceId);
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToDateInput(today, weekOffset * 7 + index)), [today, weekOffset]);

  useEffect(() => {
    if (!weekDates.includes(date)) { setDate(weekDates[0]); setTime(""); setAssignedStaffId(""); }
  }, [date, weekDates]);

  const slotsForStaff = useCallback((member: BookingStaff, targetDate: string, service: BookingService) => {
    const hours = member.schedules.find((item) => item.weekday === weekdayForDate(targetDate));
    if (!hours) return [];
    return getAvailableBookingTimes({ date: targetDate, service, hours, busyBookings: member.busy, referenceTimeMs: referenceTime, timeZone });
  }, [referenceTime, timeZone]);

  const slotsForDate = useCallback((targetDate: string, service: BookingService) => {
    if (staff.length) {
      const candidates = staffChoice === "any" ? staff : staff.filter((member) => member.id === staffChoice);
      const map = new Map<string, string>();
      for (const member of candidates) for (const slot of slotsForStaff(member, targetDate, service)) if (!map.has(slot)) map.set(slot, member.id);
      return { slots: [...map.keys()].sort(), staffBySlot: map };
    }
    const hours = bookingHours.find((item) => item.weekday === weekdayForDate(targetDate));
    const slots = hours ? getAvailableBookingTimes({ date: targetDate, service, hours, busyBookings, referenceTimeMs: referenceTime, timeZone }) : [];
    return { slots, staffBySlot: new Map<string, string>() };
  }, [bookingHours, busyBookings, referenceTime, slotsForStaff, staff, staffChoice, timeZone]);

  const availability = useMemo(() => selectedService ? slotsForDate(date, selectedService) : { slots: [], staffBySlot: new Map<string, string>() }, [date, selectedService, slotsForDate]);
  const selectedTime = availability.slots.includes(time) ? time : "";

  const firstAvailability = useMemo(() => {
    const result = new Map<string, { date: string; time: string } | null>();
    for (const service of services) {
      let match: { date: string; time: string } | null = null;
      for (let offset = 0; offset <= Math.min(service.maximumAdvanceDays, 28); offset += 1) {
        const candidate = addDaysToDateInput(today, offset);
        const found = slotsForDate(candidate, service).slots[0];
        if (found) { match = { date: candidate, time: found }; break; }
      }
      result.set(service.id, match);
    }
    return result;
  }, [services, slotsForDate, today]);

  function chooseService(id: string) {
    const first = firstAvailability.get(id);
    setServiceId(id); setDate(first?.date ?? today); setTime(""); setAssignedStaffId(""); setStaffChoice("any");
    if (first) {
      const distance = new Date(`${first.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
      setWeekOffset(Math.max(0, Math.floor(distance / 604800000)));
    } else setWeekOffset(0);
    setStep(staffLoaded && staff.length ? "staff" : "time");
  }

  function chooseDefaultService(id: string) {
    const first = firstAvailability.get(id);
    setServiceId(id);
    setDate(first?.date ?? today);
    setTime("");
  }

  function chooseSlot(slot: string) {
    setTime(slot);
    setAssignedStaffId(availability.staffBySlot.get(slot) ?? (staffChoice === "any" ? "" : staffChoice));
  }

  if (variant !== "salon") {
    const times = selectedService ? availability.slots : [];
    const nearest = selectedService ? firstAvailability.get(selectedService.id) : null;
    return <form action={action} data-booking-form="default" className="mt-8 grid gap-4">
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="lang" value={locale} /><input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} /><input type="hidden" name="form_started_at" value={formStartedAt} />
      <label className="absolute left-[-10000px]" aria-hidden="true">{t.website}<input name="website" tabIndex={-1} /></label>
      <label className="grid gap-2 text-sm font-semibold">{t.name}<input name="name" required className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">{t.email}<input name="email" required type="email" className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">{t.phone}<input name="phone" type="tel" className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">{t.service}<select name="service_id" required value={serviceId} onChange={(e) => chooseDefaultService(e.target.value)} className="rounded-xl border px-4 py-3"><option value="">{t.chooseService}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
      <input aria-label={t.chooseDayTime} type="date" required disabled={!selectedService} min={today} max={maximumDate} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} className="rounded-xl border px-4 py-3 disabled:opacity-55" />
      <select aria-label={t.chooseTime} required disabled={!selectedService || !times.length} value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border px-4 py-3 disabled:opacity-55"><option value="">{selectedService && !times.length ? t.noTimesDay : t.chooseTime}</option>{times.map((slot) => <option key={slot}>{slot}</option>)}</select>
      {selectedService && !times.length ? <div className="rounded-xl border border-black/10 bg-black/[.03] p-3 text-sm"><p>{t.noTimesDay}</p>{nearest && nearest.date !== date ? <button type="button" onClick={() => { setDate(nearest.date); setTime(""); }} className="mt-2 min-h-0 font-bold underline underline-offset-4">{t.nearestAvailable}: {formatDateLabel(nearest.date)} {t.at} {nearest.time}</button> : null}</div> : null}
      <button disabled={!selectedService || !time} className="rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white disabled:opacity-45">{t.sendCode}</button>
    </form>;
  }

  const steps: Array<[SalonStep, string]> = staff.length ? [["service", t.service], ["staff", t.staff], ["time", t.time], ["details", t.details]] : [["service", t.service], ["time", t.time], ["details", t.details]];
  const currentIndex = steps.findIndex(([key]) => key === step);
  const selectedStaff = staff.find((member) => member.id === assignedStaffId || member.id === staffChoice);

  return <form action={action} data-booking-form="guided" className="mt-5">
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="lang" value={locale} /><input type="hidden" name="service_id" value={serviceId} /><input type="hidden" name="staff_id" value={assignedStaffId} /><input type="hidden" name="starts_at" value={date && selectedTime ? `${date}T${selectedTime}` : ""} /><input type="hidden" name="form_started_at" value={formStartedAt} />
    <label className="absolute left-[-10000px]" aria-hidden="true">{t.website}<input name="website" tabIndex={-1} /></label>

    <div className={`mb-5 grid gap-2 ${steps.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>{steps.map(([key, label], index) => <div key={key} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index === currentIndex ? "bg-[#17452f] text-white" : index < currentIndex ? "bg-[#dceee2] text-[#17452f]" : "bg-[#eef1ed] text-[#7a857e]"}`}>{index < currentIndex ? <Check className="h-4 w-4" /> : index + 1}</div><p className="mt-1 text-[11px] font-bold text-[#5b665f]">{label}</p></div>)}</div>

    {step === "service" ? <section><h3 className="text-2xl font-black">{t.chooseService}</h3><p className="mt-2 text-sm text-[#5b665f]">{t.serviceIntro}</p><div className="mt-4 grid gap-3">{services.map((service) => { const first = firstAvailability.get(service.id); return <article key={service.id} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5ef]"><Scissors className="h-5 w-5 text-[#17452f]" /></div><div className="flex-1"><h4 className="font-black">{service.name}</h4><p className="mt-2 text-sm font-bold text-[#5b665f]">{service.durationMinutes} min{service.priceLabel ? ` · ${service.priceLabel}` : ""}</p><p className="mt-2 text-sm font-bold text-[#2873b9]">{first ? `${t.available} ${formatDateLabel(first.date)} ${t.at} ${first.time}` : t.noTimes}</p></div></div><button type="button" disabled={!first} onClick={() => chooseService(service.id)} className="mt-4 w-full rounded-2xl bg-[#17452f] p-3 font-black text-white disabled:opacity-40">{t.book}</button></article>; })}</div></section> : null}

    {step === "staff" && selectedService ? <section><button type="button" onClick={() => setStep("service")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> {t.changeService}</button><h3 className="text-2xl font-black">{t.chooseStaff}</h3><p className="mt-2 text-sm text-[#5b665f]">{t.staffIntro}</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => { setStaffChoice("any"); setTime(""); setAssignedStaffId(""); setStep("time"); }} className="flex items-center gap-3 rounded-3xl border bg-white p-4 text-left"><UsersRound className="h-6 w-6 text-[#17452f]" /><span><strong className="block">{t.firstStaff}</strong><span className="text-sm text-[#5b665f]">{t.fastest}</span></span></button>{staff.map((member) => <button key={member.id} type="button" onClick={() => { setStaffChoice(member.id); setTime(""); setAssignedStaffId(member.id); setStep("time"); }} className="flex items-center gap-3 rounded-3xl border bg-white p-4 text-left"><UserRound className="h-6 w-6 text-[#17452f]" /><span><strong className="block">{member.name}</strong><span className="text-sm text-[#5b665f]">{member.roleLabel || t.genericStaff}</span></span></button>)}</div></section> : null}

    {step === "time" && selectedService ? <section><button type="button" onClick={() => setStep(staff.length ? "staff" : "service")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> {t.back}</button><div className="rounded-3xl border bg-white p-4"><h3 className="font-black">{selectedService.name}</h3><p className="text-sm text-[#5b665f]">{staffChoice === "any" ? t.firstStaff : selectedStaff?.name}</p></div><div className="mt-4 flex items-center justify-between"><button type="button" disabled={!weekOffset} onClick={() => { setWeekOffset((v) => Math.max(0, v - 1)); setTime(""); }} className="rounded-full border p-3 disabled:opacity-30"><ArrowLeft /></button><strong>{t.chooseDayTime}</strong><button type="button" onClick={() => { setWeekOffset((v) => v + 1); setTime(""); }} className="rounded-full bg-[#17452f] p-3 text-white"><ArrowRight /></button></div><div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekDates.map((value) => { const slots = slotsForDate(value, selectedService).slots; const parts = dateParts(value); return <button key={value} type="button" disabled={!slots.length} onClick={() => { setDate(value); setTime(""); setAssignedStaffId(staffChoice === "any" ? "" : staffChoice); }} className={`rounded-2xl border p-2 ${date === value ? "bg-[#17452f] text-white" : "bg-white"} disabled:opacity-30`}><span className="block text-xs">{t.weekdays[parts.weekday]}</span><strong>{parts.day}</strong></button>; })}</div><div className="mt-4 rounded-3xl border bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#17452f]" /><strong>{formatDateLabel(date)}</strong></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{availability.slots.length ? availability.slots.map((slot) => <button key={slot} type="button" onClick={() => chooseSlot(slot)} className={`rounded-2xl border p-4 font-black ${selectedTime === slot ? "bg-[#17452f] text-white" : "bg-[#eef8f1] text-[#17452f]"}`}>{slot}</button>) : <p className="col-span-full p-3 text-sm text-[#5b665f]">{t.noTimesDay}</p>}</div></div><button type="button" disabled={!selectedTime || (staff.length > 0 && !assignedStaffId)} onClick={() => setStep("details")} className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#17452f] p-4 font-black text-white disabled:opacity-40">{t.continue} <ArrowRight className="ml-2 h-4 w-4" /></button></section> : null}

    {step === "details" && selectedService ? <section><button type="button" onClick={() => setStep("time")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> {t.changeTime}</button><div className="rounded-3xl border bg-white p-4"><h3 className="font-black">{selectedService.name}</h3><p className="mt-1 text-sm text-[#5b665f]">{formatDateLabel(date)} {t.at} {selectedTime} · {selectedStaff?.name ?? t.genericStaff}</p></div><div className="mt-4 rounded-3xl border bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#17452f]" /><h3 className="font-black">{t.yourDetails}</h3></div><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-bold">{t.name}<input name="name" required className="rounded-2xl border bg-white px-4 py-3" /></label><label className="grid gap-1 text-sm font-bold">{t.phone}<input name="phone" type="tel" className="rounded-2xl border bg-white px-4 py-3" /></label><label className="grid gap-1 text-sm font-bold">{t.email}<input name="email" required type="email" className="rounded-2xl border bg-white px-4 py-3" /></label></div><div className="mt-4 flex gap-3 rounded-2xl bg-[#edf5ef] p-3 text-xs"><MailCheck className="h-5 w-5 text-[#17452f]" /><p>{t.verificationInfo}</p></div><button className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#17452f] p-4 font-black text-white">{t.sendCode} <ArrowRight className="ml-2 h-4 w-4" /></button></div></section> : null}
  </form>;
}
