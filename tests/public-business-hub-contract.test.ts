import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public Business Hub architecture contract", () => {
  it("keeps workspace_services as the public service source of truth", () => {
    const migration = source("db/migrations/20260809_0036_public_business_hub.sql");
    const publicHub = source("src/lib/public-business-hub.ts");

    expect(migration).toContain("alter table workspace_services");
    expect(migration).toContain("public_status text not null default 'draft'");
    expect(migration).toContain("conversion_mode text not null default 'book'");
    expect(migration).toContain("workspace_services_workspace_public_slug_unique_idx");
    expect(publicHub).toContain("from workspace_services");
    expect(publicHub).toContain("public_status = 'published'");
  });

  it("uses stable service UUIDs through booking verification while preserving snapshots", () => {
    const bookingPage = source("src/app/boka/[slug]/page.tsx");
    const verification = source("src/lib/public-booking-verification.ts");
    const migration = source("db/migrations/20260809_0036_public_business_hub.sql");

    expect(bookingPage).toContain('const serviceId = formText(formData, "service_id", 80)');
    expect(bookingPage).toContain("id = ${serviceId}::uuid");
    expect(verification).toContain("serviceId: string");
    expect(verification).toContain("service_id, service_name");
    expect(verification).toContain("service_id, title, service");
    expect(migration).toContain("add column if not exists service_id uuid");
    expect(migration).toContain("bookings_service_ws_fk");
    expect(migration).toContain("public_booking_verifications_service_identity");
  });

  it("keeps public visibility independent from operational activation", () => {
    const policy = source("src/lib/workspace-service-policy.ts");
    const serviceUi = source("src/app/dashboard/installningar/services-read-only.tsx");

    expect(policy).toContain('WorkspaceServicePublicStatus = "draft" | "published" | "hidden"');
    expect(policy).toContain('WorkspaceServiceConversionMode = "book" | "quote" | "book_or_quote" | "contact"');
    expect(serviceUi).toContain('name="public_status"');
    expect(serviceUi).toContain('name="is_active"');
  });

  it("uses the currency-safe structured service price instead of duplicating a public price model", () => {
    const actions = source("src/app/dashboard/installningar/service-actions.ts");
    const database = source("src/lib/workspace-services-db.ts");
    const publicHub = source("src/lib/public-business-hub.ts");

    expect(actions).toContain("validateWorkspaceServicePrice");
    expect(actions).toContain("workspaceSettings.billingCurrency");
    expect(database).toContain("price_type = ${input.priceType}");
    expect(database).toContain("price_amount_minor = ${input.priceAmountMinor}");
    expect(publicHub).toContain('service.priceType === "quote"');
  });

  it("supports a safe per-service cover image through admin, storage and public rendering", () => {
    const actions = source("src/app/dashboard/installningar/service-actions.ts");
    const database = source("src/lib/workspace-services-db.ts");
    const publicHub = source("src/lib/public-business-hub.ts");

    expect(actions).toContain("validateServiceCoverUpload");
    expect(database).toContain("cover_image_url");
    expect(publicHub).toContain("coverImageUrl");
  });

  it("does not silently preselect the first service from the company-level booking CTA", () => {
    const publicHub = source("src/lib/public-business-hub.ts");

    expect(publicHub).toContain('href: `/boka/${workspace.bookingSlug}`');
    expect(publicHub).not.toContain('href: `/boka/${workspace.bookingSlug}?service_id=${service.id}`');
  });

  it("keeps book-or-quote limited to those two conversion actions", () => {
    const publicHub = source("src/lib/public-business-hub.ts");

    expect(publicHub).toContain('service.conversionMode === "book_or_quote"');
    expect(publicHub).toContain('label: locale === "sv" ? "Boka" : "Book"');
    expect(publicHub).toContain('label: locale === "sv" ? "Begär offert" : "Request quote"');
  });

  it("routes contact-mode services into the existing CRM prospect model safely", () => {
    const route = source("src/app/api/public-business/[slug]/contact/route.ts");

    expect(route).toContain("insert into customers");
    expect(route).toContain("'prospect'");
    expect(route).toContain("public_business_contact");
  });

  it("routes company-level contact requests into CRM instead of requiring email", () => {
    const route = source("src/app/api/public-business/[slug]/contact/route.ts");

    expect(route).toContain("customer_phone");
    expect(route).toContain("customer_email");
    expect(route).toContain("contactMethod");
  });

  it("uses a guarded quote endpoint for Public Business Hub services without changing the legacy quote endpoint", () => {
    const route = source("src/app/api/public-business/[slug]/quote/route.ts");

    expect(route).toContain("public_business_quote");
    expect(route).toContain("allowPublicSubmission");
    expect(route).toContain("workspace_quote_requests");
  });

  it("keeps connected custom domains booking-first until explicit website opt-in", () => {
    const domains = source("src/lib/public-site-domains.ts");

    expect(domains).toContain('publicHomeMode === "website"');
    expect(domains).toContain('`/boka/${slug}`');
  });

  it("stores only non-PII funnel telemetry and enforces workspace/service identity", () => {
    const migration = source("db/migrations/20260809_0036_public_business_hub.sql");
    const analytics = source("src/lib/public-business-analytics.ts");

    expect(migration).toContain("public_business_events");
    expect(analytics).toContain("workspace_id");
    expect(analytics).toContain("service_id");
    expect(analytics).not.toContain("customer_email");
    expect(analytics).not.toContain("customer_phone");
  });
});
