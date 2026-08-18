import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  getSnapshot: vi.fn(),
  getPendingQueue: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-authorization", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));
vi.mock("@/lib/company-directory-admin", () => ({
  getCompanyDirectoryAdminSnapshot: mocks.getSnapshot,
}));
vi.mock("@/lib/company-directory-admin-queue", () => ({
  getCompanyDirectoryPendingVerificationCount: mocks.getPendingQueue,
}));
vi.mock("@/app/admin/foretag/directory/actions", () => ({
  publishDirectoryProfileAction: vi.fn(),
}));

import DirectoryEngineAdminPage from "@/app/admin/foretag/directory/page";

describe("company directory admin queue card rendering", () => {
  beforeEach(() => {
    mocks.requireSuperAdmin.mockReset();
    mocks.getSnapshot.mockReset();
    mocks.getPendingQueue.mockReset();

    mocks.requireSuperAdmin.mockResolvedValue(undefined);
    mocks.getPendingQueue.mockResolvedValue(37);
    mocks.getSnapshot.mockResolvedValue({
      schemaReady: true,
      config: {
        syncEnabled: true,
        profileProcessingEnabled: true,
        autoPublishEnabled: true,
        sourceConfigured: true,
        detailConfigured: true,
        oauthConfigured: true,
        provider: "test",
        batchSize: 5,
        maxPages: 2,
        pilotLocations: ["Stockholm", "Södertälje"],
      },
      counts: {
        ready: 1,
        review: 2,
        published: 3,
        inactive: 4,
      },
      pendingClaims: 0,
      profilePage: {
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 1,
      },
      latestRuns: [],
      profiles: [],
    });
  });

  it("renders the live pending verification count returned by the queue loader", async () => {
    const page = await DirectoryEngineAdminPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(mocks.getPendingQueue).toHaveBeenCalledTimes(1);
    expect(html).toContain("I kö");
    expect(html).toContain(">37<");
    expect(html).toContain("Väntar på verifiering");
  });
});
