import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardGlobalLocaleBoundary } from "@/components/dashboard/dashboard-global-locale-boundary";
import { DashboardLanguageSwitchFix } from "@/components/dashboard/dashboard-language-switch-fix";
import { DashboardOwnerOnboardingBanner } from "@/components/dashboard/dashboard-owner-onboarding-banner";
import { DashboardStripeCheckoutFix } from "@/components/dashboard/dashboard-stripe-checkout-fix";
import { SettingsLocaleBoundary } from "@/app/dashboard/installningar/settings-locale-boundary";
import { SettingsResidualLocaleFix } from "@/app/dashboard/installningar/settings-residual-locale-fix";
import { canManageWorkspaceSettings, getUserWorkspaceAccess, getUserWorkspaceOptions } from "@/lib/workspace-access";
import { getDashboardEnabledFeatureKeys, getDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Proffera SaaS dashboard preview for leads, customers, bookings and AI assistant.",
};

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    if (access.reason === "no_session") redirect("/logga-in");
    return (
      <DashboardShell>
        <DashboardLanguageSwitchFix />
        <DashboardStripeCheckoutFix />
        <DashboardGlobalLocaleBoundary>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Åtkomst saknas</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Du har inte behörighet att visa den här sidan. Kontakta Proffera om du tror att detta är fel.</p>
          </section>
        </DashboardGlobalLocaleBoundary>
      </DashboardShell>
    );
  }

  const canManageSettings = canManageWorkspaceSettings(access);
  const [moduleAccess, enabledFeatures, workspaceOptions] = await Promise.all([
    getDashboardModuleAccess(), getDashboardEnabledFeatureKeys(), getUserWorkspaceOptions(),
  ]);

  return (
    <DashboardShell workspaceName={access.workspaceName} workspaceId={access.workspaceId} workspaceOptions={workspaceOptions} moduleAccess={moduleAccess} enabledFeatures={enabledFeatures} canManageSettings={canManageSettings}>
      <DashboardLanguageSwitchFix />
      <DashboardStripeCheckoutFix />
      <DashboardGlobalLocaleBoundary>
        <DashboardOwnerOnboardingBanner canManageSettings={canManageSettings} />
        <SettingsLocaleBoundary>
          <SettingsResidualLocaleFix>{children}</SettingsResidualLocaleFix>
        </SettingsLocaleBoundary>
      </DashboardGlobalLocaleBoundary>
    </DashboardShell>
  );
}
