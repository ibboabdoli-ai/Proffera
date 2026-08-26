import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sendInvitationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  sendMarketplaceGuestInvitationEmail: mocks.sendInvitationEmail,
}));

import {
  buildMarketplaceGuestQuoteView,
  sendMarketplaceGuestQuoteInvitation,
} from "@/lib/marketplace-guest-quote";

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const invitationId = "44444444-4444-4444-8444-444444444444";

const eligibleRow = {
  quote_request_id: "11111111-1111-4111-8111-111111111111",
  reference_id: "PF-SCB-1",
  category: "VVS",
  service_type: "VVS / Rörmokare",
  city: "Södertälje",
  preferred_date: "2026-09-01",
  quote_status: "submitted",
  consent_accepted: true,
  profile_id: "22222222-2222-4222-8222-222222222222",
  public_slug: "ror-ab",
  display_name: "Rör AB",
  publication_status: "published",
  is_active: true,
  privacy_blocked: false,
  organization_kind: "juridical_person",
  claimed_workspace_id: null,
};

function invitationInput() {
  return {
    quoteRequestId: eligibleRow.quote_request_id,
    profileId: eligibleRow.profile_id,
    recipientEmail: "offert@rorfirma.se",
    adminUserId: "admin-user",
    baseUrl: "https://www.proffera.se",
    wave: 1,
    matchScore: 95,
    matchReasons: ["test"],
  };
}

function queryText(args: readonly unknown[]) {
  const strings = args[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

function createSql(advertisingBlocked: boolean | null | undefined) {
  const state: {
    status: "none" | "sending" | "pending" | "delivery_failed" | "sent";
    dispatchToken: string | null;
  } = {
    status: "none",
    dispatchToken: null,
  };

  const sql = vi.fn(async (...args: unknown[]) => {
    const query = queryText(args);

    if (query.includes("from quote_requests q")) return [eligibleRow];
    if (query.includes("select id from marketplace_outreach_suppressions")) return [];
    if (query.includes("stale_reservation") && query.includes("from marketplace_quote_invitations")) return [];

    if (query.includes("insert into marketplace_quote_invitations")) {
      state.status = "sending";
      state.dispatchToken = String(args[6] ?? "");
      return [{ id: invitationId }];
    }

    if (query.includes("set status = 'pending'") && query.includes("company_directory_official_facts facts")) {
      const ownsLease = state.status === "sending"
        && state.dispatchToken !== null
        && state.dispatchToken === String(args[2] ?? "");
      if (advertisingBlocked === false && ownsLease) {
        state.status = "pending";
        return [{ id: invitationId }];
      }
      return [];
    }

    if (query.includes("set status = 'delivery_failed'") && query.includes("company_directory_official_facts facts")) {
      const ownsLease = state.status === "sending"
        && state.dispatchToken !== null
        && state.dispatchToken === String(args[2] ?? "");
      if (advertisingBlocked !== false && ownsLease) {
        state.status = "delivery_failed";
        state.dispatchToken = null;
      }
      return [];
    }

    if (query.includes("select status") && query.includes("from marketplace_quote_invitations")) {
      return state.status === "none" ? [] : [{ status: state.status }];
    }

    if (query.includes("provider_message_id =") && query.includes("invitation.status = 'pending'")) {
      if (state.status === "pending") state.status = "sent";
      return [{ id: invitationId }];
    }

    if (query.includes("insert into admin_audit_logs")) return [];
    return [];
  });

  return { sql, state };
}

describe("Marketplace advertising dispatch contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BREVO_API_KEY = "test-api-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@proffera.se>";
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
    else process.env.LEAD_FROM_EMAIL = originalFrom;
  });

  it.each([
    ["blocked", true],
    ["unknown", null],
    ["missing", undefined],
  ])("does not deliver when advertising permission is %s", async (_label, advertisingBlocked) => {
    const { sql, state } = createSql(advertisingBlocked);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: false, code: "conflict" });
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
    expect(state.status).toBe("delivery_failed");
    expect(state.dispatchToken).toBeNull();

    const queries = sql.mock.calls.map((call) => queryText(call));
    const dispatchClaim = queries.find((query) => query.includes("set status = 'pending'"));
    expect(dispatchClaim).toContain("company_directory_official_facts facts");
    expect(dispatchClaim).toContain("facts.advertising_blocked is false");

    const leaseRelease = queries.find(
      (query) => query.includes("set status = 'delivery_failed'")
        && query.includes("company_directory_official_facts facts"),
    );
    expect(leaseRelease).toContain("dispatch_token = null");
    expect(leaseRelease).toContain("invitation.status = 'sending'");
    expect(leaseRelease).toContain("invitation.dispatch_token =");
  });

  it("delivers when advertising permission is explicitly false", async () => {
    const { sql, state } = createSql(false);
    mocks.getSql.mockReturnValue(sql);
    mocks.sendInvitationEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-1" });

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: true, invitationId });
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("sent");
    expect(state.dispatchToken).not.toBeNull();

    const queries = sql.mock.calls.map((call) => queryText(call));
    expect(queries.some(
      (query) => query.includes("set status = 'pending'")
        && query.includes("facts.advertising_blocked is false"),
    )).toBe(true);
    expect(queries.some(
      (query) => query.includes("set status = 'delivery_failed'")
        && query.includes("company_directory_official_facts facts"),
    )).toBe(false);
  });

  it("renders a missing offer availability date as an empty string", () => {
    const view = buildMarketplaceGuestQuoteView({
      invitation_id: invitationId,
      status: "sent",
      display_name: "Rör AB",
      public_slug: "ror-ab",
      reference_id: "PF-SCB-1",
      category: "VVS",
      service_type: "VVS / Rörmokare",
      city: "Södertälje",
      postal_code: "151 00",
      description: "VVS-jobb",
      preferred_date: "2026-09-01",
      price_kind: "estimate",
      currency: "SEK",
      amount_minor: 100000,
      available_date: null,
      company_note: "",
      submitted_at: "2026-08-26T07:00:00.000Z",
    }, "2026-09-02T00:00:00.000Z", false);

    expect(view.offer?.availableDate).toBe("");
  });
});
