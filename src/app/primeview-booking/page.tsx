import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarCheck2, CheckCircle2, MapPin, Phone, ShieldCheck } from "lucide-react";

import { calculatePrimeViewPrice, pricingResultSummary, serviceKeyFromName, type PrimeViewPricingInput } from "@/features/primeview/pricing";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

import { PrimeViewPrecisionBookingForm } from "./primeview-precision-booking-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Online | PrimeView Window Care",
  description: "Book window, gutter, pressure washing and exterior cleaning with PrimeView Window Care in West & North London.",
  alternates: { canonical: "https://www.primeviewwindowcare.co.uk/booking" },
  robots: { index: true, follow: true },
};

const SLUG = "primeview";
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROPERTY_TYPES = ["Detached", "Semi-detached", "Terraced", "End of terrace", "Bungalow", "Flat / Apartment", "Commercial (Shop/Office)"] as const;
const REAR_ACCESS = ["Side access", "Through the property only", "No access / arrangement required"] as const;
const FLOOR_COUNTS = ["1", "2", "3+", "Unknown"] as const;
const WORKING_HEIGHTS = ["Ground floor only", "First floor", "Second floor+", "Long ladder required"] as const;
const PARKING_OPTIONS = ["Parking directly outside", "Parking nearby", "Difficult / paid parking"] as const;
const PET_OPTIONS = ["Yes", "No"] as const;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function text(formData: FormData, key: string, max = 1200) { return String(formData.get(key) ?? "").trim().slice(0, max); }
function numberField(formData: FormData, key: string) { const raw = text(formData, key, 20); return raw ? Number(raw) : 0; }
function checked(formData: FormData, key: string) { return formData.get(key) === "on" || formData.get(key) === "true" || formData.get(key) === "Yes"; }
function bookingUrl(params: string) { return `/booking?${params}`; }

function pricingInputFromForm(serviceName: string, formData: FormData): PrimeViewPricingInput | null {
  const serviceKey = serviceKeyFromName(serviceName);
  if (!serviceKey) return null;
  const floorCount = text(formData, "floor_count", 20) as PrimeViewPricingInput["floorCount"];
  return {
    serviceKey,
    access: text(formData, "access", 40) as PrimeViewPricingInput["access"],
    condition: text(formData, "condition", 40) as PrimeViewPricingInput["condition"],
    floors: floorCount === "3+" ? "3rd floor or higher" : floorCount === "2" ? "Ground + 1st floor" : floorCount === "1" ? "Ground floor only" : undefined,
    floorCount,
    workingHeight: text(formData, "working_height", 60) as PrimeViewPricingInput["workingHeight"],
    windowAccess: text(formData, "window_access", 60) as PrimeViewPricingInput["windowAccess"],
    cleaningScope: text(formData, "cleaning_scope", 40) as PrimeViewPricingInput["cleaningScope"],
    standardWindows: numberField(formData, "standard_windows"),
    largeWindows: numberField(formData, "large_windows"),
    bayWindows: numberField(formData, "bay_windows"),
    hardAccessWindows: numberField(formData, "hard_access_windows"),
    frequency: text(formData, "frequency", 40) as PrimeViewPricingInput["frequency"],
    firstClean: checked(formData, "first_clean"),
    propertySize: text(formData, "property_size", 60) as PrimeViewPricingInput["propertySize"],
    heavyBlockage: checked(formData, "heavy_blockage"),
    conservatorySize: text(formData, "conservatory_size", 30) as PrimeViewPricingInput["conservatorySize"],
    solarPanels: numberField(formData, "solar_panels"),
    areaM2: numberField(formData, "area_m2"),
    heavyDirtMoss: checked(formData, "heavy_dirt_moss"),
    oilTreatment: checked(formData, "oil_treatment"),
    weedTreatment: checked(formData, "weed_treatment"),
    resanding: checked(formData, "resanding"),
    sealing: checked(formData, "sealing"),
    multiServiceCount: 1,
  };
}

async function requestPrimeViewBooking(formData: FormData) {
  "use server";

  const name = text(formData, "name", 160);
  const email = text(formData, "email", 240).toLowerCase();
  const phone = text(formData, "phone", 80);
  const serviceId = text(formData, "service_id", 80);
  const startsAt = text(formData, "starts_at", 80);
  const website = text(formData, "website", 200);
  const formStartedAt = Number(formData.get("form_started_at"));
  const propertyType = text(formData, "property_type", 80);
  const rearGardenAccess = text(formData, "rear_garden_access", 80);
  const floorCount = text(formData, "floor_count", 20);
  const workingHeight = text(formData, "working_height", 80);
  const parking = text(formData, "parking", 80);
  const windowAccess = text(formData, "window_access", 80);
  const pets = text(formData, "pets", 20);
  const address = text(formData, "address", 300);
  const postcode = text(formData, "postcode", 20).toUpperCase();
  const framesSills = text(formData, "frames_sills", 20);
  const arrivalNotes = text(formData, "arrival_notes", 1200);
  const photoSession = text(formData, "photo_session", 80);
  const photoPaths = formData.getAll("photo_path").map((value) => String(value).trim()).filter(Boolean);

  if (website) redirect(bookingUrl("booked=1"));
  const elapsed = Date.now() - formStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) redirect(bookingUrl("error=rate_limit"));
  if (!name || !email || !phone || !serviceId || !startsAt || !propertyType || !rearGardenAccess || !floorCount || !workingHeight || !parking || !pets || !address || !postcode || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9a-f-]{36}$/i.test(serviceId)) redirect(bookingUrl("error=invalid"));
  if (!PROPERTY_TYPES.includes(propertyType as (typeof PROPERTY_TYPES)[number]) || !REAR_ACCESS.includes(rearGardenAccess as (typeof REAR_ACCESS)[number]) || !FLOOR_COUNTS.includes(floorCount as (typeof FLOOR_COUNTS)[number]) || !WORKING_HEIGHTS.includes(workingHeight as (typeof WORKING_HEIGHTS)[number]) || !PARKING_OPTIONS.includes(parking as (typeof PARKING_OPTIONS)[number]) || !PET_OPTIONS.includes(pets as (typeof PET_OPTIONS)[number])) redirect(bookingUrl("error=invalid"));
  if (photoPaths.length > 5 || (photoPaths.length > 0 && (!UUID.test(photoSession) || photoPaths.some((pathname) => !pathname.startsWith(`primeview-booking/${photoSession}/`) || pathname.includes("..") || pathname.length > 800)))) redirect(bookingUrl("error=invalid"));
  if (!UK_POSTCODE.test(postcode)) redirect(bookingUrl("error=postcode"));

  const sql = getSql();
  if (!sql) redirect(bookingUrl("error=unavailable"));

  const workspaces = await sql`
    select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.primary_city, ''), w.primary_city, 'London') as primary_city,
      nullif(ws.contact_email, '') as contact_email, nullif(ws.contact_phone, '') as contact_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/London') as time_zone
    from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${SLUG} and w.status in ('active', 'trial') limit 1
  `;
  const workspace = workspaces[0];
  if (!workspace || !(await hasWorkspaceFeatureAccessForWorkspace(String(workspace.id), "online_booking"))) redirect(bookingUrl("error=unavailable"));

  const allowed = await allowPublicSubmission({ scope: "public_booking_verification", requestHeaders: await headers(), identity: `${SLUG}:${email}`, maxAttempts: 5, windowSeconds: 15 * 60 });
  if (!allowed) redirect(bookingUrl("error=rate_limit"));

  const serviceRows = await sql`
    select id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days
    from workspace_services where workspace_id = ${String(workspace.id)} and id = ${serviceId}::uuid and is_active = true limit 1
  `;
  const service = serviceRows[0];
  if (!service) redirect(bookingUrl("error=service"));
  const serviceName = String(service.name);
  const pricingInput = pricingInputFromForm(serviceName, formData);
  if (!pricingInput) redirect(bookingUrl("error=service"));

  const key = pricingInput.serviceKey;
  if (!pricingInput.access || (key !== "patio" && !pricingInput.condition)) redirect(bookingUrl("error=invalid"));
  if (key === "window") {
  if (!pricingInput.standardWindows || pricingInput.standardWindows < 1) redirect(bookingUrl("error=invalid"));
}
  if ((key === "gutter" || key === "fascia" || key === "fascia_gutter" || key === "package") && !pricingInput.propertySize) redirect(bookingUrl("error=invalid"));
  if (key === "solar" && (!pricingInput.solarPanels || pricingInput.solarPanels < 1)) redirect(bookingUrl("error=invalid"));
  if ((key === "patio" || key === "package") && (!pricingInput.areaM2 || pricingInput.areaM2 <= 0)) redirect(bookingUrl("error=invalid"));

  const price = calculatePrimeViewPrice(pricingInput);

  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) redirect(bookingUrl("error=time"));
  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  const hourRows = await sql`select opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${String(workspace.id)} and weekday = ${weekday} limit 1`;
  const bookingHour = hourRows[0];
  const timeZone = resolveBookingTimeZone(workspace.time_zone);
  const validation = validatePublicBookingPolicy({
    startsAt,
    now: new Date(),
    service: {
      durationMinutes: Math.min(1440, Math.max(1, Number(service.duration_minutes) || 60)),
      bufferBeforeMinutes: Math.max(0, Number(service.buffer_before_minutes) || 0),
      bufferAfterMinutes: Math.max(0, Number(service.buffer_after_minutes) || 0),
      minimumNoticeMinutes: Math.max(0, Number(service.minimum_notice_minutes) || 0),
      maximumAdvanceDays: Math.max(1, Number(service.maximum_advance_days) || 365),
    },
    bookingHour: bookingHour ? { opensAt: String(bookingHour.opens_at), closesAt: String(bookingHour.closes_at), isClosed: Boolean(bookingHour.is_closed) } : null,
    timeZone,
  });
  if (validation.error) redirect(bookingUrl(`error=${validation.error}`));
  const { start, end } = validation;

  const conflict = await sql`
    select id from bookings where workspace_id = ${String(workspace.id)} and status not in ('cancelled', 'no_show')
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    union all
    select id from public_booking_verifications where workspace_id = ${String(workspace.id)}::uuid and consumed_at is null and expires_at > now()
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1
  `;
  if (conflict[0]) redirect(bookingUrl("error=conflict"));

  const detailLines = [
    `Property type: ${propertyType}`,
    `Rear garden access: ${rearGardenAccess}`,
    `Number of floors: ${floorCount}`,
    `Working height: ${workingHeight}`,
    `Parking: ${parking}`,
    `Pets at property: ${pets}`,
    `Address: ${address}`,
    `Postcode: ${postcode}`,
    `Pricing: ${pricingResultSummary(price)}`,
  ];
  if (framesSills) detailLines.push(`Frames & sills: ${framesSills}`);
  if (windowAccess) detailLines.push(`Window access: ${windowAccess}`);
  for (const pathname of photoPaths) detailLines.push(`Photo: ${pathname}`);
  if (arrivalNotes) detailLines.push(`Arrival notes: ${arrivalNotes}`);

  const fieldSummary = [
    pricingInput.cleaningScope && `Cleaning: ${pricingInput.cleaningScope}`,
    pricingInput.standardWindows ? `Standard windows: ${pricingInput.standardWindows}` : "",
    pricingInput.largeWindows ? `Large windows: ${pricingInput.largeWindows}` : "",
    pricingInput.bayWindows ? `Very large / bay windows: ${pricingInput.bayWindows}` : "",
    pricingInput.hardAccessWindows ? `Hard-access windows: ${pricingInput.hardAccessWindows}` : "",
    pricingInput.frequency && `Frequency: ${pricingInput.frequency}`,
    pricingInput.firstClean ? "First clean: Yes" : "",
    pricingInput.propertySize && `Property size: ${pricingInput.propertySize}`,
    pricingInput.heavyBlockage ? "Heavy blockage: Yes" : "",
    pricingInput.conservatorySize && `Conservatory size: ${pricingInput.conservatorySize}`,
    pricingInput.solarPanels ? `Solar panels: ${pricingInput.solarPanels}` : "",
    pricingInput.areaM2 ? `Area: ${pricingInput.areaM2} m²` : "",
    pricingInput.heavyDirtMoss ? "Heavy dirt / moss: Yes" : "",
    pricingInput.oilTreatment ? "Oil / stain treatment: Yes" : "",
    pricingInput.weedTreatment ? "Weed treatment: Yes" : "",
    pricingInput.resanding ? "Re-sanding: Yes" : "",
    pricingInput.sealing ? "Sealing requested: Yes" : "",
    pricingInput.access && `Access: ${pricingInput.access}`,
    pricingInput.condition && `Condition: ${pricingInput.condition}`,
  ].filter((value): value is string => Boolean(value));
  detailLines.push(...fieldSummary);

  const result = await beginBookingEmailVerification({
    workspaceId: String(workspace.id), slug: SLUG, companyName: String(workspace.company_name),
    ownerEmail: workspace.contact_email ? String(workspace.contact_email) : undefined,
    ownerPhone: workspace.contact_phone ? String(workspace.contact_phone) : undefined,
    customerName: name, customerEmail: email, customerPhone: phone, serviceId, serviceName,
    city: String(workspace.primary_city ?? "London"), address, postcode, bookingDetails: detailLines.join("\n"),
    startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone, language: "en", verificationSms: true,
  });
  if (!result.ok) redirect(bookingUrl(`error=${result.error === "email" ? "email" : result.error === "service" ? "service" : "conflict"}`));
  redirect(`/boka/verifiera/${result.verificationId}?lang=en&channel=${encodeURIComponent(result.delivery)}`);
}

type PageProps = { searchParams?: Promise<{ error?: string | string[]; booked?: string | string[]; service_id?: string | string[] }> };

const errors: Record<string, string> = {
  invalid: "Please complete all required booking and pricing fields.",
  postcode: "Enter a valid UK postcode, for example W4 3ES.",
  unavailable: "Online booking is temporarily unavailable.",
  service: "That service is no longer available.",
  time: "Choose a valid future booking time.",
  notice: "That time is too close. Choose a later slot.",
  advance: "That date is too far ahead.",
  hours: "That time is outside PrimeView's booking hours.",
  hours_missing: "No booking hours are available for that day.",
  conflict: "That slot has just been booked or reserved. Please choose another time.",
  rate_limit: "Too many attempts. Please wait a moment and try again.",
  email: "The verification email could not be sent. Check the email address and try again.",
};

export default async function PrimeViewBookingPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : undefined;
  const booked = first(query?.booked) === "1";
  const error = errors[first(query?.error) ?? ""];
  const requestedServiceId = first(query?.service_id) ?? "";
  const sql = getSql();
  if (!sql) return <Unavailable />;

  const workspaceRows = await sql`
    select w.id, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(nullif(ws.time_zone, ''), 'Europe/London') as time_zone,
      nullif(ws.contact_phone, '') as contact_phone
    from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text
    where w.public_booking_slug = ${SLUG} and w.status in ('active', 'trial') limit 1
  `;
  const workspace = workspaceRows[0];
  if (!workspace || !(await hasWorkspaceFeatureAccessForWorkspace(String(workspace.id), "online_booking"))) return <Unavailable />;
  const workspaceId = String(workspace.id);

  const [services, bookingHours, busyBookings] = await Promise.all([
    sql`select id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, maximum_advance_days from workspace_services where workspace_id = ${workspaceId} and is_active = true order by sort_order asc, name asc`,
    sql`select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${workspaceId} order by weekday asc`,
    sql`select starts_at, ends_at from bookings where workspace_id = ${workspaceId} and status not in ('cancelled', 'no_show') and starts_at >= now() - interval '1 day' union all select starts_at, ends_at from public_booking_verifications where workspace_id = ${workspaceId}::uuid and consumed_at is null and expires_at > now()`,
  ]);

  const initialServiceId = /^[0-9a-f-]{36}$/i.test(requestedServiceId) && services.some((service) => String(service.id) === requestedServiceId) ? requestedServiceId : "";
  const timeZone = resolveBookingTimeZone(workspace.time_zone);

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#071b42]">
      <header className="border-b border-white/10 bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-black">
            <Image src="/brand/primeview-window-care-logo.jpeg" alt="PrimeView Window Care" width={64} height={64} className="h-14 w-14 rounded-xl object-cover" />
            <span className="hidden sm:inline">PrimeView Window Care</span>
          </Link>
          <div className="flex items-center gap-2">
            {workspace.contact_phone ? <a href={`tel:${String(workspace.contact_phone)}`} className="hidden rounded-xl border border-white/25 px-4 py-3 text-sm font-bold sm:inline-flex"><Phone className="mr-2 h-4 w-4" />{String(workspace.contact_phone)}</a> : null}
            <Link href="/" className="whitespace-nowrap rounded-xl bg-[#1769c2] px-4 py-3 text-sm font-black text-white ring-1 ring-white/25 transition hover:bg-[#2f80ed]">Back to website</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#06183b] px-5 py-12 text-white lg:px-8 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(47,128,237,.42),transparent_28%),linear-gradient(135deg,#020d26_0%,#061b45_60%,#0b2d6d_100%)]" />
        <div className="relative mx-auto max-w-[1280px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.14em] text-[#dbeafe]"><ShieldCheck className="h-4 w-4" /> Live price calculator</div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-5xl">Book online with a price that updates as you describe the job.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">Property type, window quantities, height, access and service-specific extras are included. Gutter and Pressure Washing stay separate unless you choose the discounted package.</p>
          <div className="mt-7 flex flex-wrap gap-4 text-sm font-bold text-[#dbeafe]"><span className="flex items-center gap-2"><MapPin className="h-4 w-4" />West & North London</span><span className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4" />Preferred time, confirmed after review</span></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-5 lg:px-8 lg:py-12">
        {booked ? <section className="mx-auto max-w-2xl rounded-3xl border border-[#cfe4d2] bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-12 w-12 text-[#1f7a45]" /><h2 className="mt-4 text-2xl font-black">Booking request received</h2><p className="mt-3 leading-7 text-slate-600">Your email is verified. PrimeView will review the property details, calculated estimate and preferred time, then confirm the job.</p><Link href="/booking" className="mt-6 inline-flex rounded-xl bg-[#0a3c8f] px-5 py-3 font-black text-white">Make another booking</Link></section> : <>{error ? <p role="alert" className="mb-6 rounded-2xl border border-[#f0c9c3] bg-[#fff4f2] p-4 font-bold text-[#9a2f23]">{error}</p> : null}<PrimeViewPrecisionBookingForm
          action={requestPrimeViewBooking}
          services={services.map((service) => ({ id: String(service.id), name: String(service.name), durationMinutes: Number(service.duration_minutes) || 60, bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0, bufferAfterMinutes: Number(service.buffer_after_minutes) || 0, minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0, maximumAdvanceDays: Number(service.maximum_advance_days) || 365 }))}
          bookingHours={bookingHours.map((hour) => ({ weekday: Number(hour.weekday), opensAt: String(hour.opens_at).slice(0, 5), closesAt: String(hour.closes_at).slice(0, 5), isClosed: Boolean(hour.is_closed) }))}
          busyBookings={busyBookings.map((booking) => ({ startsAt: new Date(booking.starts_at as Date).toISOString(), endsAt: new Date(booking.ends_at as Date).toISOString(), bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }))}
          timeZone={timeZone}
          initialServiceId={initialServiceId}
        /></>}
      </div>
    </main>
  );
}

function Unavailable() {
  return <main className="min-h-screen bg-[#f4f6fb] px-5 py-20"><section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black text-[#071b42]">Booking is temporarily unavailable</h1><p className="mt-3 text-slate-600">Please contact PrimeView directly and try again later.</p></section></main>;
}
