import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getWorkspaceInvitation } from "@/features/company/workspace-invitation";
import {
  activationDocumentTitle,
  authRedirectQuery,
  firstAuthSearchParam,
  resolveAuthLocale,
  type AuthSearchParams,
} from "@/lib/auth-locale";
import { activateWorkspaceAction } from "./actions";
import { ActivationView } from "./activation-view";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const query = searchParams ? await searchParams : undefined;
  const locale = resolveAuthLocale(query);

  return {
    title: { absolute: activationDocumentTitle(locale) },
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<AuthSearchParams>;
};

const activationBrowserHarnessToken = "__mobile-i18n-activation-e2e__";
const dashboardBrowserHarnessToken = "__mobile-i18n-dashboard-e2e__";

function ciBrowserHarnessEnabled() {
  return process.env.CI === "true" && process.env.NODE_ENV !== "production";
}

export default async function ActivationPage({ params, searchParams }: PageProps) {
  const [{ token }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const browserHarnessEnabled = ciBrowserHarnessEnabled();

  if (browserHarnessEnabled && token === dashboardBrowserHarnessToken) {
    return (
      <DashboardShell workspaceName="Proffera E2E">
        <p>Mobile i18n dashboard browser harness</p>
      </DashboardShell>
    );
  }

  const invitation = browserHarnessEnabled && token === activationBrowserHarnessToken
    ? { companyName: "Proffera E2E", email: "mobile-i18n@example.invalid" }
    : await getWorkspaceInvitation(token);
  const locale = resolveAuthLocale(query);
  const errorValue = firstAuthSearchParam(query?.error);
  const redirectQuery = authRedirectQuery(query, ["error"]);
  const action = activateWorkspaceAction.bind(null, token);

  return (
    <ActivationView
      action={action}
      invitation={invitation ? { companyName: invitation.companyName, email: invitation.email } : null}
      initialLocale={locale}
      initialError={errorValue}
      initialRedirectQuery={redirectQuery}
    />
  );
}
