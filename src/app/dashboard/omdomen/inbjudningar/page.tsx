import { redirect } from "next/navigation";
import { Link2 } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  getReviewInvitationDashboardContext,
  listReviewInvitationCandidates,
} from "@/lib/verified-review-invitations";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import { ReviewInvitationManager } from "./review-invitation-manager";

export const dynamic = "force-dynamic";

type InvitationPageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function ReviewInvitationsPage({ searchParams }: InvitationPageProps) {
  const [access, query] = await Promise.all([
    getUserWorkspaceAccess(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const lang = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const isEnglish = lang === "en";

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    redirect(isEnglish ? "/dashboard?lang=en" : "/dashboard");
  }

  const [context, candidates] = await Promise.all([
    getReviewInvitationDashboardContext(),
    listReviewInvitationCandidates(),
  ]);
  if (!context) redirect(isEnglish ? "/dashboard?lang=en" : "/dashboard");

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={context.companyName}
        title={isEnglish ? "Verified review invitations" : "Verifierade omdömesinbjudningar"}
        description={
          isEnglish
            ? "Completed bookings receive a secure review invitation automatically when the customer has an email address."
            : "Slutförda bokningar får automatiskt en säker omdömesinbjudan när kunden har en e-postadress."
        }
        icon={Link2}
      />

      <section className="rounded-2xl border border-[#dbe5f6] bg-[#f6f9ff] p-5 text-sm leading-6 text-[#29436f]">
        <p className="font-bold text-[#071b42]">
          {isEnglish ? "Security and retry model" : "Säkerhets- och återförsöksmodell"}
        </p>
        <p className="mt-1">
          {isEnglish
            ? "Only the SHA-256 hash is stored. The raw link appears once, expires after 30 days and cannot be used twice. Use this page to resend a rotated link when email delivery fails or to copy it for a customer without email."
            : "Endast SHA-256-hashen lagras. Den råa länken visas en gång, går ut efter 30 dagar och kan inte användas två gånger. Använd sidan för att skicka en roterad länk på nytt när e-postleveransen misslyckas eller för att kopiera den åt en kund utan e-postadress."}
        </p>
      </section>

      <ReviewInvitationManager
        candidates={candidates}
        isEnglish={isEnglish}
        timeZone={context.timeZone}
      />
    </div>
  );
}
