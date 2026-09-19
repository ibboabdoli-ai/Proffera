import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Search, ShieldCheck } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";

import { onboardOwnerCompanyByOrganizationNumber } from "@/lib/company-directory-owner-onboarding";
import {
  ownerOnboardingErrorRedirect,
  ownerOnboardingStatusPath,
} from "@/lib/company-directory-owner-onboarding-ui";
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
    soleTraderInfoTitle: "Enskild firma stöds också",
    soleTraderInfo: "För enskild firma används en separat integritetssäker kontroll. Den privata identiteten används endast för den direkta kontrollen mot Bolagsverket och sparas inte i Directory-profilen eller i webbadressen.",
    soleTraderPendingTitle: "Enskild firma hittad – ägargranskning väntar",
    soleTraderPending: "Bolagsverket-kontrollen hittade en aktuell enskild firma. Företagsprofilen hålls privat tills en superadmin har granskat ägarunderlaget och kopplat den till arbetsytan.",
    soleTraderLinked: "Ägarskapet för den enskilda firman är verifierat och kopplat till den här arbetsytan. Profilen förblir privat tills publiceringskraven har verifierats separat.",
    soleTraderAmbiguous: "Bolagsverket returnerade mer än en aktuell enskild verksamhet för identiteten. Proffera väljer inte företag genom gissning; ärendet måste granskas manuellt.",
    soleTraderNotActive: "Ingen aktuell registrerad enskild firma kunde verifieras för identiteten.",
    notReady: "Företaget hittades men uppfyller inte ännu alla säkra publiceringskrav. Ingen verifierad koppling skapades.",
    claimed: "Företaget är redan kopplat till en annan Proffera-arbetsyta.",
    busy: "Ett annat verifieringsärende pågår för företaget. Försök igen senare.",
    linked: "Företaget är redan kopplat till den här arbetsytan.",
    invalid: "Kontrollera numret. Det ska innehålla 10 siffror.",
    rateLimited: "För många officiella kontroller har gjorts på kort tid. Försök igen senare.",
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
    soleTraderInfoTitle: "Sole traders are supported too",
    soleTraderInfo: "Sole traders use a separate privacy-safe check. The private identity is used only for the direct Bolagsverket verification and is not stored in the Directory profile or placed in a URL.",
    soleTraderPendingTitle: "Sole trader found – owner review pending",
    soleTraderPending: "The Bolagsverket check found a current sole trader. The business profile stays private until a super admin reviews the ownership evidence and connects it to the workspace.",
    soleTraderLinked: "Ownership of the sole trader is verified and connected to this workspace. The profile remains private until publication requirements are verified separately.",
    soleTraderAmbiguous: "Bolagsverket returned more than one current sole-trader business for the identity. Proffera does not guess which business is intended; manual review is required.",
    soleTraderNotActive: "No current registered sole trader could be verified for the identity.",
    notReady: "The business was found but does not yet satisfy all safe publication requirements. No verified connection was created.",
    claimed: "The business is already connected to another Proffera workspace.",
    busy: "Another verification is already in progress for this business. Try again later.",
    linked: "The business is already connected to this workspace.",
    invalid: "Check the number. It must contain 10 digits.",
    rateLimited: "Too many official checks were requested in a short period. Try again later.",
    sourceError: "Official verification could not be completed right now. Try again later.",
    back: "Back to marketplace",
    safety: "Names, addresses or other free-text fields can never be used to self-mark a company as verified.",
  },
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function withStatus(locale: Locale, status: string) {
  return ownerOnboardingStatusPath(locale, status);
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
    target = ownerOnboardingErrorRedirect(locale, error);
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

  const message = status === "sole_trader_review_pending"
    ? { title: t.soleTraderPendingTitle, body: t.soleTraderPending, tone: "green" }
    : status === "sole_trader_linked"
      ? { title: t.soleTraderLinked, body: "", tone: "green" }
      : status === "sole_trader_ambiguous"
        ? { title: t.soleTraderAmbiguous, body: "", tone: "amber" }
        : status === "sole_trader_not_active"
          ? { title: t.soleTraderNotActive, body: "", tone: "amber" }
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
                    : status === "rate_limited"
                      ? { title: t.rateLimited, body: "", tone: "amber" }
                      : status === "source_error"
                        ? { title: t.sourceError, body: "", tone: "red" }
                        : null;

  return (
    <div className="grid gap-6">
      <Link
        href={locale === "en" ? "/dashboard/marknadsplats?lang=en" : "/dashboard/marknadsplats"}
        className="inline-flex w-fit min-h-11 items-center gap-2 rounded-control px-3 text-sm font-bold text-brand-deep hover:bg-surface-subtle"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </Link>

      <DashboardPageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.lead}
        icon={Building2}
      />

      <section className="flex gap-3 rounded-card border border-[#efd58d] bg-[#fff7df] p-5 text-[#805d14]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">{t.soleTraderInfoTitle}</p>
          <p className="mt-2 text-sm leading-6">{t.soleTraderInfo}</p>
        </div>
      </section>

      {message ? (
        <section
          role="status"
          className={`rounded-2xl border p-5 ${
            message.tone === "green"
              ? "border-[#cfe8d6] bg-[#eaf8f2] text-[#087754]"
              : message.tone === "red"
                ? "border-[#f4c7ba] bg-[#fff5f2] text-danger"
                : "border-[#efd58d] bg-[#fff7df] text-[#805d14]"
          }`}
        >
          <p className="font-black">{message.title}</p>
          {message.body ? <p className="mt-2 text-sm leading-6">{message.body}</p> : null}
        </section>
      ) : null}

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-6 w-6 text-brand" />
          <div>
            <h2 className="text-xl font-black text-ink">{t.organizationNumber}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {locale === "en"
                ? "Exact identity only. Proffera does not fuzzy-match company names."
                : "Endast exakt identitet. Proffera gissar aldrig företag utifrån ungefärliga namn."}
            </p>
          </div>
        </div>

        <form action={addCompanyAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="lang" value={locale} />
          <label className="grid gap-2 text-sm font-bold text-ink">
            {t.organizationNumber}
            <input
              name="organizationNumber"
              required
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.placeholder}
              className="min-h-12 rounded-control border border-line bg-surface px-4 text-base outline-none focus:ring-2 focus:ring-brand/15"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand-deep px-6 text-sm font-black text-white"
          >
            <Search className="h-4 w-4" /> {t.submit}
          </button>
        </form>
      </section>

      <section className="flex gap-3 rounded-card border border-line bg-[#f3f8ff] p-5 text-sm leading-6 text-ink-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p>{t.safety}</p>
      </section>
    </div>
  );
}
