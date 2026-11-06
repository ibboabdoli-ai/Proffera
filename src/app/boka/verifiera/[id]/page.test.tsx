import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  experience: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-experience", () => ({
  getPublicWorkspaceExperienceSettings: mocks.experience,
}));
vi.mock("@/lib/public-booking-verification", () => ({
  verifyPublicBookingCode: vi.fn(),
  resendPublicBookingCode: vi.fn(),
}));

import VerifyBookingPage from "./page";

const id = "11111111-2222-4333-8444-555555555555";
const workspaceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
let slug = "makeup-by-maria";

beforeEach(() => {
  vi.resetAllMocks();
  slug = "makeup-by-maria";
  vi.stubEnv("VERCEL_ENV", "preview");
  mocks.getSql.mockReturnValue(async () => [{
    workspace_id: workspaceId,
    workspace_slug: slug,
  }]);
  mocks.experience.mockResolvedValue({
    defaultLanguage: "sv",
    swedishEnabled: true,
    englishEnabled: false,
    primaryColor: "#17452f",
  });
});

afterEach(() => { vi.unstubAllEnvs(); });

async function markup(lang: string) {
  const element = await VerifyBookingPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ lang }),
  });
  return renderToStaticMarkup(element);
}

describe("Maria verification language keeps the Preview booking locale", () => {
  it("retains English and offers its language switch even when the workspace toggle is off", async () => {
    const html = await markup("en");
    expect(html).toMatch(/<main[^>]*lang="en"/);
    expect(html).toContain("Enter your verification code");
    expect(html).toContain(`/boka/verifiera/${id}?lang=en`);
    expect(html).toContain(">EN</a>");
    expect(mocks.experience).toHaveBeenCalledWith(workspaceId);
  });

  it("does not bypass another workspace's disabled English setting", async () => {
    slug = "another-business";
    const html = await markup("en");
    expect(html).toMatch(/<main[^>]*lang="sv"/);
    expect(html).not.toContain(">EN</a>");
    expect(html).toContain("Ange din verifieringskod");
  });

  it("keeps Maria Production gated by workspace language settings", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = await markup("en");
    expect(html).toMatch(/<main[^>]*lang="sv"/);
    expect(html).not.toContain(">EN</a>");
  });

  it("continues to support Arabic only in Maria Preview", async () => {
    expect(await markup("ar")).toMatch(/<main[^>]*lang="ar"[^>]*dir="rtl"/);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await markup("ar")).toMatch(/<main[^>]*lang="sv"/);
  });
});
