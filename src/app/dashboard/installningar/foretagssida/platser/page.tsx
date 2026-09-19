import Link from "next/link";
import { MapPin } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { redirect } from "next/navigation";

import {
  createLocationAction,
  deactivateLocationAction,
  updateLocationAction,
} from "@/app/dashboard/installningar/foretagssida/platser/actions";
import {
  editableBusinessProfileLocationPurposes,
  listOwnerBusinessProfileLocations,
  type BusinessProfileLocationVisibility,
  type EditableBusinessProfileLocationPurpose,
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
  "rounded-control border border-line bg-surface px-4 py-3 text-sm font-normal text-ink outline-none transition hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15";

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
        <label className="grid gap-2 text-sm font-bold text-ink-muted">
          Typ
          <select name="purpose" defaultValue={defaults?.purpose ?? "workplace"} className={inputClass}>
            <option value="workplace">Arbetsplats</option>
            <option value="storefront">Besöksplats</option>
            <option value="service_base">Servicebas</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink-muted">
          Synlighet
          <select name="visibility" defaultValue={defaults?.visibility ?? "private"} className={inputClass}>
            <option value="private">Privat</option>
            <option value="approximate">Ungefärlig</option>
            <option value="public">Publik</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-ink-muted">
        Gatuadress
        <input name="addressLine1" maxLength={250} defaultValue={defaults?.addressLine1 ?? ""} className={inputClass} autoComplete="street-address" />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-ink-muted">
          Postnummer
          <input name="postalCode" maxLength={32} defaultValue={defaults?.postalCode ?? ""} className={inputClass} autoComplete="postal-code" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink-muted">
          Ort
          <input name="city" maxLength={120} defaultValue={defaults?.city ?? ""} className={inputClass} autoComplete="address-level2" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink-muted">
          Kommun
          <input name="municipality" maxLength={120} defaultValue={defaults?.municipality ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-3 rounded-card bg-surface-subtle p-4 text-sm text-ink-muted ring-1 ring-line sm:grid-cols-3">
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
      <p className="text-xs leading-5 text-ink-muted">
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
      <DashboardPageHeader
        eyebrow="Företagsplatser"
        title="Adresser och platser"
        description="Lägg till arbetsplats, besöksplats eller servicebas. Officiella registeradresser visas separat och kan inte skrivas över här."
        icon={MapPin}
        actions={<Link href="/dashboard/installningar/foretagssida" className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep">Tillbaka till företagssidan</Link>}
      />

      {params.updated ? (
        <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-bold text-brand" role="status">
          Företagsplatsen uppdaterades.
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-bold text-danger" role="alert">
          Platsen kunde inte sparas. Kontrollera uppgifterna och försök igen.
        </p>
      ) : null}

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Ny plats</p>
          <h2 className="mt-2 text-xl font-black text-ink">Lägg till en företagsplats</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Platsen kopplas server-side till den företagsprofil som den aktiva arbetsytan faktiskt äger.
          </p>
        </div>
        <form action={createLocationAction} className="grid gap-5">
          <LocationFields />
          <button className="inline-flex min-h-12 items-center justify-center rounded-control bg-brand-deep px-5 font-black text-white sm:justify-self-start">
            Lägg till plats
          </button>
        </form>
      </section>

      {ownerLocations.length > 0 ? (
        <section className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Egna platser</p>
            <h2 className="mt-2 text-xl font-black text-ink">Hantera företagets platser</h2>
          </div>
          {ownerLocations.map((location) => (
            <article key={location.id} className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-ink">{purposeLabels[location.purpose] ?? location.purpose}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                    {sourceLabels[location.sourceType] ?? location.sourceType} · {visibilityLabels[location.visibility]}
                  </p>
                </div>
                {location.isPrimary ? <span className="rounded-full bg-[#eaf8f2] px-3 py-1 text-xs font-bold text-[#087754]">Primär</span> : null}
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
                  <button className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-deep px-5 text-sm font-black text-white">
                    Spara ändringar
                  </button>
                </div>
              </form>
              <form action={deactivateLocationAction} className="mt-3">
                <input type="hidden" name="id" value={location.id} />
                <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#efc8c0] bg-surface px-5 text-sm font-black text-danger">
                  Ta bort plats
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : null}

      {readOnlyLocations.length > 0 ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Registeruppgifter</p>
          <h2 className="mt-2 text-xl font-black text-ink">Skrivskyddade platser</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            De här uppgifterna kommer från officiell källa, SCB eller administrativ verifiering och kan inte ändras från företagets platsinställningar.
          </p>
          <div className="mt-5 grid gap-3">
            {readOnlyLocations.map((location) => (
              <div key={location.id} className="rounded-card bg-surface-subtle p-4 ring-1 ring-line">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-ink">{purposeLabels[location.purpose] ?? location.purpose}</strong>
                  <span className="text-xs font-bold text-ink-muted">{sourceLabels[location.sourceType] ?? location.sourceType}</span>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
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
