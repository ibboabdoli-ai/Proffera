import Link from "next/link";
import { redirect } from "next/navigation";

import {
  businessProfileLocationVisibilities,
  createOwnerBusinessProfileLocation,
  deactivateOwnerBusinessProfileLocation,
  editableBusinessProfileLocationPurposes,
  listOwnerBusinessProfileLocations,
  updateOwnerBusinessProfileLocation,
  type BusinessProfileLocationVisibility,
  type EditableBusinessProfileLocationPurpose,
  type WriteBusinessProfileLocationInput,
} from "@/lib/business-profile-location-owner";

export const dynamic = "force-dynamic";

const purposeLabels: Record<string, string> = {
  registered: "Registrerad adress",
  postal: "Postadress",
  workplace: "Arbetsplats",
  storefront: "Besöksplats",
  service_base: "Servicebas",
};

const visibilityLabels: Record<BusinessProfileLocationVisibility, string> = {
  private: "Privat",
  approximate: "Ungefärlig",
  public: "Publik",
};

const sourceLabels: Record<string, string> = {
  official: "Officiell källa",
  scb: "SCB",
  owner: "Egen uppgift",
  admin: "Admin",
};

const inputClass =
  "rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15";

function pageUrl(input?: { updated?: string; error?: string }) {
  const query = new URLSearchParams();
  if (input?.updated) query.set("updated", input.updated);
  if (input?.error) query.set("error", input.error);
  return `/dashboard/installningar/foretagssida/platser${query.size ? `?${query}` : ""}`;
}

function readPurpose(formData: FormData): EditableBusinessProfileLocationPurpose | null {
  const purpose = String(formData.get("purpose") ?? "");
  return editableBusinessProfileLocationPurposes.includes(purpose as EditableBusinessProfileLocationPurpose)
    ? purpose as EditableBusinessProfileLocationPurpose
    : null;
}

function readVisibility(formData: FormData): BusinessProfileLocationVisibility | null {
  const visibility = String(formData.get("visibility") ?? "");
  return businessProfileLocationVisibilities.includes(visibility as BusinessProfileLocationVisibility)
    ? visibility as BusinessProfileLocationVisibility
    : null;
}

function readLocationInput(formData: FormData): WriteBusinessProfileLocationInput | null {
  const purpose = readPurpose(formData);
  const visibility = readVisibility(formData);
  if (!purpose || !visibility) return null;

  return {
    purpose,
    visibility,
    isVisitable: formData.get("isVisitable") === "on",
    isPrimary: formData.get("isPrimary") === "on",
    confirmed: formData.get("confirmed") === "on",
    addressLine1: String(formData.get("addressLine1") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    municipality: String(formData.get("municipality") ?? ""),
  };
}

async function createLocationAction(formData: FormData) {
  "use server";
  const input = readLocationInput(formData);
  if (!input) redirect(pageUrl({ error: "invalid" }));

  try {
    await createOwnerBusinessProfileLocation(input);
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "created" }));
}

async function updateLocationAction(formData: FormData) {
  "use server";
  const input = readLocationInput(formData);
  const id = String(formData.get("id") ?? "").trim();
  if (!input || !id) redirect(pageUrl({ error: "invalid" }));

  try {
    await updateOwnerBusinessProfileLocation({ ...input, id });
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "updated" }));
}

async function deactivateLocationAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(pageUrl({ error: "invalid" }));

  try {
    await deactivateOwnerBusinessProfileLocation(id);
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "deactivated" }));
}

function LocationFields({
  defaults,
}: {
  defaults?: {
    purpose: string;
    visibility: BusinessProfileLocationVisibility;
    isVisitable: boolean;
    isPrimary: boolean;
    confirmed: boolean;
    addressLine1: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-[#344139]">
          Typ
          <select name="purpose" defaultValue={defaults?.purpose ?? "workplace"} className={inputClass}>
            <option value="workplace">Arbetsplats</option>
            <option value="storefront">Besöksplats</option>
            <option value="service_base">Servicebas</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#344139]">
          Synlighet
          <select name="visibility" defaultValue={defaults?.visibility ?? "private"} className={inputClass}>
            <option value="private">Privat</option>
            <option value="approximate">Ungefärlig</option>
            <option value="public">Publik</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-[#344139]">
        Gatuadress
        <input name="addressLine1" maxLength={250} defaultValue={defaults?.addressLine1 ?? ""} className={inputClass} autoComplete="street-address" />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-[#344139]">
          Postnummer
          <input name="postalCode" maxLength={32} defaultValue={defaults?.postalCode ?? ""} className={inputClass} autoComplete="postal-code" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#344139]">
          Ort
          <input name="city" maxLength={120} defaultValue={defaults?.city ?? ""} className={inputClass} autoComplete="address-level2" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#344139]">
          Kommun
          <input name="municipality" maxLength={120} defaultValue={defaults?.municipality ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-3 rounded-2xl bg-[#f7f9f6] p-4 text-sm text-[#344139] ring-1 ring-[#e0e5dd] sm:grid-cols-3">
        <label className="flex items-start gap-3 font-semibold">
          <input type="checkbox" name="isVisitable" defaultChecked={defaults?.isVisitable ?? false} className="mt-1" />
          <span>Besökbar plats</span>
        </label>
        <label className="flex items-start gap-3 font-semibold">
          <input type="checkbox" name="isPrimary" defaultChecked={defaults?.isPrimary ?? false} className="mt-1" />
          <span>Primär plats</span>
        </label>
        <label className="flex items-start gap-3 font-semibold">
          <input type="checkbox" name="confirmed" defaultChecked={defaults?.confirmed ?? false} className="mt-1" />
          <span>Jag bekräftar uppgifterna</span>
        </label>
      </div>
      <p className="text-xs leading-5 text-[#68736b]">
        En publik plats måste vara besökbar och uttryckligen bekräftad. Exakta kartkoordinater hanteras inte på den här sidan.
      </p>
    </div>
  );
}

export default async function BusinessLocationsSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  let locations;
  try {
    locations = await listOwnerBusinessProfileLocations();
  } catch {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const ownerLocations = locations.filter(
    (location) => location.sourceType === "owner" && editableBusinessProfileLocationPurposes.includes(
      location.purpose as EditableBusinessProfileLocationPurpose,
    ),
  );
  const readOnlyLocations = locations.filter((location) => !ownerLocations.includes(location));

  return (
    <div className="grid gap-5">
      <header className="rounded-[28px] bg-[#173e2b] p-6 text-white sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Företagsplatser</p>
            <h1 className="mt-2 text-3xl font-black">Adresser och platser</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
              Lägg till arbetsplats, besöksplats eller servicebas. Officiella registeradresser visas separat och kan inte skrivas över här.
            </p>
          </div>
          <Link href="/dashboard/installningar/foretagssida" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#173e2b]">
            Tillbaka till företagssidan
          </Link>
        </div>
      </header>

      {params.updated ? (
        <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]" role="status">
          Företagsplatsen uppdaterades.
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]" role="alert">
          Platsen kunde inte sparas. Kontrollera uppgifterna och försök igen.
        </p>
      ) : null}

      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">Ny plats</p>
          <h2 className="mt-2 text-xl font-black text-[#17201a]">Lägg till en företagsplats</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">
            Platsen kopplas server-side till den företagsprofil som den aktiva arbetsytan faktiskt äger.
          </p>
        </div>
        <form action={createLocationAction} className="grid gap-5">
          <LocationFields />
          <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#17452f] px-5 font-black text-white sm:justify-self-start">
            Lägg till plats
          </button>
        </form>
      </section>

      {ownerLocations.length > 0 ? (
        <section className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">Egna platser</p>
            <h2 className="mt-2 text-xl font-black text-[#17201a]">Hantera företagets platser</h2>
          </div>
          {ownerLocations.map((location) => (
            <article key={location.id} className="rounded-[24px] border border-[#dfe6df] bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#17201a]">{purposeLabels[location.purpose] ?? location.purpose}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#68736b]">
                    {sourceLabels[location.sourceType] ?? location.sourceType} · {visibilityLabels[location.visibility]}
                  </p>
                </div>
                {location.isPrimary ? <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-bold text-[#17452f]">Primär</span> : null}
              </div>
              <form action={updateLocationAction} className="grid gap-5">
                <input type="hidden" name="id" value={location.id} />
                <LocationFields
                  defaults={{
                    purpose: location.purpose,
                    visibility: location.visibility,
                    isVisitable: location.isVisitable,
                    isPrimary: location.isPrimary,
                    confirmed: Boolean(location.confirmedAt),
                    addressLine1: location.addressLine1,
                    postalCode: location.postalCode,
                    city: location.city,
                    municipality: location.municipality,
                  }}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-5 text-sm font-black text-white">
                    Spara ändringar
                  </button>
                </div>
              </form>
              <form action={deactivateLocationAction} className="mt-3">
                <input type="hidden" name="id" value={location.id} />
                <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#e4b7aa] bg-white px-5 text-sm font-black text-[#8f2f1b]">
                  Ta bort plats
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : null}

      {readOnlyLocations.length > 0 ? (
        <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">Registeruppgifter</p>
          <h2 className="mt-2 text-xl font-black text-[#17201a]">Skrivskyddade platser</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">
            De här uppgifterna kommer från officiell källa, SCB eller administrativ verifiering och kan inte ändras från företagets platsinställningar.
          </p>
          <div className="mt-5 grid gap-3">
            {readOnlyLocations.map((location) => (
              <div key={location.id} className="rounded-2xl bg-[#f7f9f6] p-4 ring-1 ring-[#e0e5dd]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-[#17201a]">{purposeLabels[location.purpose] ?? location.purpose}</strong>
                  <span className="text-xs font-bold text-[#68736b]">{sourceLabels[location.sourceType] ?? location.sourceType}</span>
                </div>
                <p className="mt-2 text-sm text-[#5b665f]">
                  {[location.addressLine1, location.postalCode, location.city, location.municipality].filter(Boolean).join(", ") || "Ingen visningsadress registrerad"}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
