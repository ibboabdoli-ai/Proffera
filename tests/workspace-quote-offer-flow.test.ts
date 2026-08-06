import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("workspace quote offer lifecycle", () => {
  it("keeps authenticated send orchestration workspace-scoped and auditable", () => {
    const action = source("src/app/dashboard/offerter/[id]/actions.ts");
    const persistence = source("src/lib/workspace-quote-offers-db.ts");

    expect(action).toContain("prepareDashboardWorkspaceQuoteOfferEmailDelivery");
    expect(action).toContain("sendWorkspaceQuoteOfferEmail");
    expect(action).toContain("completeDashboardWorkspaceQuoteOfferEmailDelivery");
    expect(action).toContain('status: "sent"');
    expect(action).toContain('status: "failed"');

    expect(persistence).toContain("getUserWorkspaceAccess");
    expect(persistence).toContain("const workspaceId = await getActiveWorkspaceId()");
    expect(persistence).toContain("offer.workspace_id = ${workspaceId}");
    expect(persistence).toContain("request.workspace_id = offer.workspace_id");
    expect(persistence).toContain("offer.status = 'sent'");
    expect(persistence).toContain("request.status = 'quoted'");
    expect(persistence).toContain("nullif(trim(request.customer_email), '') is not null");
    expect(persistence).toContain("set status = 'failed', failure_code = 'superseded'");
    expect(persistence).toContain("workspace_quote_offer_email_deliveries");
  });

  it("stores only the public token hash and serializes pending email attempts", () => {
    const persistence = source("src/lib/workspace-quote-offers-db.ts");
    const deliveryMigration = source(
      "db/migrations/20260802_0026_workspace_quote_offer_email_delivery.sql",
    );
    const guardMigration = source(
      "db/migrations/20260802_0027_workspace_quote_offer_email_delivery_guards.sql",
    );

    expect(persistence).toContain("hashPublicWorkspaceQuoteOfferToken(token)");
    expect(persistence).toContain("offer.public_token_hash = ${tokenHash}");
    expect(deliveryMigration).toContain("Raw public-link tokens are never stored");
    expect(deliveryMigration).not.toContain("raw_token");
    expect(deliveryMigration).toContain(
      "unique (workspace_id, quote_offer_id, attempt)",
    );
    expect(deliveryMigration).toContain(
      "workspace_quote_offer_email_deliveries_one_pending_unique",
    );
    expect(deliveryMigration).toContain("where status = 'pending'");
    expect(guardMigration).toContain(
      "workspace_quote_offer_email_deliveries_one_pending_unique",
    );
  });

  it("accepts or rejects an open offer exactly once under guarded state", () => {
    const persistence = source("src/lib/workspace-quote-offers-db.ts");

    expect(persistence).toContain("export async function respondToPublicWorkspaceQuoteOffer");
    expect(persistence).toContain("offer.status = 'sent'");
    expect(persistence).toContain("offer.public_token_expires_at > now()");
    expect(persistence).toContain(
      "offer.valid_until is null or offer.valid_until >= current_date",
    );
    expect(persistence).toContain("request.status = 'quoted'");
    expect(persistence).toContain("set status = ${response}, updated_at = now()");
    expect(persistence).toContain("from responded_offer offer");
    expect(persistence).toContain("select id from responded_request");

    const responseSection = persistence.slice(
      persistence.indexOf("export async function respondToPublicWorkspaceQuoteOffer"),
    );
    expect(responseSection.match(/offer\.status = 'sent'/g)).toHaveLength(1);
    expect(responseSection).not.toContain("offer.status in ('sent', 'accepted', 'rejected')");
  });

  it("creates at most one customer-linked service job for an accepted offer", () => {
    const persistence = source("src/lib/workspace-quote-offers-db.ts");
    const serviceJobMigration = source(
      "db/migrations/20260802_0025_workspace_service_jobs.sql",
    );

    expect(persistence).toContain("where ${response} = 'accepted'");
    expect(persistence).toContain("insert into customers");
    expect(persistence).toContain("insert into workspace_service_jobs");
    expect(persistence).toContain("source_type");
    expect(persistence).toContain("'quote_offer'");
    expect(persistence).toContain("'new'");
    expect(persistence).toContain(
      "on conflict (quote_offer_id) where quote_offer_id is not null do nothing",
    );
    expect(persistence).toContain("insert into workspace_service_job_events");
    expect(persistence).toContain("insert into customer_events");
    expect(persistence).toContain("join customer_for_job customer on true");

    expect(serviceJobMigration).toContain(
      "workspace_service_jobs_quote_offer_unique",
    );
    expect(serviceJobMigration).toContain("on workspace_service_jobs (quote_offer_id)");
    expect(serviceJobMigration).toContain("where quote_offer_id is not null");
    expect(serviceJobMigration).toContain(
      "status in ('new', 'assigned', 'in_progress', 'completed', 'cancelled')",
    );
  });

  it("keeps the customer page private, bilingual and fail-closed", () => {
    const page = source("src/app/offert/[token]/page.tsx");
    const action = source("src/app/offert/[token]/actions.ts");

    expect(page).toContain("robots: { index: false, follow: false }");
    expect(page).toContain("getPublicWorkspaceQuoteOffer(token)");
    expect(page).toContain('offer.status === "sent"');
    expect(page).toContain('offer.status === "accepted"');
    expect(page).toContain("Secure personal link");
    expect(page).toContain("Säker personlig länk");
    expect(page).toContain("publicWorkspaceQuoteOfferPdfPath(token)");

    expect(action).toContain('decision !== "accepted" && decision !== "rejected"');
    expect(action).toContain("respondToPublicWorkspaceQuoteOffer(token");
    expect(action).toContain('result.ok ? result.response : "invalid"');
    expect(action).not.toContain("workspaceId");
    expect(action).not.toContain("quoteRequestId");
  });
});
