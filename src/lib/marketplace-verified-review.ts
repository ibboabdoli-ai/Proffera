import "server-only";

import { sendVerifiedReviewInvitationEmail } from "@/features/email/review-invitation-email";
import type { ReviewWorkspaceBrand, VerifiedReviewSubmission } from "@/features/reviews/verified-review";
import { getSql } from "@/lib/db/server";
import { resolveMarketplacePublicBaseUrl } from "@/lib/marketplace-public-base-url";
import { createVerifiedReviewToken, hashVerifiedReviewToken } from "@/lib/verified-review-token";

const INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

const defaultBrand: ReviewWorkspaceBrand = {
  companyName: "Service provider",
  timeZone: "Europe/Stockholm",
  language: "sv",
  primaryColor: "#173e2b",
  accentColor: "#d8ae52",
  logoUrl: null,
  homeUrl: "/",
};

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function locale(value: unknown): "sv" | "en" {
  return text(value).trim().toLowerCase() === "en" ? "en" : "sv";
}

export type MarketplaceVerifiedReviewPreview =
  | ({
      state: "valid";
      customerName: string;
      service: string;
      area: string | null;
      bookingId: string;
      expiresAt: string;
    } & ReviewWorkspaceBrand)
  | ({
      state: "expired" | "used" | "revoked" | "unavailable";
    } & Partial<ReviewWorkspaceBrand>);

export type MarketplaceVerifiedReviewSubmissionResult =
  | { ok: true; reviewId: string }
  | { ok: false; code: "invalid" | "expired" | "used" | "revoked" | "unavailable" | "database" };

export async function getMarketplaceVerifiedReviewPreviewByHash(
  tokenHash: string,
): Promise<MarketplaceVerifiedReviewPreview | null> {
  const sql = getSql();
  if (!sql || !/^[a-f0-9]{64}$/i.test(tokenHash)) return null;

  try {
    const rows = await sql`
      select
        invitation.status,
        invitation.expires_at::text,
        invitation.marketplace_service_job_id::text as service_job_id,
        job.status as job_status,
        job.service_name,
        job.city,
        request.contact_name,
        request.locale as request_locale,
        profile.display_name,
        profile.public_slug,
        exists (
          select 1
          from website_reviews review
          where review.review_invitation_id = invitation.id
             or (
               review.marketplace_service_job_id = invitation.marketplace_service_job_id
               and review.is_verified = true
             )
        ) as review_exists
      from website_review_invitations invitation
      join marketplace_service_jobs job on job.id = invitation.marketplace_service_job_id
      join quote_requests request on request.id = job.quote_request_id
      join company_directory_profiles profile on profile.id = invitation.profile_id
      where invitation.token_hash = ${tokenHash}
        and invitation.marketplace_service_job_id is not null
        and invitation.profile_id = job.profile_id
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;

    const brand: ReviewWorkspaceBrand = {
      ...defaultBrand,
      companyName: text(row.display_name, defaultBrand.companyName),
      language: locale(row.request_locale),
      homeUrl: text(row.public_slug) ? `/foretag/listad/${encodeURIComponent(text(row.public_slug))}` : "/",
    };
    const status = text(row.status);
    if (status === "used" || bool(row.review_exists)) return { state: "used", ...brand };
    if (status === "revoked") return { state: "revoked", ...brand };
    if (new Date(text(row.expires_at)).getTime() <= Date.now()) return { state: "expired", ...brand };
    if (status !== "pending" || text(row.job_status) !== "completed") {
      return { state: "unavailable", ...brand };
    }

    return {
      state: "valid",
      ...brand,
      customerName: text(row.contact_name, "Customer"),
      service: text(row.service_name, "Completed service"),
      area: text(row.city).trim() || null,
      bookingId: text(row.service_job_id),
      expiresAt: text(row.expires_at),
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42P01" || code === "42703") return null;
    console.error("Failed to read Marketplace verified review invitation", error);
    return null;
  }
}

export async function submitMarketplaceVerifiedReviewByHash(
  tokenHash: string,
  review: VerifiedReviewSubmission,
): Promise<MarketplaceVerifiedReviewSubmissionResult> {
  const sql = getSql();
  if (!sql || !/^[a-f0-9]{64}$/i.test(tokenHash)) return { ok: false, code: "invalid" };

  try {
    const rows = await sql`
      with target as (
        select
          invitation.id,
          invitation.status as invitation_status,
          invitation.expires_at,
          invitation.marketplace_service_job_id,
          invitation.profile_id,
          job.status as job_status,
          job.service_name,
          job.city
        from website_review_invitations invitation
        join marketplace_service_jobs job on job.id = invitation.marketplace_service_job_id
        where invitation.token_hash = ${tokenHash}
          and invitation.marketplace_service_job_id is not null
          and invitation.profile_id = job.profile_id
        for update of invitation
      ), existing as (
        select exists (
          select 1
          from website_reviews review_row
          join target on true
          where review_row.review_invitation_id = target.id
             or (
               review_row.marketplace_service_job_id = target.marketplace_service_job_id
               and review_row.is_verified = true
             )
        ) as review_exists
      ), inserted as (
        insert into website_reviews (
          workspace_id,
          reviewer_name,
          rating,
          service,
          area,
          message,
          status,
          review_invitation_id,
          booking_id,
          customer_id,
          is_verified,
          verified_at,
          marketplace_service_job_id,
          profile_id
        )
        select
          null,
          ${review.reviewerName},
          ${review.rating},
          target.service_name,
          nullif(target.city, ''),
          ${review.message},
          'pending',
          target.id,
          null,
          null,
          true,
          now(),
          target.marketplace_service_job_id,
          target.profile_id
        from target
        cross join existing
        where target.invitation_status = 'pending'
          and target.expires_at > now()
          and target.job_status = 'completed'
          and existing.review_exists = false
        on conflict do nothing
        returning id, marketplace_service_job_id
      ), consumed as (
        update website_review_invitations invitation
        set status = 'used', used_at = now(), updated_at = now()
        from inserted
        where invitation.id = (select id from target)
          and invitation.status = 'pending'
        returning invitation.id
      ), event_record as (
        insert into marketplace_service_job_events (
          service_job_id, actor_type, event_type, reason
        )
        select inserted.marketplace_service_job_id, 'customer', 'review_submitted', 'Verified Marketplace review submitted'
        from inserted
        where exists (select 1 from consumed)
        returning id
      )
      select
        target.invitation_status,
        target.expires_at::text,
        target.job_status,
        existing.review_exists,
        inserted.id::text as review_id,
        exists (select 1 from consumed) as submitted
      from target
      cross join existing
      left join inserted on true
    `;

    const row = rows[0];
    if (text(row?.review_id) && bool(row?.submitted)) {
      return { ok: true, reviewId: text(row?.review_id) };
    }
    const status = text(row?.invitation_status);
    if (!status) return { ok: false, code: "invalid" };
    if (status === "used" || bool(row?.review_exists)) return { ok: false, code: "used" };
    if (status === "revoked") return { ok: false, code: "revoked" };
    if (new Date(text(row?.expires_at)).getTime() <= Date.now()) return { ok: false, code: "expired" };
    if (text(row?.job_status) !== "completed") return { ok: false, code: "unavailable" };
    return { ok: false, code: "database" };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42P01" || code === "42703") return { ok: false, code: "invalid" };
    console.error("Failed to submit Marketplace verified review", error);
    return { ok: false, code: "database" };
  }
}

export async function deliverMarketplaceServiceJobReviewInvitation(serviceJobId: string) {
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };

  const token = createVerifiedReviewToken();
  const tokenHash = hashVerifiedReviewToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString();

  try {
    const [, rows] = await sql.transaction((txn) => [
      txn`
        select pg_advisory_xact_lock(hashtextextended(${serviceJobId}, 0))
      `,
      txn`
        with target as (
          select
            job.id,
            job.profile_id,
            job.service_name,
            request.contact_name,
            request.contact_email,
            request.locale as request_locale,
            profile.display_name,
            profile.public_slug
          from marketplace_service_jobs job
          join quote_requests request on request.id = job.quote_request_id
          join company_directory_profiles profile on profile.id = job.profile_id
          where job.id = ${serviceJobId}::uuid
            and job.status = 'completed'
          limit 1
        ), existing as (
          select invitation.id, invitation.status, invitation.expires_at
          from website_review_invitations invitation
          join target on target.id = invitation.marketplace_service_job_id
          limit 1
        ), upserted as (
          insert into website_review_invitations (
            workspace_id,
            booking_id,
            customer_id,
            marketplace_service_job_id,
            profile_id,
            token_hash,
            status,
            expires_at,
            used_at,
            revoked_at,
            created_by_user_id
          )
          select null, null, null, target.id, target.profile_id, ${tokenHash}, 'pending', ${expiresAt}::timestamptz, null, null, null
          from target
          where not exists (
            select 1
            from existing
            where existing.status = 'used'
               or (existing.status = 'pending' and existing.expires_at > now())
          )
          on conflict (marketplace_service_job_id) where marketplace_service_job_id is not null
          do update set
            token_hash = excluded.token_hash,
            status = 'pending',
            expires_at = excluded.expires_at,
            used_at = null,
            revoked_at = null,
            updated_at = now()
          where website_review_invitations.status <> 'used'
            and not (
              website_review_invitations.status = 'pending'
              and website_review_invitations.expires_at > now()
            )
          returning id::text
        )
        select
          target.id::text as service_job_id,
          target.contact_name,
          target.contact_email,
          target.request_locale,
          target.display_name,
          target.public_slug,
          target.service_name,
          existing.status as existing_status,
          existing.expires_at::text as existing_expires_at,
          upserted.id as invitation_id
        from target
        left join existing on true
        left join upserted on true
      `,
    ], { isolationLevel: "ReadCommitted" });

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false as const, code: "unavailable" as const };

    const existingStatus = text(row.existing_status);
    const existingExpiresAt = new Date(text(row.existing_expires_at)).getTime();
    if (existingStatus === "used" && !text(row.invitation_id)) {
      return { ok: false as const, code: "already_used" as const };
    }
    if (existingStatus === "pending" && Number.isFinite(existingExpiresAt) && existingExpiresAt > Date.now() && !text(row.invitation_id)) {
      return { ok: true as const, code: "already_pending" as const };
    }
    if (!text(row.invitation_id)) return { ok: false as const, code: "database" as const };

    const invitationId = text(row.invitation_id);
    const customerEmail = text(row.contact_email).trim();
    if (!customerEmail) {
      await sql`
        update website_review_invitations
        set status = 'revoked', revoked_at = now(), updated_at = now()
        where id = ${invitationId}::uuid
          and token_hash = ${tokenHash}
          and status = 'pending'
      `;
      return { ok: false as const, code: "missing_email" as const };
    }

    const requestLocale = locale(row.request_locale);
    const reviewUrl = new URL(`/review/marketplace/${encodeURIComponent(token)}`, resolveMarketplacePublicBaseUrl());
    if (requestLocale === "en") reviewUrl.searchParams.set("lang", "en");
    const delivery = await sendVerifiedReviewInvitationEmail({
      customerName: text(row.contact_name, "Customer"),
      customerEmail,
      companyName: text(row.display_name, "Service provider"),
      bookingTitle: text(row.service_name, "Completed service"),
      reviewUrl: reviewUrl.toString(),
      expiresAt,
      language: requestLocale,
      timeZone: "Europe/Stockholm",
    });

    if (!delivery.ok) {
      await sql`
        update website_review_invitations
        set status = 'revoked', revoked_at = now(), updated_at = now()
        where id = ${invitationId}::uuid
          and token_hash = ${tokenHash}
          and status = 'pending'
      `;
      await sql`
        insert into marketplace_service_job_events (service_job_id, actor_type, event_type, reason)
        values (${text(row.service_job_id)}::uuid, 'system', 'review_invited', ${`Verified review invitation email failed: ${delivery.code}`})
      `;
      return { ok: false as const, code: "email" as const };
    }

    await sql`
      insert into marketplace_service_job_events (service_job_id, actor_type, event_type, reason)
      values (${text(row.service_job_id)}::uuid, 'system', 'review_invited', 'Verified review invitation email sent')
    `;

    return { ok: true as const, reviewUrl: reviewUrl.toString(), providerId: delivery.providerId };
  } catch (error) {
    console.error("Failed to deliver Marketplace verified review invitation", error);
    return { ok: false as const, code: "database" as const };
  }
}
