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

    expect(bookingPage).toContain('const serviceId = String(formData.get("service_id")');
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

  it("keeps connected custom domains booking-first until explicit website opt-in", () => {
    const migration = source("db/migrations/20260809_0036_public_business_hub.sql");
    const proxy = source("src/proxy.ts");

    expect(migration).toContain("public_home_mode text not null default 'booking'");
    expect(proxy).toContain('target.publicHomeMode === "website"');
    expect(proxy).toContain("/foretag/${encodeURIComponent(target.workspaceSlug)}");
    expect(proxy).toContain("/boka/${encodeURIComponent(target.bookingSlug)}");
  });

  it("stores only non-PII funnel telemetry and enforces workspace/service identity", () => {
    const migration = source("db/migrations/20260809_0036_public_business_hub.sql");
    const events = source("src/app/api/public-business/events/route.ts");

    expect(migration).toContain("create table if not exists public_business_events");
    expect(migration).toContain("public_business_events_service_identity");
    expect(migration).not.toContain("public_business_events_customer_email");
    expect(events).toContain('eventKey: z.enum(["business_view", "service_view", "book_clicked", "quote_clicked", "contact_clicked"])');
    expect(events).not.toContain("customerEmail");
    expect(events).not.toContain("customerPhone");
  });
});
