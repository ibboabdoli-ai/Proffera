import "server-only";

import { sendVerifiedReviewInvitationEmail } from "@/features/email/verified-review-invitation-email";
import { getSql } from "@/lib/db/server";
import {
  getReviewInvitationDashboardContext,
  issueReviewInvitation,
  type IssueReviewInvitationResult,
} from "@/lib/verified-review-invitations";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";

const canonicalOrigin = "https://www.proffera.se";

export type ReviewInvitationDeliveryStatus =
  | "sent"
  | "missing_email"
  | "failed";

export type IssueAndDeliverReviewInvitationResult =
  | {
      ok: true;
      bookingId: string;
      bookingTitle: string;
      customerName: string | null;
      customerEmail: string | null;
      expiresAt: string;
      reviewUrl: string;
      delivery: {
        status: ReviewInvitationDeliveryStatus;
        providerMessageId: string | null;
      };
    }
  | Extract<IssueReviewInvitationResult, { ok: false }>;

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveVerifiedReviewOrigin(requestUrl?: string) {
  const candidates = [
    requestUrl,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    canonicalOrigin,
  ];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }

  return canonicalOrigin;
}

async function recordDeliveryAudit(input: {
  bookingId: string;
  status: ReviewInvitationDeliveryStatus;
  providerMessageId: string | null;
  failureCode: string | null;
}) {
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getSql()),
  ]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return;

  const action =
    input.status === "sent"
      ? "website_review.invitation_email_sent"
      : input.status === "missing_email"
        ? "website_review.invitation_email_skipped"
        : "website_review.invitation_email_failed";
  const reason =
    input.status === "sent"
      ? "Verified review invitation email sent"
      : input.status === "missing_email"
        ? "Verified review invitation email skipped because the customer has no email address"
        : "Verified review invitation email failed";

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
        ${action},
        ${reason},
        null,
        ${JSON.stringify({
          booking_id: input.bookingId,
          delivery_status: input.status,
          provider_message_id: input.providerMessageId,
          failure_code: input.failureCode,
        })}::jsonb
      )
    `;
  } catch (error) {
    console.error("Failed to audit verified review invitation delivery", error);
  }
}

export async function issueAndDeliverReviewInvitation(
  bookingId: string,
  requestUrl?: string,
): Promise<IssueAndDeliverReviewInvitationResult> {
  const invitation = await issueReviewInvitation(bookingId);
  if (!invitation.ok) return invitation;

  const reviewUrl = new URL(
    `/review/${encodeURIComponent(invitation.token)}`,
    resolveVerifiedReviewOrigin(requestUrl),
  ).toString();

  if (!invitation.customerEmail) {
    await recordDeliveryAudit({
      bookingId: invitation.bookingId,
      status: "missing_email",
      providerMessageId: null,
      failureCode: null,
    });
    return {
      ok: true,
      bookingId: invitation.bookingId,
      bookingTitle: invitation.bookingTitle,
      customerName: invitation.customerName,
      customerEmail: invitation.customerEmail,
      expiresAt: invitation.expiresAt,
      reviewUrl,
      delivery: { status: "missing_email", providerMessageId: null },
    };
  }

  const context = await getReviewInvitationDashboardContext();
  if (!context) {
    await recordDeliveryAudit({
      bookingId: invitation.bookingId,
      status: "failed",
      providerMessageId: null,
      failureCode: "context",
    });
    return {
      ok: true,
      bookingId: invitation.bookingId,
      bookingTitle: invitation.bookingTitle,
      customerName: invitation.customerName,
      customerEmail: invitation.customerEmail,
      expiresAt: invitation.expiresAt,
      reviewUrl,
      delivery: { status: "failed", providerMessageId: null },
    };
  }

  const sent = await sendVerifiedReviewInvitationEmail({
    customerName: invitation.customerName ?? "Customer",
    customerEmail: invitation.customerEmail,
    companyName: context.companyName,
    service: invitation.bookingTitle,
    reviewUrl,
    expiresAt: invitation.expiresAt,
    language: context.language,
    timeZone: context.timeZone,
    primaryColor: context.primaryColor,
  });

  await recordDeliveryAudit({
    bookingId: invitation.bookingId,
    status: sent.ok ? "sent" : "failed",
    providerMessageId: sent.ok ? sent.providerMessageId : null,
    failureCode: sent.ok ? null : sent.code,
  });

  return {
    ok: true,
    bookingId: invitation.bookingId,
    bookingTitle: invitation.bookingTitle,
    customerName: invitation.customerName,
    customerEmail: invitation.customerEmail,
    expiresAt: invitation.expiresAt,
    reviewUrl,
    delivery: {
      status: sent.ok ? "sent" : "failed",
      providerMessageId: sent.ok ? sent.providerMessageId : null,
    },
  };
}
