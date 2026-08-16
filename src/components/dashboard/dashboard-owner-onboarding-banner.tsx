import Link from "next/link";
import { cookies } from "next/headers";

import { shouldShowOwnerOnboardingPrompt } from "@/lib/owner-onboarding-routing";
import { getWorkspaceOnboarding } from "@/lib/workspace-experience";
import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";

export async function DashboardOwnerOnboardingBanner({ canManageSettings }: { canManageSettings: boolean }) {
  if (!canManageSettings) return null;

  const [onboarding, services, cookieStore] = await Promise.all([
    getWorkspaceOnboarding(),
    getDashboardWorkspaceServices(),
    cookies(),
  ]);
  const activeServices = services.filter((service) => service.isActive).length;
  if (!shouldShowOwnerOnboardingPrompt({
    canManageSettings,
    onboardingComplete: onboarding.isComplete,
    activeServices,
  })) return null;

  const locale = cookieStore.get("proffera_locale")?.value === "en" ? "en" : "sv";
  const copy = locale === "en"
    ? {
        eyebrow: "Workspace setup",
        title: "Finish your first setup",
        text: "Your workspace has no active services yet. Choose your business type and Proffera will create editable starter services without publishing anything automatically.",
        action: "Start setup",
      }
    : {
        eyebrow: "Kom igång",
        title: "Slutför din första setup",
        text: "Din arbetsyta har inga aktiva tjänster ännu. Välj företagstyp så skapar Proffera redigerbara starttjänster utan att publicera något automatiskt.",
        action: "Starta onboarding",
      };

  return (
    <section className="mb-6 rounded-card border border-[#c9e6d0] bg-[#eef8f0] p-5 shadow-card sm:p-6" aria-label={copy.eyebrow}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{copy.eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-ink">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{copy.text}</p>
        </div>
        <Link
          href={`/dashboard/onboarding${locale === "en" ? "?lang=en" : ""}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-brand-deep px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-hover"
        >
          {copy.action}
        </Link>
      </div>
    </section>
  );
}
