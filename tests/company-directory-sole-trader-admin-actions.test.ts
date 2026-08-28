import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  rejectCompanyDirectoryClaim: vi.fn(),
  approveSoleTraderDirectoryClaim: vi.fn(),
  assertNoPersonalIdentifier: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/company-directory-claims-admin", () => ({
  rejectCompanyDirectoryClaim: mocks.rejectCompanyDirectoryClaim,
}));
vi.mock("@/lib/company-directory-sole-trader-owner", () => ({
  approveSoleTraderDirectoryClaim: mocks.approveSoleTraderDirectoryClaim,
  assertSoleTraderAdminTextHasNoPersonalIdentifier: mocks.assertNoPersonalIdentifier,
}));

import { rejectSoleTraderClaimAction } from "../src/app/admin/foretag/claims/sole-trader/actions";

describe("sole-trader admin actions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("blocks a rejection reason before the generic claim rejection helper can persist it", async () => {
    mocks.assertNoPersonalIdentifier.mockImplementation(() => {
      throw new Error("Do not include personal identifiers in the verification reference");
    });
    const form = new FormData();
    form.set("claimId", "22222222-2222-4222-8222-222222222222");
    form.set("reason", "Kontrollerad identitet 900101 1234");

    await expect(rejectSoleTraderClaimAction(form)).rejects.toThrow("Do not include personal identifiers");

    expect(mocks.assertNoPersonalIdentifier).toHaveBeenCalledTimes(1);
    expect(mocks.rejectCompanyDirectoryClaim).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("validates a safe rejection reason before calling the generic helper", async () => {
    mocks.rejectCompanyDirectoryClaim.mockResolvedValue({
      claimId: "22222222-2222-4222-8222-222222222222",
      profileId: "33333333-3333-4333-8333-333333333333",
    });
    const form = new FormData();
    form.set("claimId", "22222222-2222-4222-8222-222222222222");
    form.set("reason", "Underlaget kunde inte styrkas");

    await rejectSoleTraderClaimAction(form);

    expect(mocks.assertNoPersonalIdentifier.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.rejectCompanyDirectoryClaim.mock.invocationCallOrder[0]);
    expect(mocks.rejectCompanyDirectoryClaim).toHaveBeenCalledWith({
      claimId: "22222222-2222-4222-8222-222222222222",
      reason: "Underlaget kunde inte styrkas",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/foretag/claims/sole-trader");
  });
});
