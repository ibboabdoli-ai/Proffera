"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MailCheck, Scissors, UserRound, UsersRound } from "lucide-react";

import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type BookingService = BookingAvailabilityService & { name: string; priceLabel: string };
type BookingHour = BookingAvailabilityHour & { weekday: number };
type BusyBooking = BookingAvailabilityBusyBooking;
type BookingStaff = { id: string; name: string; roleLabel: string; schedules: BookingHour[]; busy: BusyBooking[] };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  timeZone: WorkspaceTimeZone;
  variant?: "default" | "salon";
};

type SalonStep = "service" | "staff" | "time" | "details";
const weekdayShort = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
const monthShort = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

function formatDateLabel(value: string) {
  const { day, month, weekday } = dateParts(value);
  return `${weekdayShort[weekday]} ${day} ${monthShort[month - 1]}`;
}

export function BookingRequestForm({ action, slug, services, bookingHours, busyBookings, timeZone, variant = "default" }: Props) {
  const [formStartedAt] = useState(() => Date.now());
  const [referenceTime, setReferenceTime] = useState(formStartedAt);
  const today = dateInputInTimeZone(new Date(referenceTime), timeZone);
  const [serviceName, setServiceName] = useState("");
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

  const selectedService = services.find((service) => service.name === serviceName);
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToDateInput(today, weekOffset * 7 + index)), [today, weekOffset]);

  useEffect(() => {
    if (!weekDates.includes(date)) { setDate(weekDates[0]); setTime(""); setAssignedStaffId(""); }
  }, [date, weekDates]);

  function slotsForStaff(member: BookingStaff, targetDate: string, service: BookingService) {
    const hours = member.schedules.find((item) => item.weekday === weekdayForDate(targetDate));
    if (!hours) return [];
    return getAvailableBookingTimes({ date: targetDate, service, hours, busyBookings: member.busy, referenceTimeMs: referenceTime, timeZone });
  }

  function slotsForDate(targetDate: string, service: BookingService) {
    if (staff.length) {
      const candidates = staffChoice === "any" ? staff : staff.filter((member) => member.id === staffChoice);
      const map = new Map<string, string>();
      for (const member of candidates) for (const slot of slotsForStaff(member, targetDate, service)) if (!map.has(slot)) map.set(slot, member.id);
      return { slots: [...map.keys()].sort(), staffBySlot: map };
    }
    const hours = bookingHours.find((item) => item.weekday === weekdayForDate(targetDate));
    const slots = hours ? getAvailableBookingTimes({ date: targetDate, service, hours, busyBookings, referenceTimeMs: referenceTime, timeZone }) : [];
    return { slots, staffBySlot: new Map<string, string>() };
  }

  const availability = useMemo(() => selectedService ? slotsForDate(date, selectedService) : { slots: [], staffBySlot: new Map<string, string>() }, [selectedService, date, staff, staffChoice, bookingHours, busyBookings, referenceTime, timeZone]);
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
      result.set(service.name, match);
    }
    return result;
  }, [services, today, staff, staffChoice, bookingHours, busyBookings, referenceTime, timeZone]);

  function chooseService(name: string) {
    const first = firstAvailability.get(name);
    setServiceName(name); setDate(first?.date ?? today); setTime(""); setAssignedStaffId(""); setStaffChoice("any");
    if (first) {
      const distance = new Date(`${first.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
      setWeekOffset(Math.max(0, Math.floor(distance / 604800000)));
    } else setWeekOffset(0);
    setStep(staffLoaded && staff.length ? "staff" : "time");
  }

  function chooseSlot(slot: string) {
    setTime(slot);
    setAssignedStaffId(availability.staffBySlot.get(slot) ?? (staffChoice === "any" ? "" : staffChoice));
  }

  if (variant !== "salon") {
    const hours = bookingHours.find((item) => item.weekday === weekdayForDate(date));
    const times = selectedService && hours ? getAvailableBookingTimes({ date, service: selectedService, hours, busyBookings, referenceTimeMs: referenceTime, timeZone }) : [];
    return <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} /><input type="hidden" name="form_started_at" value={formStartedAt} />
      <label className="grid gap-2 text-sm font-semibold">Namn<input name="name" required className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">E-post<input name="email" required type="email" className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">Telefon<input name="phone" type="tel" className="rounded-xl border px-4 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold">Tjänst<select name="service" required value={serviceName} onChange={(e) => { setServiceName(e.target.value); setTime(""); }} className="rounded-xl border px-4 py-3"><option value="">Välj tjänst</option>{services.map((service) => <option key={service.name}>{service.name}</option>)}</select></label>
      <input type="date" required min={today} max={maximumDate} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} className="rounded-xl border px-4 py-3" />
      <select required value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border px-4 py-3"><option value="">Välj tid</option>{times.map((slot) => <option key={slot}>{slot}</option>)}</select>
      <button className="rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white">Skicka verifieringskod</button>
    </form>;
  }

  const steps: Array<[SalonStep, string]> = staff.length ? [["service", "Tjänst"], ["staff", "Personal"], ["time", "Tid"], ["details", "Uppgifter"]] : [["service", "Tjänst"], ["time", "Tid"], ["details", "Uppgifter"]];
  const currentIndex = steps.findIndex(([key]) => key === step);
  const selectedStaff = staff.find((member) => member.id === assignedStaffId || member.id === staffChoice);

  return <form action={action} className="mt-5">
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="service" value={serviceName} /><input type="hidden" name="staff_id" value={assignedStaffId} /><input type="hidden" name="starts_at" value={date && selectedTime ? `${date}T${selectedTime}` : ""} /><input type="hidden" name="form_started_at" value={formStartedAt} />
    <label className="absolute left-[-10000px]" aria-hidden="true">Webbplats<input name="website" tabIndex={-1} /></label>

    <div className={`mb-5 grid gap-2 ${steps.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>{steps.map(([key, label], index) => <div key={key} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index === currentIndex ? "bg-[#17452f] text-white" : index < currentIndex ? "bg-[#dceee2] text-[#17452f]" : "bg-[#eef1ed] text-[#7a857e]"}`}>{index < currentIndex ? <Check className="h-4 w-4" /> : index + 1}</div><p className="mt-1 text-[11px] font-bold text-[#5b665f]">{label}</p></div>)}</div>

    {step === "service" ? <section><h3 className="text-2xl font-black">Välj tjänst</h3><p className="mt-2 text-sm text-[#5b665f]">Se pris, behandlingstid och närmaste lediga tid.</p><div className="mt-4 grid gap-3">{services.map((service) => { const first = firstAvailability.get(service.name); return <article key={service.name} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5ef]"><Scissors className="h-5 w-5 text-[#17452f]" /></div><div className="flex-1"><h4 className="font-black">{service.name}</h4><p className="mt-2 text-sm font-bold text-[#5b665f]">{service.durationMinutes} min{service.priceLabel ? ` · ${service.priceLabel}` : ""}</p><p className="mt-2 text-sm font-bold text-[#2873b9]">{first ? `Ledig ${formatDateLabel(first.date)} kl. ${first.time}` : "Inga lediga tider"}</p></div></div><button type="button" disabled={!first} onClick={() => chooseService(service.name)} className="mt-4 w-full rounded-2xl bg-[#17452f] p-3 font-black text-white disabled:opacity-40">Boka</button></article>; })}</div></section> : null}

    {step === "staff" && selectedService ? <section><button type="button" onClick={() => setStep("service")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> Byt tjänst</button><h3 className="text-2xl font-black">Välj personal</h3><p className="mt-2 text-sm text-[#5b665f]">Välj en specifik person eller första lediga.</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => { setStaffChoice("any"); setTime(""); setAssignedStaffId(""); setStep("time"); }} className="flex items-center gap-3 rounded-3xl border bg-white p-4 text-left"><UsersRound className="h-6 w-6 text-[#17452f]" /><span><strong className="block">Första lediga personal</strong><span className="text-sm text-[#5b665f]">Snabbaste tillgängliga tiden</span></span></button>{staff.map((member) => <button key={member.id} type="button" onClick={() => { setStaffChoice(member.id); setTime(""); setAssignedStaffId(member.id); setStep("time"); }} className="flex items-center gap-3 rounded-3xl border bg-white p-4 text-left"><UserRound className="h-6 w-6 text-[#17452f]" /><span><strong className="block">{member.name}</strong><span className="text-sm text-[#5b665f]">{member.roleLabel || "Personal"}</span></span></button>)}</div></section> : null}

    {step === "time" && selectedService ? <section><button type="button" onClick={() => setStep(staff.length ? "staff" : "service")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> Tillbaka</button><div className="rounded-3xl border bg-white p-4"><h3 className="font-black">{selectedService.name}</h3><p className="text-sm text-[#5b665f]">{staffChoice === "any" ? "Första lediga personal" : selectedStaff?.name}</p></div><div className="mt-4 flex items-center justify-between"><button type="button" disabled={!weekOffset} onClick={() => { setWeekOffset((v) => Math.max(0, v - 1)); setTime(""); }} className="rounded-full border p-3 disabled:opacity-30"><ArrowLeft /></button><strong>Välj dag och tid</strong><button type="button" onClick={() => { setWeekOffset((v) => v + 1); setTime(""); }} className="rounded-full bg-[#17452f] p-3 text-white"><ArrowRight /></button></div><div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekDates.map((value) => { const slots = slotsForDate(value, selectedService).slots; const parts = dateParts(value); return <button key={value} type="button" disabled={!slots.length} onClick={() => { setDate(value); setTime(""); setAssignedStaffId(staffChoice === "any" ? "" : staffChoice); }} className={`rounded-2xl border p-2 ${date === value ? "bg-[#17452f] text-white" : "bg-white"} disabled:opacity-30`}><span className="block text-xs">{weekdayShort[parts.weekday]}</span><strong>{parts.day}</strong></button>; })}</div><div className="mt-4 rounded-3xl border bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#17452f]" /><strong>{formatDateLabel(date)}</strong></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{availability.slots.length ? availability.slots.map((slot) => <button key={slot} type="button" onClick={() => chooseSlot(slot)} className={`rounded-2xl border p-4 font-black ${selectedTime === slot ? "bg-[#17452f] text-white" : "bg-[#eef8f1] text-[#17452f]"}`}>{slot}</button>) : <p className="col-span-full p-3 text-sm text-[#5b665f]">Inga lediga tider denna dag.</p>}</div></div><button type="button" disabled={!selectedTime || (staff.length > 0 && !assignedStaffId)} onClick={() => setStep("details")} className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#17452f] p-4 font-black text-white disabled:opacity-40">Fortsätt <ArrowRight className="ml-2 h-4 w-4" /></button></section> : null}

    {step === "details" && selectedService ? <section><button type="button" onClick={() => setStep("time")} className="mb-4 inline-flex items-center gap-2 font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> Byt tid</button><div className="rounded-3xl border bg-white p-4"><h3 className="font-black">{selectedService.name}</h3><p className="mt-1 text-sm text-[#5b665f]">{formatDateLabel(date)} kl. {selectedTime} · {selectedStaff?.name ?? "Personal"}</p></div><div className="mt-4 rounded-3xl border bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#17452f]" /><h3 className="font-black">Dina uppgifter</h3></div><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-bold">Namn<input name="name" required className="rounded-2xl border bg-white px-4 py-3" /></label><label className="grid gap-1 text-sm font-bold">Telefon<input name="phone" type="tel" className="rounded-2xl border bg-white px-4 py-3" /></label><label className="grid gap-1 text-sm font-bold">E-post<input name="email" required type="email" className="rounded-2xl border bg-white px-4 py-3" /></label></div><div className="mt-4 flex gap-3 rounded-2xl bg-[#edf5ef] p-3 text-xs"><MailCheck className="h-5 w-5 text-[#17452f]" /><p>Vi skickar en sexsiffrig kod. Bokningen blir klar efter verifiering.</p></div><button className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#17452f] p-4 font-black text-white">Skicka verifieringskod <ArrowRight className="ml-2 h-4 w-4" /></button></div></section> : null}
  </form>;
}
