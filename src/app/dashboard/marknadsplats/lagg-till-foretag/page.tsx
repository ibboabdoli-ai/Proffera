import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Search, ShieldCheck } from "lucide-react";

import { onboardOwnerCompanyByOrganizationNumber } from "@/lib/company-directory-owner-onboarding";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Marknadsplats · företagskoppling",
    title: "Lägg till mitt företag",
    lead: "Om företaget saknas i Profferas katalog kan du ange organisationsnumret här. Proffera verifierar identiteten mot officiella källor innan något kan bli en verifierad företagsprofil.",
    organizationNumber: "Organisationsnummer",
    placeholder: "556123-4567",
    submit: "Kontrollera och lägg till",
    privacyTitle: "Enskild firma kräver integritetssäker verifiering",
    privacyLead: "Företaget hittades i den officiella källan, men Proffera sparar inte ett personnummerformat identifierare i den vanliga företagsprofilen. Den separata ägarverifieringen för enskild firma måste slutföras först.",
    notReady: "Företaget hittades men uppfyller inte ännu alla säkra publiceringskrav. Ingen verifierad koppling skapades.",
    claimed: "Företaget är redan kopplat till en annan Proffera-arbetsyta.",
    busy: "Ett annat verifieringsärende pågår för företaget. Försök igen senare.",
    linked: "Företaget är redan kopplat till den här arbetsytan.",
    invalid: "Kontrollera numret. Det ska innehålla 10 siffror.",
    sourceError: "Den officiella verifieringen kunde inte slutföras just nu. Försök igen senare.",
    back: "Tillbaka till marknadsplatsen",
    safety: "Namn, adress eller andra fritextfält kan inte användas för att självmarkera ett företag som verifierat.",
  },
  en: {
    eyebrow: "Marketplace · business connection",
    title: "Add my business",
    lead: "If the business is missing from Proffera's directory, enter its organisation number here. Proffera verifies the identity against official sources before anything can become a verified business profile.",
    organizationNumber: "Organisation number",
    placeholder: "556123-4567",
    submit: "Check and add",
    privacyTitle: "Sole trader requires privacy-safe verification",
    privacyLead: "The business was found in the official source, but Proffera does not store a personnummer-shaped identifier in the normal company-profile path. The dedicated owner verification for sole traders must be completed first.",
    notReady: "The business was found but does not yet satisfy all safe publication requirements. No verified connection was created.",
    claimed: "The business is already connected to another Proffera workspace.",
    busy: "Another verification is already in progress for this business. Try again later.",
    linked: "The business is already connected to this workspace.",
    invalid: "Check the number. It must contain 10 digits.",
    sourceError: "Official verification could not be completed right now. Try again later.",
    back: "Back to marketplace",
    safety: "Names, addresses or other free-text fields can never be used to self-mark a company as verified.",
  },
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function withStatus(locale: Locale, status: string) {
  const params = new URLSearchParams({ status });
  if (locale === "en") params.set("lang", "en");
  return `/dashboard/marknadsplats/lagg-till-foretag?${params.toString()}`;
}

function claimHref(slug: string, locale: Locale) {
  return locale === "en"
    ? `/en/companies/claim/${encodeURIComponent(slug)}`
    : `/foretag/claim/${encodeURIComponent(slug)}`;
}

async function addCompanyAction(formData: FormData) {
  "use server";
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  let target = withStatus(locale, "source_error");

  try {
    const result = await onboardOwnerCompanyByOrganizationNumber(formData.get("organizationNumber"));
    if (result.status === "available") {
      target = claimHref(result.profileSlug, locale);
    } else if (result.status === "linked") {
      target = withStatus(locale, "linked");
    } else {
      target = withStatus(locale, result.status);
    }
  } catch (error) {
    target = withStatus(
      locale,
      error instanceof Error && error.message === "organization_number"
        ? "invalid"
        : "source_error",
    );
  }

  redirect(target);
}

export default async function AddMarketplaceCompanyPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[]; status?: string | string[] }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const params = searchParams ? await searchParams : undefined;
  const locale: Locale = first(params?.lang) === "en" ? "en" : "sv";
  const status = first(params?.status) ?? "";
  const t = copy[locale];

  const message = status === "sole_trader_privacy"
    ? { title: t.privacyTitle, body: t.privacyLead, tone: "amber" }
    : status === "not_ready"
      ? { title: t.notReady, body: "", tone: "amber" }
      : status === "claimed"
        ? { title: t.claimed, body: "", tone: "red" }
        : status === "busy"
          ? { title: t.busy, body: "", tone: "amber" }
          : status === "linked"
            ? { title: t.linked, body: "", tone: "green" }
            : status === "invalid"
              ? { title: t.invalid, body: "", tone: "red" }
              : status === "source_error"
                ? { title: t.sourceError, body: "", tone: "red" }
                : null;

  return (
    <div className="grid gap-6">
      <Link
        href={locale === "en" ? "/dashboard/marknadsplats?lang=en" : "/dashboard/marknadsplats"}
        className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-[#17452f] hover:bg-[#edf4ef]"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </Link>

      <header className="rounded-[28px] bg-[#173e2b] p-7 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">{t.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">{t.lead}</p>
      </header>

      {message ? (
        <section
          role="status"
          className={`rounded-2xl border p-5 ${
            message.tone === "green"
              ? "border-[#c9e6d0] bg-[#eef8f0] text-[#17452f]"
              : message.tone === "red"
                ? "border-[#e7c8bf] bg-[#fff5f2] text-[#8f2f1b]"
                : "border-[#e7d29c] bg-[#fff9e9] text-[#76580d]"
          }`}
        >
          <p className="font-black">{message.title}</p>
          {message.body ? <p className="mt-2 text-sm leading-6">{message.body}</p> : null}
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-6 w-6 text-[#17452f]" />
          <div>
            <h2 className="text-xl font-black text-[#17201a]">{t.organizationNumber}</h2>
            <p className="mt-2 text-sm leading-6 text-[#667168]">
              {locale === "en"
                ? "Exact identity only. Proffera does not fuzzy-match company names."
                : "Endast exakt identitet. Proffera gissar aldrig företag utifrån ungefärliga namn."}
            </p>
          </div>
        </div>

        <form action={addCompanyAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="lang" value={locale} />
          <label className="grid gap-2 text-sm font-bold text-[#334139]">
            {t.organizationNumber}
            <input
              name="organizationNumber"
              required
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.placeholder}
              className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-4 text-base outline-none focus:ring-2 focus:ring-[#17452f]/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-6 text-sm font-black text-white"
          >
            <Search className="h-4 w-4" /> {t.submit}
          </button>
        </form>
      </section>

      <section className="flex gap-3 rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 text-sm leading-6 text-[#465349]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#17452f]" />
        <p>{t.safety}</p>
      </section>
    </div>
  );
}
