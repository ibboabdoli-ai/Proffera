import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  processWorker: vi.fn(),
  isRuntime: vi.fn(),
  authorizedRunId: vi.fn(),
  coordinates: vi.fn(),
  customerEmail: vi.fn(),
  organizationNumber: vi.fn(),
  providerEmail: vi.fn(),
  providerSlug: vi.fn(),
  uuid: vi.fn(),
  brevoApiKey: vi.fn(),
  previewRecipient: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/marketplace-auto-worker", () => ({ processMarketplaceAutoWorker: mocks.processWorker }));
vi.mock("@/lib/email-runtime-config", () => ({
  resolveBrevoApiKey: mocks.brevoApiKey,
  resolvePreviewEmailRecipient: mocks.previewRecipient,
}));
vi.mock("@/lib/preview-marketplace-e2e", () => ({
  isPreviewMarketplaceE2eRuntime: mocks.isRuntime,
  previewMarketplaceE2eCoordinates: mocks.coordinates,
  previewMarketplaceE2eCustomerEmail: mocks.customerEmail,
  previewMarketplaceE2eOrganizationNumber: mocks.organizationNumber,
  previewMarketplaceE2eProviderEmail: mocks.providerEmail,
  previewMarketplaceE2eProviderSlug: mocks.providerSlug,
  previewMarketplaceE2eUuid: mocks.uuid,
  resolveAuthorizedPreviewMarketplaceE2eRunId: mocks.authorizedRunId,
}));

import { GET, POST } from "@/app/api/e2e/marketplace/fixture/route";

const suiteRunId = "a".repeat(48);
const databaseKeys = [
  "VERCEL_ENV",
  "PROFFERA_PREVIEW_DATABASE_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;
const originalEnv = Object.fromEntries(databaseKeys.map((key) => [key, process.env[key]]));

function restoreDatabaseEnv() {
  for (const key of databaseKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function previewRequest(path = "/api/e2e/marketplace/fixture", method = "POST") {
  return new Request(`https://preview.example.vercel.app${path}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of databaseKeys) delete process.env[key];
  process.env.VERCEL_ENV = "preview";

  mocks.isRuntime.mockReturnValue(true);
  mocks.authorizedRunId.mockResolvedValue(suiteRunId);
  mocks.coordinates.mockReturnValue({ latitude: -60, longitude: -120 });
  mocks.customerEmail.mockImplementation((value: string) => (
    /^[a-f0-9]{32,64}$/u.test(String(value ?? ""))
      ? `marketplace-e2e-${value}@customer.example.invalid`
      : null
  ));
  mocks.organizationNumber.mockReturnValue("5560000000");
  mocks.providerEmail.mockReturnValue("offers@preview.example.invalid");
  mocks.providerSlug.mockReturnValue("preview-e2e-vvs-provider");
  mocks.uuid.mockReturnValue("11111111-1111-4111-8111-111111111111");
  mocks.brevoApiKey.mockReturnValue("preview-key");
  mocks.previewRecipient.mockReturnValue("preview-sink@example.com");
});

afterEach(() => {
  restoreDatabaseEnv();
});

describe("Preview Marketplace fixture route isolation", () => {
  it("fails closed before acquiring SQL when the dedicated Preview database URL is missing", async () => {
    const writeSql = vi.fn();
    mocks.getSql.mockReturnValue(writeSql);

    const response = await POST(previewRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "database" });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(writeSql).not.toHaveBeenCalled();
  });

  it("fails closed before acquiring SQL when the Preview database overlaps a shared database", async () => {
    process.env.PROFFERA_PREVIEW_DATABASE_URL = "postgres://preview:secret@ep-preview-pooler.example.neon.tech/proffera?sslmode=require";
    process.env.DATABASE_URL = "postgres://shared:other@ep-preview.example.neon.tech/proffera?sslmode=verify-full";
    const writeSql = vi.fn();
    mocks.getSql.mockReturnValue(writeSql);

    const response = await POST(previewRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "database" });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(writeSql).not.toHaveBeenCalled();
  });

  it("deduplicates and validates run IDs before applying the four-run limit", async () => {
    const validRunId = "b".repeat(48);
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    const response = await GET(previewRequest(
      `/api/e2e/marketplace/fixture?runs=bad,bad,bad,bad,${validRunId}`,
      "GET",
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { states?: Array<{ runId?: string }> };
    expect(body.states).toEqual([{ runId: validRunId, state: null }]);
  });
});
