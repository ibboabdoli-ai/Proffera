"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronRight, CirclePoundSterling, Home, Mail, MapPin, Sparkles } from "lucide-react";

import { calculatePrimeViewPrice, serviceKeyFromName, type PrimeViewPricingInput } from "@/features/primeview/pricing";
import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import { PrimeViewGoogleAddressAutocomplete } from "./primeview-google-address-autocomplete";

type BookingService = BookingAvailabilityService & { id: string; name: string };
type BookingHour = BookingAvailabilityHour & { weekday: number };
type BusyBooking = BookingAvailabilityBusyBooking;

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  timeZone: WorkspaceTimeZone;
  initialServiceId?: string;
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

const serviceDescriptions: Record<string, string> = {
  "window cleaning": "Normal-size windows, outside only: £3 each with a £29.99 minimum.",
  "gutter cleaning": "From £59.99 Terraced; £69.99 Semi-detached or Detached.",
  "pressure washing": "£9 per m² with a £179.99 minimum.",
  "driveway & patio cleaning": "£9 per m² with a £179.99 minimum.",
  "gutter + pressure washing": "This previous package is no longer offered.",
  "fascia & soffit cleaning": "Fascia & Gutter: from £89.99 Terraced; £139.99 Semi-detached or Detached.",
  "fascia & gutter cleaning": "From £89.99 Terraced; £139.99 Semi-detached or Detached.",
  "conservatory roof cleaning": "Starting from £89.99 with no automatic add-on surcharges.",
  "solar panel cleaning": "£59.99 minimum; panel quantity sets the base price above the minimum.",
};

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function propertySizeFromPropertyType(value: string): PrimeViewPricingInput["propertySize"] {
  if (value === "Terraced" || value === "End of terrace") return "Terraced house";
  if (value === "Semi-detached") return "Semi-detached house";
  if (value === "Detached") return "Detached house";
  if (value === "Bungalow" || value === "Flat / Apartment") return "Small property";
  if (value === "Commercial (Shop/Office)") return "Large property";
  return undefined;
}

function formatPrice(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

const fieldClass = "min-h-12 w-full rounded-xl border border-[#cbd8e6] bg-white px-4 py-3 text-[15px] text-[#0b2a4a] outline-none transition placeholder:text-[#7b8da1] focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10";
const labelClass = "grid gap-2 text-sm font-bold text-[#183e63]";
const cardClass = "rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7";


export function PrimeViewPrecisionBookingForm({ action, services, bookingHours, busyBookings, timeZone, initialServiceId = "" }: Props) {
  const searchParams = useSearchParams();
  const requestedServiceName = (searchParams.get("service") ?? "").trim();
  const requestedPostcode = (searchParams.get("postcode") ?? "").trim().toUpperCase();
  const [formStartedAt] = useState(() => Date.now());
  const [referenceTime] = useState(() => Date.now());
  const today = dateInputInTimeZone(new Date(referenceTime), timeZone);
  const [serviceId, setServiceId] = useState(() => {
    if (services.some((service) => service.id === initialServiceId)) return initialServiceId;
    const requestedService = requestedServiceName
      ? services.find((service) => service.name.toLowerCase() === requestedServiceName.toLowerCase())
      : undefined;
    return requestedService?.id ?? services[0]?.id ?? "";
  });
  const [postcode, setPostcode] = useState(() => UK_POSTCODE.test(requestedPostcode) ? requestedPostcode : "");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");

  const [propertyType, setPropertyType] = useState("");
  const [rearGardenAccess, setRearGardenAccess] = useState("Side access");
  const [floorCount, setFloorCount] = useState<NonNullable<PrimeViewPricingInput["floorCount"]>>("2");
  const [workingHeight, setWorkingHeight] = useState<NonNullable<PrimeViewPricingInput["workingHeight"]>>("First floor");
  const [parking, setParking] = useState("Parking directly outside");
  const [pets, setPets] = useState("No");

  const [standardWindows, setStandardWindows] = useState("");
  const [framesSills, setFramesSills] = useState("Yes");

  const [solarPanels, setSolarPanels] = useState("");
  const [areaM2, setAreaM2] = useState("");

  const selectedService = services.find((service) => service.id === serviceId);
  const serviceKey = selectedService ? serviceKeyFromName(selectedService.name) : null;
  const inferredPropertySize = propertySizeFromPropertyType(propertyType);
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;

  const times = useMemo(() => {
    if (!selectedService || !date) return [];
    const hour = bookingHours.find((item) => item.weekday === weekdayForDate(date));
    if (!hour) return [];
    return getAvailableBookingTimes({ date, service: selectedService, hours: hour, busyBookings, referenceTimeMs: referenceTime, timeZone });
  }, [bookingHours, busyBookings, date, referenceTime, selectedService, timeZone]);

  const pricingInput = useMemo<PrimeViewPricingInput | null>(() => serviceKey ? ({
  serviceKey,
  access: "Normal",
  condition: "Normal",
  floorCount,
  workingHeight,
  cleaningScope: serviceKey === "window" ? "Outside only" : undefined,
  standardWindows: Number(standardWindows),
  propertySize: serviceKey === "window" || serviceKey === "gutter" || serviceKey === "fascia_gutter" ? inferredPropertySize : undefined,
  solarPanels: Number(solarPanels),
  areaM2: Number(areaM2),
  multiServiceCount: 1,
}) : null, [areaM2, floorCount, inferredPropertySize, serviceKey, solarPanels, standardWindows, workingHeight]);

  const price = useMemo(() => pricingInput ? calculatePrimeViewPrice(pricingInput) : null, [pricingInput]);

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

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} />
      <input type="hidden" name="form_started_at" value={formStartedAt} />
      {(serviceKey === "window" || serviceKey === "gutter" || serviceKey === "fascia_gutter") ? <input type="hidden" name="property_size" value={inferredPropertySize ?? ""} /> : null}
      <label className="absolute left-[-10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} /></label>

      <div className="grid gap-5">
        <section className={cardClass}>
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0b2a4a]">1. Choose a service</h2><p className="mt-1 text-sm leading-6 text-[#5d7187]">Each service is priced independently. Nothing is added unless you choose it.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const active = service.id === serviceId;
              const description = serviceDescriptions[service.name.toLowerCase()] ?? "Professional exterior cleaning by PrimeView.";
              const packageService = serviceKeyFromName(service.name) === "package";
              return <button key={service.id} type="button" onClick={() => chooseService(service.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#2f80ed] bg-[#eef6ff] ring-2 ring-[#2f80ed]/15" : "border-[#d9e4ef] bg-white hover:border-[#9fc1e8] hover:bg-[#f8fbff]"}`}><div className="flex items-start justify-between gap-3"><div><strong className="text-[15px] text-[#0b2a4a]">{service.name}</strong>{packageService ? <span className="ml-2 inline-flex rounded-full bg-[#e8f5eb] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1f6a3d]">Best value</span> : null}</div>{active ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f80ed] text-white"><Check className="h-4 w-4" /></span> : null}</div><p className="mt-2 text-xs leading-5 text-[#667b91]">{description}</p></button>;
            })}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Home className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0b2a4a]">2. Property & price details</h2><p className="mt-1 text-sm text-[#667b91]">Simple starting prices. Access, height and condition do not add automatic surcharges.</p></div></div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Property type<select name="property_type" required value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className={fieldClass}><option value="">Choose</option><option>Detached</option><option>Semi-detached</option><option>Terraced</option><option>End of terrace</option><option>Bungalow</option><option>Flat / Apartment</option><option>Commercial (Shop/Office)</option></select></label>
            <label className={labelClass}>Rear garden access<select name="rear_garden_access" required value={rearGardenAccess} onChange={(event) => setRearGardenAccess(event.target.value)} className={fieldClass}><option>Side access</option><option>Through the property only</option><option>No access / arrangement required</option></select></label>
            <label className={labelClass}>Number of floors<select name="floor_count" required value={floorCount} onChange={(event) => setFloorCount(event.target.value as typeof floorCount)} className={fieldClass}><option>1</option><option>2</option><option>3+</option><option>Unknown</option></select></label>
            <label className={labelClass}>Working height<select name="working_height" required value={workingHeight} onChange={(event) => setWorkingHeight(event.target.value as typeof workingHeight)} className={fieldClass}><option>Ground floor only</option><option>First floor</option><option>Second floor+</option><option>Long ladder required</option></select></label>
            <label className={labelClass}>Parking<select name="parking" required value={parking} onChange={(event) => setParking(event.target.value)} className={fieldClass}><option>Parking directly outside</option><option>Parking nearby</option><option>Difficult / paid parking</option></select></label>
            <label className={labelClass}>Pets at property<select name="pets" required value={pets} onChange={(event) => setPets(event.target.value)} className={fieldClass}><option>No</option><option>Yes</option></select></label>
            <label className={labelClass}>UK postcode<input name="postcode" required autoComplete="postal-code" placeholder="W4 3ES" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" value={postcode} onChange={(event) => { setPostcode(event.target.value.toUpperCase()); setAddress(""); }} className={fieldClass} /></label>
            <div className="sm:col-span-2 rounded-2xl border border-[#d9e4ef] bg-[#f9fbfe] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#183e63]"><MapPin className="h-4 w-4 text-[#1769c2]" />Find your address</div>
              <PrimeViewGoogleAddressAutocomplete onSelect={({ address: nextAddress, postcode: nextPostcode }) => {
                setAddress(nextAddress);
                if (nextPostcode) setPostcode(nextPostcode);
              }} />
            </div>
            <label className={`${labelClass} sm:col-span-2`}>Full address<input name="address" required autoComplete="street-address" placeholder="House number and street" value={address} onChange={(event) => setAddress(event.target.value)} className={fieldClass} /></label>

            {serviceKey === "window" ? <>
    <label className={labelClass}>Normal-size windows<input name="standard_windows" required type="number" min="1" max="500" value={standardWindows} onChange={(event) => setStandardWindows(event.target.value)} placeholder="e.g. 10" className={fieldClass} /></label>
    <input type="hidden" name="cleaning_scope" value="Outside only" />
    <div className="rounded-xl border border-[#d9e4ef] bg-[#f9fbfe] px-4 py-3 text-sm font-bold text-[#183e63]">Outside only · £3 per normal-size window · £29.99 minimum</div>
    <label className={labelClass}>Frames & sills<select name="frames_sills" value={framesSills} onChange={(event) => setFramesSills(event.target.value)} className={fieldClass}><option>Yes</option><option>No</option></select></label>
  </> : null}



            {serviceKey === "conservatory" ? <div className="rounded-xl border border-[#d9e4ef] bg-[#f9fbfe] px-4 py-3 text-sm font-bold text-[#183e63]">Conservatory Cleaning starts from £89.99.</div> : null}

            {serviceKey === "solar" ? <label className={labelClass}>Number of solar panels<input name="solar_panels" required type="number" min="1" max="500" value={solarPanels} onChange={(event) => setSolarPanels(event.target.value)} placeholder="e.g. 12" className={fieldClass} /></label> : null}

            {serviceKey === "patio" ? <label className={labelClass}>Pressure-washing area in m²<input name="area_m2" required type="number" min="1" step="0.5" value={areaM2} onChange={(event) => setAreaM2(event.target.value)} placeholder="e.g. 35" className={fieldClass} /></label> : null}

            <input type="hidden" name="access" value="Normal" />
            <input type="hidden" name="condition" value="Normal" />

            <label className={`${labelClass} sm:col-span-2`}>Anything we should know before arriving?<textarea name="arrival_notes" rows={3} maxLength={1200} placeholder="Dog in the property, locked gate, no side access, fragile plants, or anything else we should know" className={fieldClass} /></label>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><CalendarDays className="h-5 w-5" /></div><h2 className="text-xl font-black text-[#0b2a4a]">3. Preferred date & time</h2></div>
          <p className="mt-2 text-sm leading-6 text-[#667b91]">This is your preferred visit time. PrimeView confirms the final appointment after reviewing the job details.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Date<input type="date" required min={today} max={maximumDate} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className={fieldClass} /></label><label className={labelClass}>Time<select required value={time} onChange={(event) => setTime(event.target.value)} className={fieldClass}><option value="">{times.length ? "Choose time" : "No available times on this date"}</option>{times.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label></div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Mail className="h-5 w-5" /></div><h2 className="text-xl font-black text-[#0b2a4a]">4. Contact details</h2></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Name<input name="name" required autoComplete="name" className={fieldClass} /></label><label className={labelClass}>Phone<input name="phone" required type="tel" autoComplete="tel" placeholder="07... or +44..." className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>Email<input name="email" required type="email" autoComplete="email" className={fieldClass} /></label></div>
          <button disabled={!selectedService || !time} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0a3c8f] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#0a3c8f]/20 transition hover:bg-[#061b42] disabled:cursor-not-allowed disabled:opacity-45">Send verification code<ChevronRight className="h-5 w-5" /></button>
          <p className="mt-3 text-center text-xs leading-5 text-[#6b7f94]">The booking request is created after you verify the six-digit code sent to your email.</p>
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className="overflow-hidden rounded-3xl bg-[#0b2a4a] text-white shadow-[0_18px_55px_rgba(11,42,74,.22)]">
          <div className="border-b border-white/10 bg-[#123b64] px-5 py-4"><div className="flex items-center gap-2 text-sm font-bold text-[#cfe5ff]"><CirclePoundSterling className="h-5 w-5" />Live calculated price</div></div>
          <div className="p-5">
            {!price ? <><p className="text-2xl font-black">Choose a service</p><p className="mt-3 text-sm text-[#d3e2f2]">The pricing rules will appear here.</p></> : price.kind === "manual" ? <><p className="text-2xl font-black">Request a Quote</p><p className="mt-3 text-sm leading-6 text-[#d3e2f2]">{price.reason}</p><p className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#dbeafe]">{price.note}</p></> : <><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9caee]">Estimated price</p>{price.compareAtTotal ? <p className="mt-2 text-sm font-bold text-[#9fb4c9] line-through">£{formatPrice(price.compareAtTotal)}</p> : null}<div className="mt-1 flex flex-wrap items-end gap-3"><p className="text-5xl font-black tracking-tight">£{formatPrice(price.total)}</p>{price.saving ? <span className="mb-1 inline-flex rounded-full bg-[#e8f5eb] px-3 py-1 text-xs font-black text-[#17452f]">Save £{formatPrice(price.saving)}</span> : null}</div>{price.minimumApplied ? <p className="mt-2 inline-flex rounded-full bg-[#1e5c91] px-3 py-1 text-xs font-black">Minimum charge applied</p> : null}<div className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-xs text-[#d3e2f2]">{price.lines.map((line, index) => <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-3"><span>{line.label}</span><strong className={line.amount < 0 ? "text-[#8fe3b5]" : "text-white"}>{line.amount < 0 ? "−" : "+"}£{formatPrice(Math.abs(line.amount))}</strong></div>)}</div><p className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#dbeafe]">{price.note}</p></>}
          </div>
          <div className="border-t border-white/10 bg-[#09243f] p-5 text-xs leading-5 text-[#c8d9eb]"><p><strong>Window:</strong> £29.99 minimum · £3 per normal-size window · outside only.</p><p className="mt-2"><strong>Gutter:</strong> Terraced from £59.99 · Semi-detached / Detached from £69.99.</p><p className="mt-2"><strong>Fascia & Gutter:</strong> Terraced from £89.99 · Semi-detached / Detached from £139.99.</p><p className="mt-2"><strong>Other minimums:</strong> Conservatory £89.99 · Solar £59.99 · Pressure Washing £179.99. No automatic surcharge options are added by the calculator.</p></div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_12px_36px_rgba(11,42,74,.06)]"><h3 className="font-black text-[#0b2a4a]">Booking summary</h3><div className="mt-4 grid gap-3 text-sm"><div className="flex gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Service</p><p className="mt-1 font-bold text-[#183e63]">{selectedService?.name ?? "—"}</p></div></div><div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Area</p><p className="mt-1 font-bold text-[#183e63]">West & North London</p></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Preferred visit</p><p className="mt-1 font-bold text-[#183e63]">{date}{time ? ` · ${time}` : ""}</p></div></div></div></section>
      </aside>
    </form>
  );
}
