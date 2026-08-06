import "server-only";

import { getSql as getDatabaseSql } from "@/lib/db/server";
import { primeViewWorkspaceSlug } from "@/features/primeview/review";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import {
  type ReviewInvitationCandidate,
  type VerifiedReviewSubmission,
  verifiedReviewTokenSchema,
} from "@/features/reviews/verified-review";
import {
  createVerifiedReviewToken,
  hashVerifiedReviewToken,
} from "@/lib/verified-review-token";
import {
  persistReviewInvitation,
  persistVerifiedReviewSubmission,
} from "@/lib/verified-review-persistence";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invitationLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

export type VerifiedReviewInvitationPreview =
  | {
      state: "valid";
      companyName: string;
      customerName: string;
      service: string;
      area: string | null;
      bookingId: string;
      expiresAt: string;
    }
  | {
      state: "invalid" | "expired" | "used" | "revoked" | "unavailable";
      companyName?: string;
    };

export type IssueReviewInvitationResult =
  | {
      ok: true;
      token: string;
      bookingId: string;
      bookingTitle: string;
      customerName: string | null;
      customerEmail: string | null;
      expiresAt: string;
    }
  | {
      ok: false;
      code: "access" | "invalid_booking" | "already_used" | "database";
    };

export type SubmitVerifiedReviewResult =
  | { ok: true; reviewId: string }
  | {
      ok: false;
      code: "invalid" | "expired" | "used" | "revoked" | "unavailable" | "database";
    };

function toText(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function toNullableText(value: unknown) {
  const text = toText(value).trim();
  return text || null;
}

function toBoolean(value: unknown) {
  return value === true || value === "true";
}

export async function listReviewInvitationCandidates(): Promise<ReviewInvitationCandidate[]> {
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getDatabaseSql()),
  ]);

  if (
    !access.ok ||
    !canManageWorkspaceSettings(access) ||
    access.workspaceSlug !== primeViewWorkspaceSlug ||
    !sql
  ) {
    return [];
  }

  try {
    const rows = await sql`
      select
        b.id as booking_id,
        b.title,
        coalesce(nullif(b.service, ''), b.title) as service,
        nullif(coalesce(b.city, c.city, ''), '') as area,
        b.starts_at,
        c.name as customer_name,
        c.email as customer_email,
        case
          when i.id is null then 'none'
          when i.status = 'pending' and i.expires_at <= now() then 'expired'
          else i.status
        end as invitation_status,
        i.expires_at as invitation_expires_at
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      left join website_review_invitations i
        on i.booking_id = b.id
       and i.workspace_id::text = b.workspace_id
      where b.workspace_id = ${access.workspaceId}
        and b.status = 'completed'
      order by b.starts_at desc nulls last, b.created_at desc
      limit 100
    `;

    return rows.flatMap((row) => {
      const bookingId = toText(row.booking_id);
      const invitationStatus = toText(row.invitation_status);

      if (
        !bookingId ||
        !["none", "pending", "expired", "used", "revoked"].includes(invitationStatus)
      ) {
        return [];
      }

      return [
        {
          bookingId,
          title: toText(row.title, "Completed booking"),
          service: toText(row.service, "Service"),
          area: toNullableText(row.area),
          startsAt: toNullableText(row.starts_at),
          customerName: toNullableText(row.customer_name),
          customerEmail: toNullableText(row.customer_email),
          invitationStatus:
            invitationStatus as ReviewInvitationCandidate["invitationStatus"],
          invitationExpiresAt: toNullableText(row.invitation_expires_at),
        },
      ];
    });
  } catch (error) {
    console.error("Failed to list review invitation candidates", error);
    return [];
  }
}

export async function issueReviewInvitation(
  bookingId: string,
): Promise<IssueReviewInvitationResult> {
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getDatabaseSql()),
  ]);

  if (
    !access.ok ||
    !canManageWorkspaceSettings(access) ||
    access.workspaceSlug !== primeViewWorkspaceSlug
  ) {
    return { ok: false, code: "access" };
  }

  if (!sql || !uuidPattern.test(bookingId)) {
    return { ok: false, code: "invalid_booking" };
  }

  const token = createVerifiedReviewToken();
  const tokenHash = hashVerifiedReviewToken(token);
  const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString();

  try {
    const rows = await persistReviewInvitation({
      sql,
      actorUserId: access.userId,
      workspaceId: access.workspaceId,
      bookingId,
      tokenHash,
      expiresAt,
    });
    const row = rows[0];

    if (!toBoolean(row?.target_exists)) {
      return { ok: false, code: "invalid_booking" };
    }

    if (toText(row?.existing_status) === "used" && !row?.invitation_id) {
      return { ok: false, code: "already_used" };
    }

    const invitationId = toText(row?.invitation_id);
    if (!invitationId) return { ok: false, code: "database" };

    return {
      ok: true,
      token,
      bookingId: toText(row?.booking_id, bookingId),
      bookingTitle: toText(row?.booking_title, "Completed booking"),
      customerName: toNullableText(row?.customer_name),
      customerEmail: toNullableText(row?.customer_email),
      expiresAt: toText(row?.expires_at, expiresAt),
    };
  } catch (error) {
    console.error("Failed to issue verified review invitation", error);
    return { ok: false, code: "database" };
  }
}

export async function getVerifiedReviewInvitation(
  token: string,
): Promise<VerifiedReviewInvitationPreview> {
  const parsedToken = verifiedReviewTokenSchema.safeParse(token);
  const sql = getDatabaseSql();

  if (!parsedToken.success || !sql) return { state: "invalid" };

  const tokenHash = hashVerifiedReviewToken(parsedToken.data);

  try {
    const rows = await sql`
      select
        i.status,
        i.expires_at,
        i.workspace_id,
        i.booking_id,
        i.customer_id,
        w.name as company_name,
        w.status as workspace_status,
        b.status as booking_status,
        b.workspace_id as booking_workspace_id,
        b.customer_id as booking_customer_id,
        coalesce(nullif(b.service, ''), b.title) as service,
        nullif(coalesce(b.city, c.city, ''), '') as area,
        c.name as customer_name,
        exists(
          select 1
          from website_reviews r
          where r.review_invitation_id = i.id
             or (r.booking_id = i.booking_id and r.is_verified = true)
        ) as review_exists
      from website_review_invitations i
      join workspaces w on w.id = i.workspace_id
      join bookings b on b.id = i.booking_id
      left join customers c
        on c.id = i.customer_id
       and c.workspace_id = b.workspace_id
      where i.token_hash = ${tokenHash}
        and w.slug = ${primeViewWorkspaceSlug}
      limit 1
    `;
    const row = rows[0];

    if (!row) return { state: "invalid" };

    const companyName = toText(row.company_name, "Service provider");
    const status = toText(row.status);

    if (status === "used" || toBoolean(row.review_exists)) {
      return { state: "used", companyName };
    }
    if (status === "revoked") return { state: "revoked", companyName };
    if (new Date(toText(row.expires_at)).getTime() <= Date.now()) {
      return { state: "expired", companyName };
    }

    const workspaceMatches =
      toText(row.workspace_id) === toText(row.booking_workspace_id);
    const customerMatches =
      !row.customer_id ||
      toText(row.customer_id) === toText(row.booking_customer_id);

    if (
      status !== "pending" ||
      !["active", "trial"].includes(toText(row.workspace_status)) ||
      toText(row.booking_status) !== "completed" ||
      !workspaceMatches ||
      !customerMatches
    ) {
      return { state: "unavailable", companyName };
    }

    return {
      state: "valid",
      companyName,
      customerName: toText(row.customer_name, "Customer"),
      service: toText(row.service, "Completed service"),
      area: toNullableText(row.area),
      bookingId: toText(row.booking_id),
      expiresAt: toText(row.expires_at),
    };
  } catch (error) {
    console.error("Failed to read verified review invitation", error);
    return { state: "invalid" };
  }
}

export async function submitVerifiedReview(
  token: string,
  review: VerifiedReviewSubmission,
): Promise<SubmitVerifiedReviewResult> {
  const parsedToken = verifiedReviewTokenSchema.safeParse(token);
  const sql = getDatabaseSql();

  if (!parsedToken.success || !sql) return { ok: false, code: "invalid" };

  try {
    const rows = await persistVerifiedReviewSubmission({
      sql,
      tokenHash: hashVerifiedReviewToken(parsedToken.data),
      review,
      workspaceSlug: primeViewWorkspaceSlug,
    });
    const row = rows[0];
    const reviewId = toText(row?.review_id);

    if (reviewId && toBoolean(row?.submitted)) {
      return { ok: true, reviewId };
    }

    const invitationStatus = toText(row?.invitation_status);
    if (!invitationStatus) return { ok: false, code: "invalid" };
    if (invitationStatus === "used" || toBoolean(row?.review_exists)) {
      return { ok: false, code: "used" };
    }
    if (invitationStatus === "revoked") {
      return { ok: false, code: "revoked" };
    }
    if (new Date(toText(row?.expires_at)).getTime() <= Date.now()) {
      return { ok: false, code: "expired" };
    }
    if (toText(row?.booking_status) !== "completed") {
      return { ok: false, code: "unavailable" };
    }

    return { ok: false, code: "database" };
  } catch (error) {
    console.error("Failed to submit verified review", error);
    return { ok: false, code: "database" };
  }
}
