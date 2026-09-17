import type { Metadata } from "next";

import { getWorkspaceInvitation } from "@/features/company/workspace-invitation";
import {
  authRedirectQuery,
  firstAuthSearchParam,
  resolveAuthLocale,
  type AuthSearchParams,
} from "@/lib/auth-locale";
import { activateWorkspaceAction } from "./actions";
import { ActivationView } from "./activation-view";

export const metadata: Metadata = {
  title: "Activate customer portal | Aktivera kundportal",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<AuthSearchParams>;
};

export default async function ActivationPage({ params, searchParams }: PageProps) {
  const [{ token }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const invitation = await getWorkspaceInvitation(token);
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
