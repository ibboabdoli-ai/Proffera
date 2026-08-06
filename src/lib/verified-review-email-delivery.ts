import "server-only";

import { sendVerifiedReviewInvitationEmail } from "@/features/email/review-invitation-email";
import { getSql } from "@/lib/db/server";
import {
  getReviewInvitationDashboardContext,
  issueReviewInvitation,
  type IssueReviewInvitationResult,
} from "@/lib/verified-review-invitations";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

type IssuedInvitation = Extract<IssueReviewInvitationResult, { ok: true }>;
type IssueFailureCode = Extract<IssueReviewInvitationResult, { ok: false }>["code"];

export type VerifiedReviewEmailDeliveryResult =
  | {
      ok: true;
      invitation: IssuedInvitation;
      reviewUrl: string;
      providerId: string | null;
    }
  | {
      ok: false;
      code: IssueFailureCode;
      invitation?: never;
      reviewUrl?: never;
      emailError?: never;
    }
  | {
      ok: false;
      code: "missing_email" | "email";
      invitation: IssuedInvitation;
      reviewUrl: string;
      emailError: string;
    };

function normalizeOrigin(value: string | undefined | null) {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveReviewInvitationOrigin(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    normalizeOrigin(environment.PROFFERA_APP_URL) ??
    normalizeOrigin(environment.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(environment.VERCEL_URL) ??
    "https://www.proffera.se"
  );
}

export function buildVerifiedReviewUrl(token: string) {
  return new URL(
    `/review/${encodeURIComponent(token)}`,
    resolveReviewInvitationOrigin(),
  ).toString();
}

async function recordEmailDeliveryAudit(input: {
  bookingId: string;
  invitationId?: string | null;
  outcome: "sent" | "failed";
  providerId?: string | null;
  failureCode?: string | null;
  expiresAt: string;
}) {
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getSql()),
  ]);
  if (!access.ok || !sql) return;

  try {
    await sql`
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      ) values (
        ${access.userId},
        ${access.workspaceId}::uuid,
        ${input.outcome === "sent"
          ? "website_review.invitation_email_sent"
          : "website_review.invitation_email_failed"},
        ${input.outcome === "sent"
          ? "Verified review invitation email sent"
          : "Verified review invitation email delivery failed"},
        null,
        ${JSON.stringify({
          booking_id: input.bookingId,
          invitation_id: input.invitationId ?? null,
          outcome: input.outcome,
          provider_id: input.providerId ?? null,
          failure_code: input.failureCode ?? null,
          expires_at: input.expiresAt,
        })}::jsonb
      )
    `;
  } catch (error) {
    console.error("Failed to audit verified review invitation email delivery", error);
  }
}

export async function deliverVerifiedReviewInvitation(
  bookingId: string,
): Promise<VerifiedReviewEmailDeliveryResult> {
  const invitation = await issueReviewInvitation(bookingId);
  if (!invitation.ok) return invitation;

  const reviewUrl = buildVerifiedReviewUrl(invitation.token);
  if (!invitation.customerEmail) {
    await recordEmailDeliveryAudit({
      bookingId: invitation.bookingId,
      outcome: "failed",
      failureCode: "missing_email",
      expiresAt: invitation.expiresAt,
    });
    return {
      ok: false,
      code: "missing_email",
      invitation,
      reviewUrl,
      emailError: "The completed booking does not have a customer email address.",
    };
  }

  const context = await getReviewInvitationDashboardContext();
  const delivery = await sendVerifiedReviewInvitationEmail({
    customerName: invitation.customerName ?? "Customer",
    customerEmail: invitation.customerEmail,
    companyName: context?.companyName ?? "Proffera",
    bookingTitle: invitation.bookingTitle,
    reviewUrl,
    expiresAt: invitation.expiresAt,
    language: context?.language === "en" ? "en" : "sv",
    timeZone: context?.timeZone ?? "Europe/Stockholm",
  });

  await recordEmailDeliveryAudit({
    bookingId: invitation.bookingId,
    outcome: delivery.ok ? "sent" : "failed",
    providerId: delivery.ok ? delivery.providerId : null,
    failureCode: delivery.ok ? null : delivery.code,
    expiresAt: invitation.expiresAt,
  });

  if (!delivery.ok) {
    return {
      ok: false,
      code: "email",
      invitation,
      reviewUrl,
      emailError: delivery.message,
    };
  }

  return {
    ok: true,
    invitation,
    reviewUrl,
    providerId: delivery.providerId,
  };
}
