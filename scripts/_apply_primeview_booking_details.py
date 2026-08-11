from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Pricing engine: add explicit property context and the updated window rates.
pricing = "src/features/primeview/pricing.ts"
replace_once(
    pricing,
    '  floors?: "Ground floor only" | "Ground + 1st floor" | "Ground + 2 floors" | "3rd floor or higher";\n\n  cleaningScope?:',
    '  floors?: "Ground floor only" | "Ground + 1st floor" | "Ground + 2 floors" | "3rd floor or higher";\n'
    '  floorCount?: "1" | "2" | "3+" | "Unknown";\n'
    '  workingHeight?: "Ground floor only" | "First floor" | "Second floor+" | "Long ladder required";\n'
    '  windowAccess?: "Easy access" | "Hard access" | "Skylight / Roof windows";\n\n'
    '  cleaningScope?:',
)
replace_once(
    pricing,
    '    const insideOnly = input.cleaningScope === "Inside only";\n    const both = input.cleaningScope === "Inside & outside";\n    const lines: PrimeViewPricingLine[] = [];\n    const standardRate = insideOnly ? 2 : both ? 6 : 4;\n    const largeRate = insideOnly ? 2 : both ? 8 : 6;\n    const bayRate = insideOnly ? 2 : both ? 10 : 8;',
    '    const both = input.cleaningScope === "Inside & outside";\n    const lines: PrimeViewPricingLine[] = [];\n    const standardRate = both ? 5.5 : 3;\n    const largeRate = both ? 7.5 : 5;\n    const bayRate = both ? 9.5 : 7;',
)
replace_once(
    pricing,
    '    if (input.floors === "3rd floor or higher") {\n      const line = pctLine("3rd floor or higher +25%", subtotal, 0.25);',
    '    if (input.floorCount === "3+" || input.floors === "3rd floor or higher") {\n      const line = pctLine("3+ floors / 3rd floor or higher +25%", subtotal, 0.25);',
)
replace_once(
    pricing,
    '      estimated: (large + bay > 0 && input.cleaningScope !== "Outside only") || input.access === "Difficult",',
    '      estimated: (large + bay > 0 && input.cleaningScope !== "Outside only")\n'
    '        || input.access === "Difficult"\n'
    '        || input.floorCount === "Unknown"\n'
    '        || input.workingHeight === "Long ladder required"\n'
    '        || (input.windowAccess !== undefined && input.windowAccess !== "Easy access"),',
)
replace_once(
    pricing,
    '    const difficultSpecific = input.floors === "3rd floor or higher" || input.access === "Difficult";',
    '    const difficultSpecific = input.floorCount === "3+" || input.floors === "3rd floor or higher" || input.access === "Difficult";',
)

# Customer booking form: richer job context and secure direct-to-Blob photo upload.
form = "src/app/primeview-booking/primeview-precision-booking-form.tsx"
replace_once(form, 'import { useMemo, useState } from "react";', 'import { useMemo, useState, type ChangeEvent } from "react";')
replace_once(form, 'import { useSearchParams } from "next/navigation";', 'import { useSearchParams } from "next/navigation";\nimport { upload } from "@vercel/blob/client";')
replace_once(
    form,
    'import { CalendarDays, Check, ChevronRight, CirclePoundSterling, Home, Mail, MapPin, Sparkles } from "lucide-react";',
    'import { CalendarDays, Camera, Check, ChevronRight, CirclePoundSterling, Home, Loader2, Mail, MapPin, Sparkles } from "lucide-react";',
)
replace_once(
    form,
    '  const [propertyType, setPropertyType] = useState("");\n  const [access, setAccess] = useState<PrimeViewAccess>("Normal");\n  const [condition, setCondition] = useState<PrimeViewCondition>("Normal");\n  const [floors, setFloors] = useState<NonNullable<PrimeViewPricingInput["floors"]>>("Ground floor only");',
    '  const [propertyType, setPropertyType] = useState("");\n'
    '  const [rearGardenAccess, setRearGardenAccess] = useState("Side access");\n'
    '  const [floorCount, setFloorCount] = useState<NonNullable<PrimeViewPricingInput["floorCount"]>>("2");\n'
    '  const [workingHeight, setWorkingHeight] = useState<NonNullable<PrimeViewPricingInput["workingHeight"]>>("First floor");\n'
    '  const [parking, setParking] = useState("Parking directly outside");\n'
    '  const [windowAccess, setWindowAccess] = useState<NonNullable<PrimeViewPricingInput["windowAccess"]>>("Easy access");\n'
    '  const [pets, setPets] = useState("No");\n'
    '  const [photoSession] = useState(() => crypto.randomUUID());\n'
    '  const [photoPaths, setPhotoPaths] = useState<string[]>([]);\n'
    '  const [photoUploading, setPhotoUploading] = useState(false);\n'
    '  const [photoMessage, setPhotoMessage] = useState("");\n'
    '  const [access, setAccess] = useState<PrimeViewAccess>("Normal");\n'
    '  const [condition, setCondition] = useState<PrimeViewCondition>("Normal");',
)
replace_once(
    form,
    '    floors,\n    cleaningScope: scope,',
    '    floorCount,\n    workingHeight,\n    windowAccess,\n    cleaningScope: scope,',
)
replace_once(
    form,
    '  }) : null, [access, areaM2, bayWindows, condition, conservatorySize, firstClean, floors, frequency, hardAccessWindows, heavyBlockage, heavyDirtMoss, largeWindows, oilTreatment, propertySize, resanding, scope, sealing, serviceKey, solarPanels, standardWindows, weedTreatment]);',
    '  }) : null, [access, areaM2, bayWindows, condition, conservatorySize, firstClean, floorCount, frequency, hardAccessWindows, heavyBlockage, heavyDirtMoss, largeWindows, oilTreatment, propertySize, resanding, scope, sealing, serviceKey, solarPanels, standardWindows, weedTreatment, windowAccess, workingHeight]);',
)
replace_once(
    form,
    '  function chooseService(id: string) {',
    '''  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const remaining = 5 - photoPaths.length;
    if (remaining <= 0) {
      setPhotoMessage("You can upload a maximum of 5 photos.");
      return;
    }

    const files = selectedFiles.slice(0, remaining);
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setPhotoMessage("Use JPG, PNG or WebP images up to 5 MB each.");
      return;
    }

    setPhotoUploading(true);
    setPhotoMessage("");
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "property-photo.jpg";
        const blob = await upload(`primeview-booking/${photoSession}/${safeName}`, file, {
          access: "private",
          handleUploadUrl: "/api/primeview/booking-photo/upload",
          clientPayload: JSON.stringify({ sessionId: photoSession }),
        });
        setPhotoPaths((current) => current.includes(blob.pathname) ? current : [...current, blob.pathname]);
      }
      setPhotoMessage(selectedFiles.length > remaining ? `Uploaded ${remaining} photo${remaining === 1 ? "" : "s"}. Maximum 5 photos.` : "Photos uploaded securely.");
    } catch (error) {
      console.error("PrimeView booking photo upload failed", error);
      setPhotoMessage("Photo upload failed. You can still continue the booking without photos.");
    } finally {
      setPhotoUploading(false);
    }
  }

  function chooseService(id: string) {''',
)
replace_once(
    form,
    '<label className={labelClass}>Property type<select name="property_type" required value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className={fieldClass}><option value="">Choose</option><option>House</option><option>Flat</option><option>Commercial</option></select></label>\n            <label className={labelClass}>UK postcode',
    '<label className={labelClass}>Property type<select name="property_type" required value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className={fieldClass}><option value="">Choose</option><option>Detached</option><option>Semi-detached</option><option>Terraced</option><option>End of terrace</option><option>Bungalow</option><option>Flat / Apartment</option><option>Commercial (Shop/Office)</option></select></label>\n'
    '            <label className={labelClass}>Rear garden access<select name="rear_garden_access" required value={rearGardenAccess} onChange={(event) => setRearGardenAccess(event.target.value)} className={fieldClass}><option>Side access</option><option>Through the property only</option><option>No access / arrangement required</option></select></label>\n'
    '            <label className={labelClass}>Number of floors<select name="floor_count" required value={floorCount} onChange={(event) => setFloorCount(event.target.value as typeof floorCount)} className={fieldClass}><option>1</option><option>2</option><option>3+</option><option>Unknown</option></select></label>\n'
    '            <label className={labelClass}>Working height<select name="working_height" required value={workingHeight} onChange={(event) => setWorkingHeight(event.target.value as typeof workingHeight)} className={fieldClass}><option>Ground floor only</option><option>First floor</option><option>Second floor+</option><option>Long ladder required</option></select></label>\n'
    '            <label className={labelClass}>Parking<select name="parking" required value={parking} onChange={(event) => setParking(event.target.value)} className={fieldClass}><option>Parking directly outside</option><option>Parking nearby</option><option>Difficult / paid parking</option></select></label>\n'
    '            <label className={labelClass}>Pets at property<select name="pets" required value={pets} onChange={(event) => setPets(event.target.value)} className={fieldClass}><option>No</option><option>Yes</option></select></label>\n'
    '            <label className={labelClass}>UK postcode',
)
replace_once(
    form,
    '              <label className={labelClass}>Number of floors<select name="floors" value={floors} onChange={(event) => setFloors(event.target.value as typeof floors)} className={fieldClass}><option>Ground floor only</option><option>Ground + 1st floor</option><option>Ground + 2 floors</option><option>3rd floor or higher</option></select></label>\n',
    '              <label className={labelClass}>Window access<select name="window_access" required value={windowAccess} onChange={(event) => setWindowAccess(event.target.value as typeof windowAccess)} className={fieldClass}><option>Easy access</option><option>Hard access</option><option>Skylight / Roof windows</option></select></label>\n',
)
replace_once(
    form,
    '              {serviceKey === "gutter" ? <label className={labelClass}>Height<select name="floors" value={floors} onChange={(event) => setFloors(event.target.value as typeof floors)} className={fieldClass}><option>Ground floor only</option><option>Ground + 1st floor</option><option>Ground + 2 floors</option><option>3rd floor or higher</option></select></label> : null}\n',
    '',
)
replace_once(
    form,
    '            <label className={`${labelClass} sm:col-span-2`}>Additional details<textarea name="additional_notes" rows={3} maxLength={1200} placeholder="Parking, gate access, unusual surfaces, special equipment or anything else we should know" className={fieldClass} /></label>',
    '''            <div className="sm:col-span-2 rounded-2xl border border-[#d9e4ef] bg-[#f9fbfe] p-4">
              <div className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 shrink-0 text-[#1769c2]" /><div><p className="text-sm font-black text-[#183e63]">Property photos (optional)</p><p className="mt-1 text-xs leading-5 text-[#667b91]">Upload up to 5 photos. 3–5 clear photos are ideal for confirming access and the final price.</p></div></div>
              <input type="hidden" name="photo_session" value={photoSession} />
              {photoPaths.map((pathname) => <input key={pathname} type="hidden" name="photo_path" value={pathname} />)}
              <label className={`mt-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fb9d6] bg-white px-4 py-3 text-sm font-black text-[#1769c2] ${photoUploading || photoPaths.length >= 5 ? "pointer-events-none opacity-55" : ""}`}>
                {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{photoUploading ? "Uploading photos…" : photoPaths.length ? `Add more photos (${photoPaths.length}/5)` : "Choose photos"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelection} disabled={photoUploading || photoPaths.length >= 5} className="sr-only" />
              </label>
              {photoMessage ? <p className="mt-2 text-xs font-semibold text-[#5d7187]">{photoMessage}</p> : null}
            </div>
            <label className={`${labelClass} sm:col-span-2`}>Anything we should know before arriving?<textarea name="arrival_notes" rows={3} maxLength={1200} placeholder="Dog in the property, locked gate, no side access, fragile plants, or anything else we should know" className={fieldClass} /></label>''',
)
replace_once(
    form,
    '<button disabled={!selectedService || !time} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0a3c8f]',
    '<button disabled={!selectedService || !time || photoUploading} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0a3c8f]',
)

# Server action: validate and persist every new field plus secure photo path references.
page = "src/app/primeview-booking/page.tsx"
replace_once(
    page,
    'const UK_POSTCODE = /^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$/i;\n',
    'const UK_POSTCODE = /^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$/i;\n'
    'const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n'
    'const PROPERTY_TYPES = ["Detached", "Semi-detached", "Terraced", "End of terrace", "Bungalow", "Flat / Apartment", "Commercial (Shop/Office)"] as const;\n'
    'const REAR_ACCESS = ["Side access", "Through the property only", "No access / arrangement required"] as const;\n'
    'const FLOOR_COUNTS = ["1", "2", "3+", "Unknown"] as const;\n'
    'const WORKING_HEIGHTS = ["Ground floor only", "First floor", "Second floor+", "Long ladder required"] as const;\n'
    'const PARKING_OPTIONS = ["Parking directly outside", "Parking nearby", "Difficult / paid parking"] as const;\n'
    'const WINDOW_ACCESS_OPTIONS = ["Easy access", "Hard access", "Skylight / Roof windows"] as const;\n'
    'const PET_OPTIONS = ["Yes", "No"] as const;\n',
)
replace_once(
    page,
    '  return {\n    serviceKey,\n    access:',
    '  const floorCount = text(formData, "floor_count", 20) as PrimeViewPricingInput["floorCount"];\n  return {\n    serviceKey,\n    access:',
)
replace_once(
    page,
    '    floors: text(formData, "floors", 60) as PrimeViewPricingInput["floors"],\n    cleaningScope:',
    '    floors: floorCount === "3+" ? "3rd floor or higher" : floorCount === "2" ? "Ground + 1st floor" : floorCount === "1" ? "Ground floor only" : undefined,\n'
    '    floorCount,\n'
    '    workingHeight: text(formData, "working_height", 60) as PrimeViewPricingInput["workingHeight"],\n'
    '    windowAccess: text(formData, "window_access", 60) as PrimeViewPricingInput["windowAccess"],\n'
    '    cleaningScope:',
)
replace_once(
    page,
    '  const propertyType = text(formData, "property_type", 80);\n  const address = text(formData, "address", 300);\n  const postcode = text(formData, "postcode", 20).toUpperCase();\n  const framesSills = text(formData, "frames_sills", 20);\n  const additionalNotes = text(formData, "additional_notes", 1200);',
    '  const propertyType = text(formData, "property_type", 80);\n'
    '  const rearGardenAccess = text(formData, "rear_garden_access", 80);\n'
    '  const floorCount = text(formData, "floor_count", 20);\n'
    '  const workingHeight = text(formData, "working_height", 80);\n'
    '  const parking = text(formData, "parking", 80);\n'
    '  const windowAccess = text(formData, "window_access", 80);\n'
    '  const pets = text(formData, "pets", 20);\n'
    '  const address = text(formData, "address", 300);\n'
    '  const postcode = text(formData, "postcode", 20).toUpperCase();\n'
    '  const framesSills = text(formData, "frames_sills", 20);\n'
    '  const arrivalNotes = text(formData, "arrival_notes", 1200);\n'
    '  const photoSession = text(formData, "photo_session", 80);\n'
    '  const photoPaths = formData.getAll("photo_path").map((value) => String(value).trim()).filter(Boolean);',
)
replace_once(
    page,
    '  if (!name || !email || !phone || !serviceId || !startsAt || !propertyType || !address || !postcode || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !/^[0-9a-f-]{36}$/i.test(serviceId)) redirect(bookingUrl("error=invalid"));\n  if (!UK_POSTCODE.test(postcode)) redirect(bookingUrl("error=postcode"));',
    '  if (!name || !email || !phone || !serviceId || !startsAt || !propertyType || !rearGardenAccess || !floorCount || !workingHeight || !parking || !pets || !address || !postcode || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !/^[0-9a-f-]{36}$/i.test(serviceId)) redirect(bookingUrl("error=invalid"));\n'
    '  if (!PROPERTY_TYPES.includes(propertyType as (typeof PROPERTY_TYPES)[number]) || !REAR_ACCESS.includes(rearGardenAccess as (typeof REAR_ACCESS)[number]) || !FLOOR_COUNTS.includes(floorCount as (typeof FLOOR_COUNTS)[number]) || !WORKING_HEIGHTS.includes(workingHeight as (typeof WORKING_HEIGHTS)[number]) || !PARKING_OPTIONS.includes(parking as (typeof PARKING_OPTIONS)[number]) || !PET_OPTIONS.includes(pets as (typeof PET_OPTIONS)[number])) redirect(bookingUrl("error=invalid"));\n'
    '  if (photoPaths.length > 5 || (photoPaths.length > 0 && (!UUID.test(photoSession) || photoPaths.some((pathname) => !pathname.startsWith(`primeview-booking/${photoSession}/`) || pathname.includes("..") || pathname.length > 800)))) redirect(bookingUrl("error=invalid"));\n'
    '  if (!UK_POSTCODE.test(postcode)) redirect(bookingUrl("error=postcode"));',
)
replace_once(
    page,
    '  if (key === "window") {\n    const totalWindows =',
    '  if (key === "window") {\n    if (!WINDOW_ACCESS_OPTIONS.includes(windowAccess as (typeof WINDOW_ACCESS_OPTIONS)[number])) redirect(bookingUrl("error=invalid"));\n    const totalWindows =',
)
replace_once(
    page,
    '    `Property type: ${propertyType}`,\n    `Address: ${address}`,\n    `Postcode: ${postcode}`,\n    `Pricing: ${pricingResultSummary(price)}`,',
    '    `Property type: ${propertyType}`,\n'
    '    `Rear garden access: ${rearGardenAccess}`,\n'
    '    `Number of floors: ${floorCount}`,\n'
    '    `Working height: ${workingHeight}`,\n'
    '    `Parking: ${parking}`,\n'
    '    `Pets at property: ${pets}`,\n'
    '    `Address: ${address}`,\n'
    '    `Postcode: ${postcode}`,\n'
    '    `Pricing: ${pricingResultSummary(price)}`,
)
replace_once(page, '  if (framesSills) detailLines.push(`Frames & sills: ${framesSills}`);\n  if (additionalNotes) detailLines.push(`Additional details: ${additionalNotes}`);', '  if (framesSills) detailLines.push(`Frames & sills: ${framesSills}`);\n  if (windowAccess) detailLines.push(`Window access: ${windowAccess}`);\n  for (const pathname of photoPaths) detailLines.push(`Photo: ${pathname}`);\n  if (arrivalNotes) detailLines.push(`Arrival notes: ${arrivalNotes}`);')
replace_once(
    page,
    '    timeZone,\n  });',
    '    timeZone, language: "en",\n  });',
)

# Dashboard: understand the new structured lines and privately render uploaded photos.
dashboard = "src/app/dashboard/bokningar/[id]/page.tsx"
replace_once(dashboard, 'import Link from "next/link";', 'import Image from "next/image";\nimport Link from "next/link";')
replace_once(dashboard, '  CalendarClock,\n  CirclePoundSterling,', '  CalendarClock,\n  Camera,\n  CirclePoundSterling,')
replace_once(
    dashboard,
    '  customerNote: string;\n  rawNote: string;',
    '  customerNote: string;\n  photoPaths: string[];\n  rawNote: string;',
)
replace_once(
    dashboard,
    '  "property size", "heavy blockage", "conservatory size", "solar panels", "area", "heavy dirt / moss",\n  "oil / stain treatment", "weed treatment", "re-sanding", "sealing requested", "first clean",',
    '  "property size", "heavy blockage", "conservatory size", "solar panels", "area", "heavy dirt / moss",\n'
    '  "oil / stain treatment", "weed treatment", "re-sanding", "sealing requested", "first clean",\n'
    '  "rear garden access", "number of floors", "working height", "parking", "window access", "pets at property",',
)
replace_once(dashboard, '    customerNote: "",\n    rawNote: "",', '    customerNote: "",\n    photoPaths: [],\n    rawNote: "",')
replace_once(
    dashboard,
    '    if (normalizedLabel === "additional details") {\n      recognizedStructuredLine = true;\n      result.customerNote = value;\n      continue;\n    }',
    '    if (normalizedLabel === "additional details" || normalizedLabel === "arrival notes") {\n'
    '      recognizedStructuredLine = true;\n'
    '      result.customerNote = value;\n'
    '      continue;\n'
    '    }\n\n'
    '    if (normalizedLabel === "photo") {\n'
    '      recognizedStructuredLine = true;\n'
    '      if (value.startsWith("primeview-booking/") && !value.includes("..") && value.length <= 800 && result.photoPaths.length < 5) result.photoPaths.push(value);\n'
    '      continue;\n'
    '    }',
)
replace_once(
    dashboard,
    '        {parsedNotes.customerNote || parsedNotes.rawNote ? <article',
    '''        {parsedNotes.photoPaths.length ? <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Camera className="h-5 w-5 text-[#17452f]" /><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Property photos" : "Fastighetsbilder"}</h3></div>
          <p className="mt-2 text-sm text-[#5b665f]">{isEnglish ? "Photos supplied by the customer for access and price review." : "Bilder som kunden skickade för åtkomst- och prisbedömning."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{parsedNotes.photoPaths.map((pathname, index) => { const src = `/api/primeview/booking-photo?pathname=${encodeURIComponent(pathname)}`; return <a key={pathname} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#e4e9e2] bg-[#f7f9f6]"><Image src={src} alt={`Property photo ${index + 1}`} width={720} height={480} unoptimized className="aspect-[3/2] w-full object-cover" /></a>; })}</div>
        </article> : null}

        {parsedNotes.customerNote || parsedNotes.rawNote ? <article''',
)

# Verification UI: honor ?lang=en and keep PrimeView on its branded /booking route.
verify_page = "src/app/boka/verifiera/[id]/page.tsx"
Path(verify_page).write_text('''import { redirect } from "next/navigation";

import { verifyPublicBookingCode } from "@/lib/public-booking-verification";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; lang?: string | string[] }>;
};

type Locale = "sv" | "en";
const messages: Record<Locale, Record<string, string>> = {
  sv: {
    invalid: "Verifieringsförfrågan är ogiltig.", expired: "Koden har gått ut. Gör en ny bokning.", attempts: "För många felaktiga försök. Gör en ny bokning.", code: "Koden stämmer inte. Kontrollera mejlet och försök igen.", conflict: "Tiden hann bli bokad. Välj en ny tid.", save: "Bokningen kunde inte sparas. Försök igen.",
  },
  en: {
    invalid: "The verification request is invalid.", expired: "The code has expired. Please start a new booking.", attempts: "Too many incorrect attempts. Please start a new booking.", code: "That code is incorrect. Check your email and try again.", conflict: "That time has just been booked. Please choose a new time.", save: "The booking could not be saved. Please try again.",
  },
};

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

async function verify(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  const result = await verifyPublicBookingCode(id, code);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}${locale === "en" ? "&lang=en" : ""}`);
  if (result.slug === "primeview") redirect("/booking?booked=1");
  redirect(`/boka/${result.slug}?booked=1${locale === "en" ? "&lang=en" : ""}`);
}

export default async function VerifyBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const locale: Locale = first(query?.lang) === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const error = messages[locale][first(query?.error) ?? ""];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">{isEnglish ? "Verify email" : "Verifiera e-post"}</p>
        <h1 className="mt-3 text-3xl font-bold text-[#17201a]">{isEnglish ? "Enter the code from your email" : "Ange koden från mejlet"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665f]">{isEnglish ? "We sent a six-digit code. It is valid for 10 minutes, and the booking is created only after the code is verified." : "Vi har skickat en sexsiffrig kod. Koden gäller i 10 minuter och bokningen skapas först när den har verifierats."}</p>
        {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}
        <form action={verify} className="mt-6 grid gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="lang" value={locale} />
          <label className="grid gap-2 text-sm font-bold text-[#17201a]">
            {isEnglish ? "Verification code" : "Verifieringskod"}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus className="rounded-xl border border-[#cfd9d0] px-4 py-3 text-center text-2xl font-black tracking-[.35em] outline-none focus:border-[#17452f]" />
          </label>
          <button className="rounded-xl bg-[#17452f] px-4 py-3 font-bold text-white hover:bg-[#123923]">{isEnglish ? "Verify and create booking" : "Verifiera och skapa bokning"}</button>
        </form>
      </section>
    </main>
  );
}
''')

# Verification email: keep Swedish default, send English for PrimeView.
email_file = "src/features/email/booking-verification-email.ts"
replace_once(email_file, '  expiresMinutes?: number;\n};', '  expiresMinutes?: number;\n  language?: "sv" | "en";\n};')
replace_once(
    email_file,
    '  const expiresMinutes = input.expiresMinutes ?? 10;\n  const subject = `${input.code} är din verifieringskod för ${input.companyName}`;\n  const text = [\n    `${input.code} är din verifieringskod.`,\n    "",\n    `Använd koden för att verifiera din bokning hos ${input.companyName}.`,\n    `Koden gäller i ${expiresMinutes} minuter.`,\n    "",\n    `Hej ${input.customerName},`,\n    "Bokningen skapas först när koden har verifierats.",\n    "Om du inte gjorde bokningen kan du ignorera mejlet.",\n  ].join("\\n");\n  const html = `\n    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">\n      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.code)} är din verifieringskod för ${escapeHtml(input.companyName)}.</div>\n      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verifieringskod</p>\n      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${escapeHtml(input.code)}</p>\n      <p>Hej ${escapeHtml(input.customerName)},</p>\n      <p>Använd koden ovan för att verifiera din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p>\n      <p>Koden gäller i ${expiresMinutes} minuter. Bokningen skapas först när koden har verifierats.</p>\n      <p style="font-size:13px;color:#667168">Om du inte gjorde bokningen kan du ignorera mejlet.</p>\n    </div>\n  `;',
    '''  const expiresMinutes = input.expiresMinutes ?? 10;
  const isEnglish = input.language === "en";
  const subject = isEnglish ? `${input.code} is your verification code for ${input.companyName}` : `${input.code} är din verifieringskod för ${input.companyName}`;
  const text = isEnglish ? [
    `${input.code} is your verification code.`, "", `Use this code to verify your booking with ${input.companyName}.`, `The code is valid for ${expiresMinutes} minutes.`, "", `Hi ${input.customerName},`, "Your booking is created only after the code is verified.", "If you did not make this booking, you can ignore this email.",
  ].join("\\n") : [
    `${input.code} är din verifieringskod.`, "", `Använd koden för att verifiera din bokning hos ${input.companyName}.`, `Koden gäller i ${expiresMinutes} minuter.`, "", `Hej ${input.customerName},`, "Bokningen skapas först när koden har verifierats.", "Om du inte gjorde bokningen kan du ignorera mejlet.",
  ].join("\\n");
  const html = isEnglish ? `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.code)} is your verification code for ${escapeHtml(input.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verification code</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${escapeHtml(input.code)}</p>
      <p>Hi ${escapeHtml(input.customerName)},</p>
      <p>Use the code above to verify your booking with <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>The code is valid for ${expiresMinutes} minutes. Your booking is created only after the code is verified.</p>
      <p style="font-size:13px;color:#667168">If you did not make this booking, you can ignore this email.</p>
    </div>
  ` : `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.code)} är din verifieringskod för ${escapeHtml(input.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verifieringskod</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${escapeHtml(input.code)}</p>
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Använd koden ovan för att verifiera din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>Koden gäller i ${expiresMinutes} minuter. Bokningen skapas först när koden har verifierats.</p>
      <p style="font-size:13px;color:#667168">Om du inte gjorde bokningen kan du ignorera mejlet.</p>
    </div>
  `;''',
)

verification = "src/lib/public-booking-verification.ts"
replace_once(verification, '  timeZone: WorkspaceTimeZone;\n};', '  timeZone: WorkspaceTimeZone;\n  language?: "sv" | "en";\n};')
replace_once(verification, 'const sent = await sendBookingVerificationEmail({ customerName: input.customerName, customerEmail: input.customerEmail, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES });', 'const sent = await sendBookingVerificationEmail({ customerName: input.customerName, customerEmail: input.customerEmail, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES, language: input.language });')

# Pricing tests: assert the new exact rates and keep the minimum rule covered.
tests = "tests/primeview-precision-pricing.test.ts"
replace_once(tests, '    if (result.kind === "price") expect(result.total).toBe(60);', '    if (result.kind === "price") expect(result.total).toBe(45);')
replace_once(
    tests,
    '  it("applies recurring, condition, floor and access rules before minimum", () => {',
    '''  it("uses £3 for inside-only windows and £5.50 for standard inside + outside", () => {
    const inside = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside only", standardWindows: 15, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });
    const both = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });
    expect(inside.kind === "price" && inside.total).toBe(45);
    expect(both.kind === "price" && both.total).toBe(55);
    if (both.kind === "price") expect(both.lines.some((line) => line.label.includes("× £5.5"))).toBe(true);
  });

  it("uses consistent large and bay premiums for inside + outside", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10, largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2" });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.lines.some((line) => line.label.includes("2 large windows × £7.5"))).toBe(true);
      expect(result.lines.some((line) => line.label.includes("2 very large / bay windows × £9.5"))).toBe(true);
    }
  });

  it("applies recurring, condition, floor and access rules before minimum", () => {''',
)

print("PrimeView booking detail upgrade applied")
