import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Proffera golden lifecycle contract", () => {
  it("turns a confirmed Booking into exactly one fulfillment Job", () => {
    const bookingStatus = source("src/lib/dashboard-booking-status.ts");
    const jobMigration = source("db/migrations/20260802_0025_workspace_service_jobs.sql");

    expect(bookingStatus).toContain("insert into workspace_service_jobs");
    expect(bookingStatus).toContain("'booking'");
    expect(bookingStatus).toContain("where updated_booking.new_status = 'confirmed'");
    expect(bookingStatus).toContain("on conflict (booking_id) where booking_id is not null do nothing");
    expect(bookingStatus).toContain("'Service job created from confirmed booking.'");
    expect(jobMigration).toContain("workspace_service_jobs_booking_unique");
    expect(jobMigration).toContain("on workspace_service_jobs (booking_id)");
  });

  it("keeps Booking completion synchronized with Job completion evidence", () => {
    const bookingStatus = source("src/lib/dashboard-booking-status.ts");

    expect(bookingStatus).toContain("source_job_sync as (");
    expect(bookingStatus).toContain("updated_booking.new_status in ('completed', 'cancelled')");
    expect(bookingStatus).toContain("when source_job_candidate.booking_status = 'completed' then 'completed'");
    expect(bookingStatus).toContain("source_completion_evidence as (");
    expect(bookingStatus).toContain("'Booking source marked completed.'");
    expect(bookingStatus).toContain("'completion_evidence_added'");
  });

  it("requests a Verified Review after either supported completion path", () => {
    const bookingStatus = source("src/lib/dashboard-booking-status.ts");
    const serviceJobs = source("src/lib/workspace-service-jobs-db.ts");
    const reviewPersistence = source("src/lib/verified-review-persistence.ts");

    expect(bookingStatus).toContain('if (changed && status === "completed")');
    expect(bookingStatus).toContain("deliverVerifiedReviewInvitation(bookingId)");

    expect(serviceJobs).toContain('if (nextStatus === "completed" && bookingId)');
    expect(serviceJobs).toContain("await deliverVerifiedReviewInvitation(bookingId)");

    expect(reviewPersistence).toContain("b.status = 'completed'");
    expect(reviewPersistence).toContain("on conflict (workspace_id, booking_id)");
    expect(reviewPersistence).toContain("website_review_invitations.status <> 'used'");
  });

  it("turns an accepted Offer into at most one fulfillment Job", () => {
    const offers = source("src/lib/workspace-quote-offers-db.ts");
    const jobMigration = source("db/migrations/20260802_0025_workspace_service_jobs.sql");

    expect(offers).toContain("export async function respondToPublicWorkspaceQuoteOffer");
    expect(offers).toContain("where ${response} = 'accepted'");
    expect(offers).toContain("insert into workspace_service_jobs");
    expect(offers).toContain("'quote_offer'");
    expect(offers).toContain("on conflict (quote_offer_id) where quote_offer_id is not null do nothing");
    expect(jobMigration).toContain("workspace_service_jobs_quote_offer_unique");
  });

  it("keeps the whole lifecycle tenant-scoped at its shared Booking/Customer edge", () => {
    const bookingStatus = source("src/lib/dashboard-booking-status.ts");

    expect(bookingStatus).toContain("c.id = b.customer_id");
    expect(bookingStatus).toContain("c.workspace_id = b.workspace_id");
    expect(bookingStatus).toContain("where b.workspace_id = ${workspaceId}");
    expect(bookingStatus).toContain("job.workspace_id = ${workspaceId}::uuid");
  });
});
