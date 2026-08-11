"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronRight, CirclePoundSterling, Home, Loader2, Mail, MapPin, Sparkles } from "lucide-react";

import { calculatePrimeViewPrice, serviceKeyFromName, type PrimeViewAccess, type PrimeViewCondition, type PrimeViewPricingInput } from "@/features/primeview/pricing";
import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

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
  "window cleaning": "Price by window size, inside/outside, floor, dirt, access and frequency.",
  "gutter cleaning": "Price by property type, height, blockage, condition and access.",
  "fascia & soffit cleaning": "Price by property type, condition and access.",
  "conservatory roof cleaning": "Price by conservatory size, algae / dirt and access.",
  "solar panel cleaning": "Price by panel count, roof access and condition.",
  "driveway & patio cleaning": "Price by m², dirt / moss and optional treatments.",
};

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const fieldClass = "min-h-12 w-full rounded-xl border border-[#cbd8e6] bg-white px-4 py-3 text-[15px] text-[#0b2a4a] outline-none transition placeholder:text-[#7b8da1] focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10";
const labelClass = "grid gap-2 text-sm font-bold text-[#183e63]";
const cardClass = "rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_14px_45px_rgba(11,42,74,.07)] sm:p-7";

function Checkbox({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#d9e4ef] bg-[#f9fbfe] px-4 py-3 text-sm font-bold text-[#183e63]"><input type="checkbox" name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#1769c2]" />{label}</label>;
}

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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");

  const [propertyType, setPropertyType] = useState("");
  const [rearGardenAccess, setRearGardenAccess] = useState("Side access");
  const [floorCount, setFloorCount] = useState<NonNullable<PrimeViewPricingInput["floorCount"]>>("2");
  const [workingHeight, setWorkingHeight] = useState<NonNullable<PrimeViewPricingInput["workingHeight"]>>("First floor");
  const [parking, setParking] = useState("Parking directly outside");
  const [windowAccess, setWindowAccess] = useState<NonNullable<PrimeViewPricingInput["windowAccess"]>>("Easy access");
  const [pets, setPets] = useState("No");
  const [access, setAccess] = useState<PrimeViewAccess>("Normal");
  const [condition, setCondition] = useState<PrimeViewCondition>("Normal");

  const [scope, setScope] = useState<NonNullable<PrimeViewPricingInput["cleaningScope"]>>("Outside only");
  const [standardWindows, setStandardWindows] = useState("");
  const [largeWindows, setLargeWindows] = useState("0");
  const [bayWindows, setBayWindows] = useState("0");
  const [hardAccessWindows, setHardAccessWindows] = useState("0");
  const [frequency, setFrequency] = useState<NonNullable<PrimeViewPricingInput["frequency"]>>("One-off");
  const [firstClean, setFirstClean] = useState(false);
  const [framesSills, setFramesSills] = useState("Yes");

  const [propertySize, setPropertySize] = useState<NonNullable<PrimeViewPricingInput["propertySize"]>>("Terraced house");
  const [heavyBlockage, setHeavyBlockage] = useState(false);
  const [conservatorySize, setConservatorySize] = useState<NonNullable<PrimeViewPricingInput["conservatorySize"]>>("Medium");
  const [solarPanels, setSolarPanels] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [heavyDirtMoss, setHeavyDirtMoss] = useState(false);
  const [oilTreatment, setOilTreatment] = useState(false);
  const [weedTreatment, setWeedTreatment] = useState(false);
  const [resanding, setResanding] = useState(false);
  const [sealing, setSealing] = useState(false);

  useEffect(() => {
    if (!UK_POSTCODE.test(postcode)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLookupLoading(true);
      setAddressLookupMessage("");
      try {
        const response = await fetch(`/api/primeview/address-lookup?postcode=${encodeURIComponent(postcode)}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({})) as { addresses?: unknown; error?: unknown };
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Address lookup is unavailable.");
        const nextAddresses = Array.isArray(data.addresses) ? data.addresses.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : [];
        setAddressSuggestions(nextAddresses);
        if (!nextAddresses.length) setAddressLookupMessage("No addresses were found. You can enter the address manually.");
      } catch (error) {
        if (controller.signal.aborted) return;
        setAddressSuggestions([]);
        setAddressLookupMessage(error instanceof Error ? error.message : "Address lookup is unavailable. Enter the address manually.");
      } finally {
        if (!controller.signal.aborted) setAddressLookupLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postcode]);

  const selectedService = services.find((service) => service.id === serviceId);
  const serviceKey = selectedService ? serviceKeyFromName(selectedService.name) : null;
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;

  const times = useMemo(() => {
    if (!selectedService || !date) return [];
    const hour = bookingHours.find((item) => item.weekday === weekdayForDate(date));
    if (!hour) return [];
    return getAvailableBookingTimes({ date, service: selectedService, hours: hour, busyBookings, referenceTimeMs: referenceTime, timeZone });
  }, [bookingHours, busyBookings, date, referenceTime, selectedService, timeZone]);

  const pricingInput = useMemo<PrimeViewPricingInput | null>(() => serviceKey ? ({
    serviceKey,
    access,
    condition,
    floorCount,
    workingHeight,
    windowAccess,
    cleaningScope: scope,
    standardWindows: Number(standardWindows),
    largeWindows: Number(largeWindows),
    bayWindows: Number(bayWindows),
    hardAccessWindows: Number(hardAccessWindows),
    frequency,
    firstClean,
    propertySize: serviceKey === "window" ? (propertyType === "Terraced" ? "Terraced house" : undefined) : propertySize,
    heavyBlockage,
    conservatorySize,
    solarPanels: Number(solarPanels),
    areaM2: Number(areaM2),
    heavyDirtMoss,
    oilTreatment,
    weedTreatment,
    resanding,
    sealing,
    multiServiceCount: 1,
  }) : null, [access, areaM2, bayWindows, condition, conservatorySize, firstClean, floorCount, frequency, hardAccessWindows, heavyBlockage, heavyDirtMoss, largeWindows, oilTreatment, propertySize, propertyType, resanding, scope, sealing, serviceKey, solarPanels, standardWindows, weedTreatment, windowAccess, workingHeight]);

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
      {serviceKey === "window" ? <input type="hidden" name="property_size" value={propertyType === "Terraced" ? "Terraced house" : ""} /> : null}
      <label className="absolute left-[-10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} /></label>

      <div className="grid gap-5">
        <section className={cardClass}>
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0b2a4a]">1. Choose a service</h2><p className="mt-1 text-sm leading-6 text-[#5d7187]">The price calculator changes automatically for each PrimeView service.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const active = service.id === serviceId;
              const description = serviceDescriptions[service.name.toLowerCase()] ?? "Professional exterior cleaning by PrimeView.";
              return <button key={service.id} type="button" onClick={() => chooseService(service.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#2f80ed] bg-[#eef6ff] ring-2 ring-[#2f80ed]/15" : "border-[#d9e4ef] bg-white hover:border-[#9fc1e8] hover:bg-[#f8fbff]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-[15px] text-[#0b2a4a]">{service.name}</strong>{active ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f80ed] text-white"><Check className="h-4 w-4" /></span> : null}</div><p className="mt-2 text-xs leading-5 text-[#667b91]">{description}</p></button>;
            })}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1769c2]"><Home className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0b2a4a]">2. Property & price details</h2><p className="mt-1 text-sm text-[#667b91]">Use real quantities where possible — the total updates instantly.</p></div></div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Property type<select name="property_type" required value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className={fieldClass}><option value="">Choose</option><option>Detached</option><option>Semi-detached</option><option>Terraced</option><option>End of terrace</option><option>Bungalow</option><option>Flat / Apartment</option><option>Commercial (Shop/Office)</option></select></label>
            <label className={labelClass}>Rear garden access<select name="rear_garden_access" required value={rearGardenAccess} onChange={(event) => setRearGardenAccess(event.target.value)} className={fieldClass}><option>Side access</option><option>Through the property only</option><option>No access / arrangement required</option></select></label>
            <label className={labelClass}>Number of floors<select name="floor_count" required value={floorCount} onChange={(event) => setFloorCount(event.target.value as typeof floorCount)} className={fieldClass}><option>1</option><option>2</option><option>3+</option><option>Unknown</option></select></label>
            <label className={labelClass}>Working height<select name="working_height" required value={workingHeight} onChange={(event) => setWorkingHeight(event.target.value as typeof workingHeight)} className={fieldClass}><option>Ground floor only</option><option>First floor</option><option>Second floor+</option><option>Long ladder required</option></select></label>
            <label className={labelClass}>Parking<select name="parking" required value={parking} onChange={(event) => setParking(event.target.value)} className={fieldClass}><option>Parking directly outside</option><option>Parking nearby</option><option>Difficult / paid parking</option></select></label>
            <label className={labelClass}>Pets at property<select name="pets" required value={pets} onChange={(event) => setPets(event.target.value)} className={fieldClass}><option>No</option><option>Yes</option></select></label>
            <label className={labelClass}>UK postcode<input name="postcode" required autoComplete="postal-code" placeholder="W4 3ES" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" value={postcode} onChange={(event) => { setPostcode(event.target.value.toUpperCase()); setAddress(""); setAddressSuggestions([]); setAddressLookupMessage(""); }} className={fieldClass} /></label>
            {UK_POSTCODE.test(postcode) ? <div className="sm:col-span-2 rounded-2xl border border-[#d9e4ef] bg-[#f9fbfe] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#183e63]"><MapPin className="h-4 w-4 text-[#1769c2]" />Find your address</div>
              {addressLookupLoading ? <p className="mt-2 flex items-center gap-2 text-sm text-[#667b91]"><Loader2 className="h-4 w-4 animate-spin" />Finding addresses for {postcode}…</p> : null}
              {!addressLookupLoading && addressSuggestions.length ? <select aria-label="Choose your address" value={address} onChange={(event) => setAddress(event.target.value)} className={`${fieldClass} mt-3`}><option value="">Choose your address</option>{addressSuggestions.map((item) => <option key={item} value={item}>{item}</option>)}</select> : null}
              {addressLookupMessage ? <p className="mt-2 text-xs font-semibold leading-5 text-[#667b91]">{addressLookupMessage}</p> : null}
              {!addressLookupLoading && addressSuggestions.length ? <p className="mt-2 text-xs text-[#667b91]">Select the property above, or type the address manually below.</p> : null}
            </div> : null}
            <label className={`${labelClass} sm:col-span-2`}>Full address<input name="address" required autoComplete="street-address" placeholder="House number and street" value={address} onChange={(event) => setAddress(event.target.value)} className={fieldClass} /></label>

            {serviceKey === "window" ? <>
              <label className={labelClass}>Standard windows<input name="standard_windows" required type="number" min="0" max="500" value={standardWindows} onChange={(event) => setStandardWindows(event.target.value)} placeholder="e.g. 10" className={fieldClass} /></label>
              <label className={labelClass}>Large windows<input name="large_windows" type="number" min="0" max="500" value={largeWindows} onChange={(event) => setLargeWindows(event.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Very large / bay windows<input name="bay_windows" type="number" min="0" max="500" value={bayWindows} onChange={(event) => setBayWindows(event.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Windows needing difficult access<input name="hard_access_windows" type="number" min="0" max="500" value={hardAccessWindows} onChange={(event) => setHardAccessWindows(event.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Cleaning required<select name="cleaning_scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className={fieldClass}><option>Outside only</option><option>Inside only</option><option>Inside & outside</option></select></label>
              <label className={labelClass}>Window access type<select name="window_access" required value={windowAccess} onChange={(event) => setWindowAccess(event.target.value as typeof windowAccess)} className={fieldClass}><option>Easy access</option><option>Hard access</option><option>Skylight / Roof windows</option></select></label>
              <label className={labelClass}>How often?<select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)} className={fieldClass}><option>One-off</option><option>Every 4 weeks</option><option>Every 6 weeks</option><option>Every 8 weeks</option></select></label>
              <label className={labelClass}>Frames & sills<select name="frames_sills" value={framesSills} onChange={(event) => setFramesSills(event.target.value)} className={fieldClass}><option>Yes</option><option>No</option></select></label>
              <div className="sm:col-span-2"><Checkbox name="first_clean" checked={firstClean} onChange={setFirstClean} label="First clean / unusually dirty first visit (+25% where applicable)" /></div>
            </> : null}

            {(serviceKey === "gutter" || serviceKey === "fascia") ? <>
              <label className={labelClass}>Property size<select name="property_size" value={propertySize} onChange={(event) => setPropertySize(event.target.value as typeof propertySize)} className={fieldClass}><option>Small property</option><option>Terraced house</option><option>Semi-detached house</option><option>Detached house</option><option>Large property</option></select></label>
              {serviceKey === "gutter" ? <div className="sm:col-span-2"><Checkbox name="heavy_blockage" checked={heavyBlockage} onChange={setHeavyBlockage} label="Heavy blockage (+20%)" /></div> : null}
            </> : null}

            {serviceKey === "conservatory" ? <label className={labelClass}>Conservatory roof size<select name="conservatory_size" value={conservatorySize} onChange={(event) => setConservatorySize(event.target.value as typeof conservatorySize)} className={fieldClass}><option>Small</option><option>Medium</option><option>Large</option></select></label> : null}

            {serviceKey === "solar" ? <label className={labelClass}>Number of solar panels<input name="solar_panels" required type="number" min="1" max="500" value={solarPanels} onChange={(event) => setSolarPanels(event.target.value)} placeholder="e.g. 12" className={fieldClass} /></label> : null}

            {serviceKey === "patio" ? <>
              <label className={labelClass}>Area in m²<input name="area_m2" required type="number" min="1" step="0.5" value={areaM2} onChange={(event) => setAreaM2(event.target.value)} placeholder="e.g. 35" className={fieldClass} /></label>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><Checkbox name="heavy_dirt_moss" checked={heavyDirtMoss} onChange={setHeavyDirtMoss} label="Heavy dirt / moss (£11/m²)" /><Checkbox name="oil_treatment" checked={oilTreatment} onChange={setOilTreatment} label="Oil / stain treatment (+£3/m²)" /><Checkbox name="weed_treatment" checked={weedTreatment} onChange={setWeedTreatment} label="Weed treatment (+£2/m²)" /><Checkbox name="resanding" checked={resanding} onChange={setResanding} label="Re-sanding (+£4/m²)" /><Checkbox name="sealing" checked={sealing} onChange={setSealing} label="Sealing (manual quote)" /></div>
            </> : null}

            <label className={labelClass}>Overall property access<select name="access" value={access} onChange={(event) => setAccess(event.target.value as PrimeViewAccess)} className={fieldClass}><option>Normal</option><option>Moderately difficult</option><option>Difficult</option><option>Very difficult</option></select></label>
            {serviceKey !== "patio" ? <label className={labelClass}>Property condition<select name="condition" value={condition} onChange={(event) => setCondition(event.target.value as PrimeViewCondition)} className={fieldClass}><option>Normal</option><option>Dirty</option><option>Very dirty</option><option>Extreme</option></select></label> : <input type="hidden" name="condition" value="Normal" />}

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
            {!price ? <><p className="text-2xl font-black">Choose a service</p><p className="mt-3 text-sm text-[#d3e2f2]">The pricing rules will appear here.</p></> : price.kind === "manual" ? <><p className="text-2xl font-black">Manual quote</p><p className="mt-3 text-sm leading-6 text-[#d3e2f2]">{price.reason}</p><p className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#dbeafe]">{price.note}</p></> : <><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9caee]">Estimated price</p><p className="mt-2 text-5xl font-black tracking-tight">£{price.total.toFixed(2)}</p>{price.minimumApplied ? <p className="mt-2 inline-flex rounded-full bg-[#1e5c91] px-3 py-1 text-xs font-black">Minimum charge applied</p> : null}<div className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-xs text-[#d3e2f2]">{price.lines.map((line, index) => <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-3"><span>{line.label}</span><strong className={line.amount < 0 ? "text-[#8fe3b5]" : "text-white"}>{line.amount < 0 ? "−" : "+"}£{Math.abs(line.amount).toFixed(2)}</strong></div>)}</div><p className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#dbeafe]">{price.note}</p></>}
          </div>
          <div className="border-t border-white/10 bg-[#09243f] p-5 text-xs leading-5 text-[#c8d9eb]"><p><strong>Minimums:</strong> Windows £30 for Terraced · £40 other properties · Gutter £75 · Fascia £80 · Conservatory £90 · Solar £60 · Patio/Driveway £180.</p><p className="mt-2">Recurring window discounts are applied before the minimum charge. Very difficult access, extreme condition, sealing and 30+ solar panels require manual review.</p></div>
        </section>

        <section className="rounded-3xl border border-[#d9e4ef] bg-white p-5 shadow-[0_12px_36px_rgba(11,42,74,.06)]"><h3 className="font-black text-[#0b2a4a]">Booking summary</h3><div className="mt-4 grid gap-3 text-sm"><div className="flex gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Service</p><p className="mt-1 font-bold text-[#183e63]">{selectedService?.name ?? "—"}</p></div></div><div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Area</p><p className="mt-1 font-bold text-[#183e63]">West & North London</p></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#2f80ed]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7990a6]">Preferred visit</p><p className="mt-1 font-bold text-[#183e63]">{date}{time ? ` · ${time}` : ""}</p></div></div></div></section>
      </aside>
    </form>
  );
}
