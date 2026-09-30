import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  getProviderActivationState: vi.fn(),
  findProviderProfileByOrganizationNumber: vi.fn(),
  activateProviderMarketplaceService: vi.fn(),
  establishPreReleaseSoleTraderServiceBase: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));
vi.mock("@/lib/company-directory-provider-activation", () => ({
  getProviderActivationState: mocks.getProviderActivationState,
  findProviderProfileByOrganizationNumber: mocks.findProviderProfileByOrganizationNumber,
  activateProviderMarketplaceService: mocks.activateProviderMarketplaceService,
}));
vi.mock("@/lib/business-profile-location-owner", () => ({
  establishPreReleaseSoleTraderServiceBase: mocks.establishPreReleaseSoleTraderServiceBase,
}));

import MarketplaceActivationPage from "../src/app/dashboard/marknadsplats/page";

function walk(node: ReactNode, visit: (value: ReactNode) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isValidElement(node)) {
    visit(node);
    return;
  }
  visit(node);
  walk((node.props as { children?: ReactNode }).children, visit);
}

function inputNames(node: ReactNode) {
  const names: string[] = [];
  walk(node, (value) => {
    if (!isValidElement(value)) return;
    const name = (value.props as { name?: unknown }).name;
    if (typeof name === "string") names.push(name);
  });
  return names;
}

function renderedText(node: ReactNode) {
  const parts: string[] = [];
  walk(node, (value) => {
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
  });
  return parts.join(" ");
}

function activationFormAction(node: ReactNode) {
  const actions: Array<(formData: FormData) => Promise<unknown>> = [];
  walk(node, (value) => {
    if (!isValidElement(value) || value.type !== "form") return;
    const candidate = (value.props as { action?: unknown }).action;
    if (typeof candidate === "function" && inputNames(value).includes("serviceId")) {
      actions.push(candidate as (formData: FormData) => Promise<unknown>);
    }
  });
  const action = actions[0];
  if (!action) throw new Error("Marketplace activation form action was not rendered");
  return action;
}

function activationState(requiresPrivacyRelease: boolean) {
  return {
    linkedProfile: {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "owner-company-ab",
      companyName: "Owner Company AB",
      organizationNumber: "5560000000",
      city: "Södertälje",
      requiresPrivacyRelease,
    },
    pendingClaim: null,
    directoryServices: [{ slug: "hemstadning", label: "Hemstädning" }],
    workspaceServices: [{
      id: "33333333-3333-4333-8333-333333333333",
      name: "Hemstädning",
      isActive: true,
      publicStatus: "draft",
      publicSlug: "hemstadning",
      primaryDirectoryServiceSlug: "hemstadning",
      conversionMode: "book",
      serviceAreaConfirmed: false,
      serviceAreaRadiusKm: 25,
    }],
  };
}

describe("Marketplace service-base behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((target: string) => {
      throw new Error(`REDIRECT:${target}`);
    });
    mocks.getUserWorkspaceAccess.mockResolvedValue({
      ok: true,
      userId: "user-1",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workspaceSlug: "owner-company",
      workspaceName: "Owner Company",
      workspaceStatus: "active",
      role: "owner",
    });
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.activateProviderMarketplaceService.mockResolvedValue({ ok: true });
    mocks.establishPreReleaseSoleTraderServiceBase.mockResolvedValue({ ok: true });
  });

  it("renders service-base inputs only when privacy release requires them", async () => {
    mocks.getProviderActivationState.mockResolvedValueOnce(activationState(true));
    const privatePage = await MarketplaceActivationPage({ searchParams: Promise.resolve({}) });
    expect(inputNames(privatePage)).toEqual(expect.arrayContaining([
      "serviceBaseAddressLine1",
      "serviceBasePostalCode",
      "serviceBaseCity",
    ]));

    mocks.getProviderActivationState.mockResolvedValueOnce(activationState(false));
    const juridicalPage = await MarketplaceActivationPage({ searchParams: Promise.resolve({}) });
    expect(inputNames(juridicalPage)).not.toEqual(expect.arrayContaining([
      "serviceBaseAddressLine1",
      "serviceBasePostalCode",
      "serviceBaseCity",
    ]));
  });

  it("stops activation and redirects to service_base_error when service-base verification fails", async () => {
    mocks.getProviderActivationState.mockResolvedValueOnce(activationState(true));
    const page = await MarketplaceActivationPage({ searchParams: Promise.resolve({}) });
    const action = activationFormAction(page);

    mocks.establishPreReleaseSoleTraderServiceBase.mockRejectedValueOnce(new Error("verification failed"));
    const form = new FormData();
    form.set("requiresPrivacyRelease", "true");
    form.set("serviceBaseAddressLine1", "Storgatan 1");
    form.set("serviceBasePostalCode", "151 46");
    form.set("serviceBaseCity", "Södertälje");
    form.set("serviceId", "33333333-3333-4333-8333-333333333333");
    form.set("directoryServiceSlug", "hemstadning");
    form.set("conversionMode", "book");
    form.set("radiusKm", "25");

    await expect(action(form))
      .rejects.toThrow("REDIRECT:/dashboard/marknadsplats?status=service_base_error");
    expect(mocks.activateProviderMarketplaceService).not.toHaveBeenCalled();
  });

  it("renders service_base_error copy in Swedish and English", async () => {
    mocks.getProviderActivationState.mockResolvedValue(activationState(false));

    const sv = await MarketplaceActivationPage({
      searchParams: Promise.resolve({ status: "service_base_error" }),
    });
    expect(renderedText(sv)).toContain(
      "Adressen kunde inte verifieras. Kontrollera gatuadress, postnummer och ort, eller försök igen senare.",
    );

    const en = await MarketplaceActivationPage({
      searchParams: Promise.resolve({ lang: "en", status: "service_base_error" }),
    });
    expect(renderedText(en)).toContain(
      "The address could not be verified. Check the street address, postal code and city, or try again later.",
    );
  });
});
