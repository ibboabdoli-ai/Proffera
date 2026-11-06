import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactNode } from "react";

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
import { redirect } from "next/navigation";
import { resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";

const id = "11111111-2222-4333-8444-555555555555";
const otherId = "66666666-7777-4888-8999-000000000000";
const workspaceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const otherWorkspaceId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  // Model the SQL tag at the request boundary rather than returning a Maria
  // row for every verification. The WHERE predicate and bound UUID matter.
  mocks.getSql.mockReturnValue(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    expect(parts.join("?")).toMatch(/\bwhere\s+v\.id\s*=\s*\?::uuid\b/i);
    expect(values).toHaveLength(1);
    if (values[0] === id) {
      return [{ workspace_id: workspaceId, workspace_slug: "makeup-by-maria" }];
    }
    if (values[0] === otherId) {
      return [{ workspace_id: otherWorkspaceId, workspace_slug: "another-business" }];
    }
    return [];
  });
  mocks.experience.mockResolvedValue({
    defaultLanguage: "sv",
    swedishEnabled: true,
    englishEnabled: false,
    primaryColor: "#17452f",
  });
});

afterEach(() => { vi.unstubAllEnvs(); });

async function markup(lang: string, verificationId = id) {
  const element = await VerifyBookingPage({
    params: Promise.resolve({ id: verificationId }),
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
    const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? [];
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).toMatch(/<input\b[^>]*type="hidden"[^>]*name="lang"[^>]*value="en"/);
    }
    expect(mocks.experience).toHaveBeenCalledWith(workspaceId);
  });

  it("passes English to both verification actions and preserves it in redirects", async () => {
    const page = await VerifyBookingPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ lang: "en" }),
    });
    const actions: Array<(data: FormData) => Promise<void>> = [];
    function collectForms(node: ReactNode): void {
      if (Array.isArray(node)) {
        node.forEach(collectForms);
        return;
      }
      if (!isValidElement(node)) return;
      const props = node.props as { action?: unknown; children?: ReactNode };
      if (node.type === "form" && typeof props.action === "function") {
        actions.push(props.action as (data: FormData) => Promise<void>);
      }
      collectForms(props.children);
    }
    collectForms(page);
    expect(actions).toHaveLength(2);

    vi.mocked(verifyPublicBookingCode).mockResolvedValue({ ok: false, error: "code" });
    vi.mocked(resendPublicBookingCode).mockResolvedValue({ ok: false, error: "wait" });
    const data = new FormData();
    data.set("id", id);
    data.set("code", "123456");
    data.set("lang", "en");

    await actions[0](data);
    expect(verifyPublicBookingCode).toHaveBeenCalledWith(id, "123456", "en");
    expect(redirect).toHaveBeenLastCalledWith(`/boka/verifiera/${id}?error=code&lang=en`);

    await actions[1](data);
    expect(resendPublicBookingCode).toHaveBeenCalledWith(id, "en");
    expect(redirect).toHaveBeenLastCalledWith(`/boka/verifiera/${id}?error=wait&lang=en`);
  });

  it("binds the verification ID to its own workspace before granting Preview languages", async () => {
    const mariaArabic = await markup("ar", id);
    const otherArabic = await markup("ar", otherId);
    const otherEnglish = await markup("en", otherId);

    expect(mariaArabic).toMatch(/<main[^>]*lang="ar"[^>]*dir="rtl"/);
    expect(otherArabic).toMatch(/<main[^>]*lang="sv"/);
    expect(otherEnglish).toMatch(/<main[^>]*lang="sv"/);
    expect(otherArabic).not.toContain(">AR</a>");
    expect(otherEnglish).not.toContain(">EN</a>");
    expect(otherEnglish).toContain("Ange din verifieringskod");
    expect(mocks.experience).toHaveBeenNthCalledWith(1, workspaceId);
    expect(mocks.experience).toHaveBeenNthCalledWith(2, otherWorkspaceId);
    expect(mocks.experience).toHaveBeenNthCalledWith(3, otherWorkspaceId);
  });

  it("keeps Maria Production gated by workspace language settings", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = await markup("en");
    expect(html).toMatch(/<main[^>]*lang="sv"/);
    expect(html).not.toContain(">EN</a>");
  });

  it("continues to support Arabic in both verification forms only in Maria Preview", async () => {
    const html = await markup("ar");
    expect(html).toMatch(/<main[^>]*lang="ar"[^>]*dir="rtl"/);
    expect(html).toMatch(/<h1\b[^>]*>أدخل رمز التحقق<\/h1>/);
    const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? [];
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).toMatch(/<input\b[^>]*type="hidden"[^>]*name="lang"[^>]*value="ar"/);
    }
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await markup("ar")).toMatch(/<main[^>]*lang="sv"/);
  });
});
