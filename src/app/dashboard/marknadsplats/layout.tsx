import type { ReactNode } from "react";

import { MarketplaceClaimPaidCta } from "@/app/dashboard/marknadsplats/claim-paid-cta";
import { getProviderActivationStateForWorkspace } from "@/lib/company-directory-provider-activation";
import { canManageWorkspaceMembers, getWorkspaceAccess } from "@/lib/workspace-access";

export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const access = await getWorkspaceAccess();
  const providerState = await getProviderActivationStateForWorkspace(access.workspaceId);
  const hasLinkedClaimedProfile = Boolean(providerState?.linkedDirectoryProfileId);
  const canManageSubscription = canManageWorkspaceMembers(access);

  return (
    <>
      {children}
      {hasLinkedClaimedProfile && canManageSubscription ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <MarketplaceClaimPaidCta />
        </div>
      ) : null}
    </>
  );
}
