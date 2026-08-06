import "server-only";

import { getSql as getDatabaseSql } from "@/lib/db/server";
import {
  type ReviewInvitationCandidate,
  type ReviewWorkspaceBrand,
  type VerifiedReviewSubmission,
  verifiedReviewTokenSchema,
} from "@/features/reviews/verified-review";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";
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
const defaultBrand: ReviewWorkspaceBrand = {
  companyName: "Service provider",
  timeZone: "Europe/Stockholm",
  language: "sv",
  primaryColor: "#173e2b",
  accentColor: "#d8ae52",
  logoUrl: null,
  homeUrl: null,
};

export type VerifiedReviewInvitationPreview =
  | ({
      state: "valid";
      customerName: string;
      service: string;
      area: string | null;
      bookingId: string;
      expiresAt: string;
    } & ReviewWorkspaceBrand)
  | ({
      state: "invalid" | "expired" | "used" | "revoked" | "unavailable";
    } & Partial<ReviewWorkspaceBrand>);

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

function normalizeColor(value: unknown, fallback: string) {
  const color = toText(value).trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeTimeZone(value: unknown) {
  const timeZone = toText(value).trim();
  if (!timeZone) return defaultBrand.timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return defaultBrand.timeZone;
  }
}

function normalizeLogoUrl(value: unknown) {
  const url = toText(value).trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeHomeUrl(domain: unknown) {
  const value = toText(domain).trim();
  if (!value) return null;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function brandFromRow(row: Record<string, unknown>): ReviewWorkspaceBrand {
  return {
    companyName: toText(row.company_name, defaultBrand.companyName),
    timeZone: normalizeTimeZone(row.time_zone),
    language: toText(row.default_language) === "en" ? "en" : "sv",
    primaryColor: normalizeColor(row.primary_color, defaultBrand.primaryColor),
    accentColor: normalizeColor(row.accent_color, defaultBrand.accentColor),
    logoUrl: normalizeLogoUrl(row.logo_url),
    homeUrl:
      toText(row.custom_domain_status) === "active"
        ? normalizeHomeUrl(row.custom_domain)
        : null,
  };
}

async function hasReviewManagementAccess() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) return null;
  if (!(await hasDashboardFeatureAccess("verified_reviews"))) return null;
  return access;
}

export async function getReviewInvitationDashboardContext(): Promise<ReviewWorkspaceBrand | null> {
  const [access, sql] = await Promise.all([
    hasReviewManagementAccess(),
    Promise.resolve(getDatabaseSql()),
  ]);
  if (!access || !sql) return null;

  try {
    const rows = await sql`
      select
        coalesce(nullif(settings.company_name, ''), nullif(workspace.company_name, ''), workspace.name) as company_name,
        settings.time_zone,
        experience.default_language,
        experience.primary_color,
        experience.accent_color,
        experience.logo_url,
        experience.custom_domain,
        experience.custom_domain_status
      from workspaces workspace
      left join workspace_settings settings on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience on experience.workspace_id = workspace.id
      where workspace.id = ${access.workspaceId}::uuid
      limit 1
    `;
    return rows[0] ? brandFromRow(rows[0]) : { ...defaultBrand, companyName: access.workspaceName };
  } catch (error) {
    console.error("Failed to read verified review workspace context", error);
    return { ...defaultBrand, companyName: access.workspaceName };
  }
}

export async function listReviewInvitationCandidates(): Promise<ReviewInvitationCandidate[]> {
  const [access, sql] = await Promise.all([
    hasReviewManagementAccess(),
    Promise.resolve(getDatabaseSql()),
  ]);
  if (!access || !sql) return [];

  try {
    const rows = await sql`
      select
        booking.id as booking_id,
        booking.title,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        booking.starts_at,
        customer.name as customer_name,
        customer.email as customer_email,
        case
          when invitation.id is null then 'none'
          when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
          else invitation.status
        end as invitation_status,
        invitation.expires_at as invitation_expires_at
      from bookings booking
      left join customers customer
        on customer.id = booking.customer_id
       and customer.workspace_id = booking.workspace_id
      left join website_review_invitations invitation
        on invitation.booking_id = booking.id
       and invitation.workspace_id::text = booking.workspace_id
      where booking.workspace_id = ${access.workspaceId}
        and booking.status = 'completed'
      order by booking.starts_at desc nulls last, booking.created_at desc
      limit 100
    `;

    return rows.flatMap((row) => {
      const bookingId = toText(row.booking_id);
      const invitationStatus = toText(row.invitation_status);
      if (!bookingId || !["none", "pending", "expired", "used", "revoked"].includes(invitationStatus)) return [];

      return [{
        bookingId,
        title: toText(row.title, "Completed booking"),
        service: toText(row.service, "Service"),
        area: toNullableText(row.area),
        startsAt: toNullableText(row.starts_at),
        customerName: toNullableText(row.customer_name),
        customerEmail: toNullableText(row.customer_email),
        invitationStatus: invitationStatus as ReviewInvitationCandidate["invitationStatus"],
        invitationExpiresAt: toNullableText(row.invitation_expires_at),
      }];
    });
  } catch (error) {
    console.error("Failed to list review invitation candidates", error);
    return [];
  }
}

export async function issueReviewInvitation(bookingId: string): Promise<IssueReviewInvitationResult> {
  const [access, sql] = await Promise.all([
    hasReviewManagementAccess(),
    Promise.resolve(getDatabaseSql()),
  ]);
  if (!access) return { ok: false, code: "access" };
  if (!sql || !uuidPattern.test(bookingId)) return { ok: false, code: "invalid_booking" };

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

    if (!toBoolean(row?.target_exists)) return { ok: false, code: "invalid_booking" };
    if (toText(row?.existing_status) === "used" && !row?.invitation_id) return { ok: false, code: "already_used" };
    if (!toText(row?.invitation_id)) return { ok: false, code: "database" };

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

export async function getVerifiedReviewInvitation(token: string): Promise<VerifiedReviewInvitationPreview> {
  const parsedToken = verifiedReviewTokenSchema.safeParse(token);
  const sql = getDatabaseSql();
  if (!parsedToken.success || !sql) return { state: "invalid" };

  const tokenHash = hashVerifiedReviewToken(parsedToken.data);

  try {
    const rows = await sql`
      select
        invitation.status,
        invitation.expires_at,
        invitation.workspace_id,
        invitation.booking_id,
        invitation.customer_id,
        workspace.status as workspace_status,
        booking.status as booking_status,
        booking.workspace_id as booking_workspace_id,
        booking.customer_id as booking_customer_id,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        customer.name as customer_name,
        coalesce(nullif(settings.company_name, ''), nullif(workspace.company_name, ''), workspace.name) as company_name,
        settings.time_zone,
        experience.default_language,
        experience.primary_color,
        experience.accent_color,
        experience.logo_url,
        experience.custom_domain,
        experience.custom_domain_status,
        exists (
          select 1 from workspace_feature_flags feature
          where feature.workspace_id = invitation.workspace_id
            and feature.feature_key = 'verified_reviews'
            and feature.enabled = true
        ) as feature_enabled,
        exists (
          select 1
          from website_reviews review
          where review.review_invitation_id = invitation.id
             or (review.booking_id = invitation.booking_id and review.is_verified = true)
        ) as review_exists
      from website_review_invitations invitation
      join workspaces workspace on workspace.id = invitation.workspace_id
      join bookings booking on booking.id = invitation.booking_id
      left join customers customer
        on customer.id = invitation.customer_id
       and customer.workspace_id = booking.workspace_id
      left join workspace_settings settings on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience on experience.workspace_id = workspace.id
      where invitation.token_hash = ${tokenHash}
      limit 1
    `;
    const row = rows[0];
    if (!row) return { state: "invalid" };

    const brand = brandFromRow(row);
    const status = toText(row.status);
    if (status === "used" || toBoolean(row.review_exists)) return { state: "used", ...brand };
    if (status === "revoked") return { state: "revoked", ...brand };
    if (new Date(toText(row.expires_at)).getTime() <= Date.now()) return { state: "expired", ...brand };

    const workspaceMatches = toText(row.workspace_id) === toText(row.booking_workspace_id);
    const customerMatches = !row.customer_id || toText(row.customer_id) === toText(row.booking_customer_id);
    if (
      status !== "pending" ||
      !["active", "trial"].includes(toText(row.workspace_status)) ||
      !toBoolean(row.feature_enabled) ||
      toText(row.booking_status) !== "completed" ||
      !workspaceMatches ||
      !customerMatches
    ) {
      return { state: "unavailable", ...brand };
    }

    return {
      state: "valid",
      ...brand,
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

export async function submitVerifiedReview(token: string, review: VerifiedReviewSubmission): Promise<SubmitVerifiedReviewResult> {
  const parsedToken = verifiedReviewTokenSchema.safeParse(token);
  const sql = getDatabaseSql();
  if (!parsedToken.success || !sql) return { ok: false, code: "invalid" };

  try {
    const rows = await persistVerifiedReviewSubmission({
      sql,
      tokenHash: hashVerifiedReviewToken(parsedToken.data),
      review,
    });
    const row = rows[0];
    const reviewId = toText(row?.review_id);
    if (reviewId && toBoolean(row?.submitted)) return { ok: true, reviewId };

    const invitationStatus = toText(row?.invitation_status);
    if (!invitationStatus) return { ok: false, code: "invalid" };
    if (invitationStatus === "used" || toBoolean(row?.review_exists)) return { ok: false, code: "used" };
    if (invitationStatus === "revoked") return { ok: false, code: "revoked" };
    if (new Date(toText(row?.expires_at)).getTime() <= Date.now()) return { ok: false, code: "expired" };
    if (
      toText(row?.workspace_status) !== "active" &&
      toText(row?.workspace_status) !== "trial"
    ) return { ok: false, code: "unavailable" };
    if (!toBoolean(row?.feature_enabled) || toText(row?.booking_status) !== "completed") return { ok: false, code: "unavailable" };
    return { ok: false, code: "database" };
  } catch (error) {
    console.error("Failed to submit verified review", error);
    return { ok: false, code: "database" };
  }
}
