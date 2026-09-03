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

type FixtureOptions = {
  advertisingBlocked: boolean | null | undefined;
  factsPresent?: boolean;
  existingStatus?: "delivery_failed" | null;
};

type InvitationState = {
  status: "none" | "sending" | "pending" | "delivery_failed" | "sent";
  dispatchToken: string | null;
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

function createSql({
  advertisingBlocked,
  factsPresent = true,
  existingStatus = null,
}: FixtureOptions) {
  const state: InvitationState = {
    status: existingStatus ?? "none",
    dispatchToken: existingStatus ? "existing-dispatch-token" : null,
  };

  const sql = vi.fn(async (...args: unknown[]) => {
    const query = queryText(args);

    if (query.includes("from quote_requests q")) return [eligibleRow];
    if (query.includes("select id from marketplace_outreach_suppressions")) return [];

    if (query.includes("stale_reservation") && query.includes("from marketplace_quote_invitations")) {
      if (state.status === "none") return [];
      return [{
        id: invitationId,
        status: state.status,
        stale_reservation: false,
      }];
    }

    if (query.includes("set recipient_email =") && query.includes("status = 'sending'")) {
      if (state.status !== "delivery_failed") return [];
      state.status = "sending";
      state.dispatchToken = String(args[4] ?? "");
      return [{ id: invitationId }];
    }

    if (query.includes("insert into marketplace_quote_invitations")) {
      if (state.status !== "none") return [];
      state.status = "sending";
      state.dispatchToken = String(args[6] ?? "");
      return [{ id: invitationId }];
    }

    if (query.includes("set status = 'pending'") && query.includes("company_directory_official_facts facts")) {
      const ownsLease = state.status === "sending"
        && state.dispatchToken !== null
        && state.dispatchToken === String(args[2] ?? "");
      if (factsPresent && advertisingBlocked === false && ownsLease) {
        state.status = "pending";
        return [{ id: invitationId }];
      }
      return [];
    }

    if (query.includes("set status = 'delivery_failed'") && query.includes("company_directory_official_facts facts")) {
      const ownsLease = state.status === "sending"
        && state.dispatchToken !== null
        && state.dispatchToken === String(args[2] ?? "");
      if ((!factsPresent || advertisingBlocked !== false) && ownsLease) {
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

async function expectDispatchBlocked(options: FixtureOptions) {
  const { sql, state } = createSql(options);
  mocks.getSql.mockReturnValue(sql);

  const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

  expect(result).toEqual({ ok: false, code: "conflict" });
  expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
  expect(state.status).toBe("delivery_failed");
  expect(state.dispatchToken).toBeNull();

  return sql;
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
    ["blocked", { advertisingBlocked: true, factsPresent: true }],
    ["unknown", { advertisingBlocked: null, factsPresent: true }],
    ["missing Official Facts row", { advertisingBlocked: undefined, factsPresent: false }],
  ] as const)("does not deliver when advertising permission is %s", async (_label, options) => {
    const sql = await expectDispatchBlocked(options);

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
    const { sql, state } = createSql({ advertisingBlocked: false });
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

  it("keeps system Marketplace dispatches out of the admin-user audit table", async () => {
    const { sql, state } = createSql({ advertisingBlocked: false });
    mocks.getSql.mockReturnValue(sql);
    mocks.sendInvitationEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-system" });

    const result = await sendMarketplaceGuestQuoteInvitation({
      ...invitationInput(),
      adminUserId: "system:marketplace-auto-worker",
    });

    expect(result).toEqual({ ok: true, invitationId });
    expect(state.status).toBe("sent");
    const queries = sql.mock.calls.map((call) => queryText(call));
    expect(queries.some((query) => query.includes("insert into admin_audit_logs"))).toBe(false);
    expect(queries.some(
      (query) => query.includes("insert into marketplace_quote_invitations")
        && query.includes("created_by_admin_user_id"),
    )).toBe(true);
  });

  it.each([
    ["blocked", { advertisingBlocked: true, factsPresent: true }],
    ["unknown", { advertisingBlocked: null, factsPresent: true }],
    ["missing Official Facts row", { advertisingBlocked: undefined, factsPresent: false }],
  ] as const)("releases a reused invitation lease when permission is %s", async (_label, options) => {
    await expectDispatchBlocked({
      ...options,
      existingStatus: "delivery_failed",
    });
  });

  it("delivers through the existing-invitation update path when permission is explicitly false", async () => {
    const { sql, state } = createSql({
      advertisingBlocked: false,
      existingStatus: "delivery_failed",
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.sendInvitationEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-existing" });

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: true, invitationId });
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("sent");
    expect(state.dispatchToken).not.toBeNull();
    expect(sql.mock.calls.map((call) => queryText(call)).some(
      (query) => query.includes("set recipient_email =") && query.includes("status = 'sending'"),
    )).toBe(true);
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
