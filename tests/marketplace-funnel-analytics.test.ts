import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  stateIndex: 0,
  stateOverrides: new Map<number, unknown>(),
  routeSearch: "",
  redirectedTo: null as string | null,
  dispatched: [] as unknown[],
}));

const mocks = vi.hoisted(() => ({
  submitQuoteRequest: vi.fn(),
  directorySearch: vi.fn(),
  getLocationSuggestions: vi.fn(),
  getServiceJobForGuestToken: vi.fn(),
  selectCustomerOffer: vi.fn(),
  allowPublicSubmission: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useRef: (initialValue: unknown) => ({ current: initialValue }),
    useState: (initialValue: unknown) => {
      const index = runtime.stateIndex;
      runtime.stateIndex += 1;
      const fallback = typeof initialValue === "function"
        ? (initialValue as () => unknown)()
        : initialValue;
      const value = runtime.stateOverrides.has(index)
        ? runtime.stateOverrides.get(index)
        : fallback;
      return [value, vi.fn()];
    },
    useTransition: () => [false, (callback: () => void) => callback()],
  };
});

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(runtime.routeSearch),
  redirect: (url: string) => {
    runtime.redirectedTo = url;
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("lucide-react", () => ({
  AlertCircle: () => null,
  CheckCircle2: () => null,
  LoaderCircle: () => null,
  Navigation: () => null,
  ShieldCheck: () => null,
  Sparkles: () => null,
  Star: () => null,
}));

vi.mock("@/features/quote-request/actions", () => ({
  submitQuoteRequest: mocks.submitQuoteRequest,
}));
vi.mock("@/features/quote-request/form-copy", () => {
  const copy = {
    steps: ["Service", "Details", "Location", "Description", "Contact", "Review"],
    descriptionTooLong: "Too long",
    serverError: "Server error",
    sent: "Sent",
    sentText: "Sent text",
    reference: "Reference",
    website: "Website",
    step: "Step",
    of: "of",
    back: "Back",
    next: "Next",
    sending: "Sending",
    submit: "Submit",
  };
  return { quoteFormCopy: { sv: copy, en: copy } };
});
vi.mock("@/features/quote-request/schema", () => ({
  initialQuoteRequest: {
    category: "cleaning",
    serviceType: "home-cleaning",
    addressLine1: "Test 1",
    city: "Stockholm",
    postalCode: "111 11",
    locationSource: "address",
    latitude: null,
    longitude: null,
    description: "safe description",
    preferredDate: "",
    contactName: "Test",
    contactEmail: "test@example.com",
    contactPhone: "0700000000",
    consentAccepted: true,
  },
  sanitizeQuoteRequestPrefill: () => ({}),
  createQuoteRequestSchema: () => ({ safeParse: () => ({ success: true }) }),
}));
vi.mock("@/features/quote-request/smart-quote-questions", () => ({
  getSmartQuoteQuestions: () => [],
  validateSmartQuoteAnswers: () => ({}),
  buildSmartQuoteDescription: () => "safe description",
}));
for (const modulePath of [
  "@/features/quote-request/step-contact",
  "@/features/quote-request/step-description",
  "@/features/quote-request/step-location",
  "@/features/quote-request/step-review",
  "@/features/quote-request/step-service",
  "@/features/quote-request/step-smart-details",
]) {
  vi.mock(modulePath, () => ({
    QuoteContactStep: () => null,
    QuoteDescriptionStep: () => null,
    QuoteLocationStep: () => null,
    QuoteReviewStep: () => null,
    QuoteServiceStep: () => null,
    QuoteSmartDetailsStep: () => null,
  }));
}

vi.mock("@/lib/business-profile-search", () => ({
  searchPublishedBusinessProfiles: mocks.directorySearch,
}));
vi.mock("@/lib/public-read-cache", () => ({
  getCachedPublishedDirectoryLocationSuggestions: mocks.getLocationSuggestions,
}));
vi.mock("@/components/company-directory/public-directory-copy", () => {
  const copy = {
    eyebrow: "Directory",
    title: "Directory",
    intro: "Directory intro",
    nearbyNotice: () => "Nearby",
    addressNotice: "Address",
    popular: "Popular",
    popularLead: "Popular lead",
    badPosition: "Bad position",
  };
  return {
    directoryCopy: { sv: copy, en: copy },
    directoryPaths: { sv: { search: "/foretag" }, en: { search: "/en/companies" } },
    directoryServiceLabel: (_slug: string, label: string) => label,
    normalizeDirectoryPublicServiceQuery: (value: string) => value,
    popularDirectoryServices: [],
  };
});
vi.mock("@/components/company-directory/public-directory-results", () => ({
  PublicDirectoryResults: () => null,
}));
vi.mock("@/components/company-directory/public-directory-search-form", () => ({
  PublicDirectorySearchForm: () => null,
}));
vi.mock("@/lib/company-directory-public-search", () => ({
  normalizeDirectorySearchSort: () => "relevance",
}));
vi.mock("@/lib/company-directory-service-taxonomy", () => ({ DIRECTORY_SERVICES: [] }));
vi.mock("@/lib/public-directory-nearby", () => ({
  parsePublicDirectoryNearbyValue: () => null,
  publicDirectoryNearbyCookieName: () => "nearby",
}));

vi.mock("@/lib/marketplace-service-jobs", () => ({
  getMarketplaceServiceJobForGuestToken: mocks.getServiceJobForGuestToken,
}));
vi.mock("@/lib/marketplace-customer-comparison", () => ({
  hashMarketplaceCustomerComparisonToken: (token: string) => `hash:${token}`,
  marketplaceCustomerComparisonPath: (token: string) => `/offert/jamfor/${encodeURIComponent(token)}`,
  selectMarketplaceCustomerOffer: mocks.selectCustomerOffer,
}));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));

import MarketplaceProviderJobLayout from "@/app/offert/jobb/[token]/layout";
import MarketplaceCustomerJobLayout from "@/app/offert/jobb/kund/[token]/layout";
import { selectMarketplaceCustomerOfferAction } from "@/app/offert/jamfor/[token]/actions";
import MarketplaceGuestQuoteLayout from "@/app/offert/svara/[token]/layout";
import { VerifiedReviewForm } from "@/app/review/[token]/verified-review-form";
import {
  emitMarketplaceFunnelEvent,
  MarketplaceFunnelSignal,
} from "@/components/analytics/marketplace-funnel-signal";
import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";
import { PublicDirectorySearchPage } from "@/components/company-directory/public-directory-search-page";
import { LocalizedQuoteRequestForm } from "@/features/quote-request/localized-quote-request-form";
import {
  MARKETPLACE_FUNNEL_EVENT_NAMES,
  buildMarketplaceFunnelPostHogEvent,
  sanitizeMarketplaceFunnelEventInput,
  sanitizeMarketplaceFunnelPostHogEvent,
} from "@/lib/analytics/marketplace-funnel-events";
import { sanitizePostHogEvent } from "@/lib/analytics/posthog-send-boundary";

type ElementLike = {
  type: unknown;
  props: Record<string, unknown>;
};

type DispatchDetail = {
  event: string;
  properties?: Record<string, unknown>;
};

class TestFormData {
  private readonly values = new Map<string, string>();

  constructor(form?: unknown) {
    if (!form || typeof form !== "object") return;
    const entries = (form as { __entries?: Record<string, string> }).__entries;
    if (!entries) return;
    for (const [key, value] of Object.entries(entries)) this.values.set(key, value);
  }

  get(name: string) {
    return this.values.get(name) ?? null;
  }

  set(name: string, value: string) {
    this.values.set(name, value);
  }
}

class TestCustomEvent {
  readonly type: string;
  readonly detail: unknown;

  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

function installBrowserGlobals() {
  const storage = new Map<string, string>();
  const location = {
    href: "https://preview.proffera.test/test",
    pathname: "/test",
    search: "",
    hash: "",
    assign: vi.fn(),
    replace: vi.fn(),
  };

  vi.stubGlobal("window", {
    location,
    history: { replaceState: vi.fn() },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    dispatchEvent: (event: unknown) => {
      runtime.dispatched.push(event);
      return true;
    },
    setTimeout: (callback: () => void) => {
      callback();
      return 1;
    },
    clearTimeout: vi.fn(),
    requestAnimationFrame: (callback: () => void) => {
      callback();
      return 1;
    },
    cancelAnimationFrame: vi.fn(),
  });
  vi.stubGlobal("CustomEvent", TestCustomEvent);
  vi.stubGlobal("FormData", TestFormData);
  vi.stubGlobal("fetch", mocks.fetch);
}

function resetHooks(overrides: ReadonlyMap<number, unknown> = new Map()) {
  runtime.stateIndex = 0;
  runtime.stateOverrides = new Map(overrides);
}

function asElement(value: unknown): ElementLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { type?: unknown; props?: unknown };
  if (!("type" in candidate) || !candidate.props || typeof candidate.props !== "object") return null;
  return { type: candidate.type, props: candidate.props as Record<string, unknown> };
}

function findElements(root: unknown, type: unknown): ElementLike[] {
  const found: ElementLike[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    const element = asElement(value);
    if (!element) return;
    if (element.type === type) found.push(element);
    visit(element.props.children);
  };
  visit(root);
  return found;
}

function invokeElement(element: ElementLike) {
  if (typeof element.type !== "function") throw new Error("Expected function component");
  return (element.type as (props: Record<string, unknown>) => unknown)(element.props);
}

function setRouteSearch(query: string) {
  runtime.routeSearch = query.replace(/^\?/, "");
  const search = runtime.routeSearch ? `?${runtime.routeSearch}` : "";
  Object.assign(window.location, {
    href: `https://preview.proffera.test/test${search}`,
    pathname: "/test",
    search,
    hash: "",
  });
}

function emitRouteSignal(element: ElementLike, query: string) {
  setRouteSearch(query);
  resetHooks();
  const gated = invokeElement(element);
  const signal = asElement(gated);
  if (!signal) return;
  resetHooks();
  invokeElement(signal);
}

function capturedDetails(): DispatchDetail[] {
  return runtime.dispatched
    .map((event) => (event as { detail?: unknown }).detail)
    .filter((detail): detail is DispatchDetail => Boolean(detail) && typeof detail === "object");
}

function clearCaptured() {
  runtime.dispatched.length = 0;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function findButton(root: unknown, label: string) {
  const button = findElements(root, "button").find((element) => element.props.children === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  runtime.routeSearch = "";
  runtime.redirectedTo = null;
  clearCaptured();
  resetHooks();
  installBrowserGlobals();

  mocks.getLocationSuggestions.mockResolvedValue([]);
  mocks.getServiceJobForGuestToken.mockResolvedValue(null);
  mocks.allowPublicSubmission.mockResolvedValue(true);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Marketplace launch-funnel analytics contract", () => {
  it("keeps the event taxonomy bounded to the approved launch funnel", () => {
    expect(MARKETPLACE_FUNNEL_EVENT_NAMES).toEqual([
      "marketplace_discovery_search_completed",
      "marketplace_request_submitted",
      "marketplace_invitation_outcome",
      "marketplace_provider_offer_submitted",
      "marketplace_customer_selection_completed",
      "marketplace_service_job_completed",
      "marketplace_verified_review_submitted",
    ]);
  });

  it("drops arbitrary and sensitive caller properties while preserving coarse allowlisted values", () => {
    const event = buildMarketplaceFunnelPostHogEvent({
      event: "marketplace_discovery_search_completed",
      properties: {
        locale: "sv",
        result_band: "6-20",
        email: "person@example.com",
        phone: "+46700000000",
        organization_number: "5561234567",
        address: "Secret 1",
        latitude: 59.3,
        longitude: 18.0,
        quote_request_id: "11111111-1111-4111-8111-111111111111",
        workspace_id: "22222222-2222-4222-8222-222222222222",
        service_job_id: "33333333-3333-4333-8333-333333333333",
        provider_id: "provider-secret",
        claim_id: "claim-secret",
        url: "https://example.test/path?token=secret#fragment",
        referrer: "https://example.test/private",
        free_text: "private details",
      },
    }, "preview");

    expect(event).toEqual({
      event: "marketplace_discovery_search_completed",
      properties: {
        locale: "sv",
        result_band: "6-20",
        proffera_environment: "preview",
        $process_person_profile: false,
      },
    });
  });

  it("fails closed for unknown events, invalid environments and malformed properties", () => {
    expect(sanitizeMarketplaceFunnelEventInput({ event: "identify", properties: {} })).toBeNull();
    expect(sanitizeMarketplaceFunnelEventInput({ event: "marketplace_request_submitted", properties: "bad" })).toBeNull();
    expect(buildMarketplaceFunnelPostHogEvent({ event: "marketplace_request_submitted" }, "production")).not.toBeNull();
    expect(buildMarketplaceFunnelPostHogEvent({ event: "marketplace_request_submitted" }, "preview")).not.toBeNull();
    expect(sanitizeMarketplaceFunnelPostHogEvent({
      event: "marketplace_request_submitted",
      properties: { proffera_environment: "development" },
    })).toBeNull();
  });

  it("preserves only anonymous PostHog identity fields added by the SDK at the final boundary", () => {
    const sanitized = sanitizePostHogEvent({
      event: "marketplace_provider_offer_submitted",
      properties: {
        locale: "en",
        proffera_environment: "production",
        distinct_id: "anonymous-distinct-id",
        $device_id: "anonymous-device-id",
        $session_id: "anonymous-session-id",
        $window_id: "anonymous-window-id",
        token: "phc_abcdefghijklmnopqrstuvwxyz1234567890",
        email: "must-not-pass@example.com",
        $set: { email: "must-not-pass@example.com" },
      },
    });

    expect(sanitized).toEqual({
      event: "marketplace_provider_offer_submitted",
      properties: {
        locale: "en",
        proffera_environment: "production",
        $process_person_profile: false,
        distinct_id: "anonymous-distinct-id",
        $device_id: "anonymous-device-id",
        $session_id: "anonymous-session-id",
        $window_id: "anonymous-window-id",
        token: "phc_abcdefghijklmnopqrstuvwxyz1234567890",
      },
    });
  });

  it("emits discovery analytics only after a real search result exists", async () => {
    const idle = await PublicDirectorySearchPage({ locale: "sv", searchParams: Promise.resolve({}) });
    expect(findElements(idle, MarketplaceFunnelSignal)).toHaveLength(0);
    expect(capturedDetails()).toHaveLength(0);

    mocks.directorySearch.mockResolvedValue({
      totalCount: 7,
      nearbyEnabled: false,
      nearbyRequested: false,
      radiusKm: 25,
    });
    const searched = await PublicDirectorySearchPage({
      locale: "sv",
      searchParams: Promise.resolve({ service: "cleaning" }),
    });
    const signals = findElements(searched, MarketplaceFunnelSignal);
    expect(signals).toHaveLength(1);

    resetHooks();
    invokeElement(signals[0]);
    expect(capturedDetails()).toEqual([
      {
        event: "marketplace_discovery_search_completed",
        properties: { locale: "sv", result_band: "6-20" },
      },
    ]);
  });

  it("emits request-submitted exactly once on persisted success and never on failure", async () => {
    mocks.submitQuoteRequest.mockResolvedValueOnce({ ok: false, errors: { form: "failed" } });
    resetHooks(new Map([[0, 5]]));
    const failedTree = LocalizedQuoteRequestForm({ locale: "sv" });
    const failedSubmit = findButton(failedTree, "Submit").props.onClick as () => void;
    failedSubmit();
    await flushMicrotasks();
    expect(capturedDetails()).toHaveLength(0);

    mocks.submitQuoteRequest.mockResolvedValueOnce({ ok: true, referenceId: "RQ-safe-reference" });
    resetHooks(new Map([[0, 5]]));
    const successTree = LocalizedQuoteRequestForm({ locale: "sv" });
    const successSubmit = findButton(successTree, "Submit").props.onClick as () => void;
    successSubmit();
    await flushMicrotasks();
    expect(capturedDetails()).toEqual([
      { event: "marketplace_request_submitted", properties: { locale: "sv" } },
    ]);
  });

  it("emits invitation and provider-offer events only for their persisted route markers", async () => {
    const tree = await MarketplaceGuestQuoteLayout({
      children: null,
      params: Promise.resolve({ token: "guest-token" }),
    });
    const routeSignals = findElements(tree, MarketplaceRouteFunnelSignal);
    const invitation = routeSignals.find((element) => element.props.event === "marketplace_invitation_outcome");
    const offer = routeSignals.find((element) => element.props.event === "marketplace_provider_offer_submitted");
    if (!invitation || !offer) throw new Error("Expected guest funnel route signals");

    emitRouteSignal(invitation, "status=failed&email=private%40example.com");
    emitRouteSignal(offer, "status=failed&provider_id=secret");
    expect(capturedDetails()).toHaveLength(0);

    emitRouteSignal(invitation, "source=invitation&email=private%40example.com");
    expect(capturedDetails()).toEqual([
      {
        event: "marketplace_invitation_outcome",
        properties: { outcome: "invited", locale: "sv" },
      },
    ]);

    clearCaptured();
    emitRouteSignal(offer, "status=sent&provider_id=secret");
    expect(capturedDetails()).toEqual([
      { event: "marketplace_provider_offer_submitted", properties: { locale: "sv" } },
    ]);
  });

  it("emits customer-selection only after the persisted selection succeeds", async () => {
    const formData = new FormData();
    formData.set("offerId", "internal-offer-id");
    formData.set("lang", "en");

    mocks.selectCustomerOffer.mockResolvedValueOnce({ ok: false, code: "not_selectable" });
    await expect(selectMarketplaceCustomerOfferAction("customer-token", formData)).rejects.toThrow("NEXT_REDIRECT");
    const failureUrl = new URL(runtime.redirectedTo ?? "", "https://preview.proffera.test");
    const customerTree = MarketplaceCustomerJobLayout({ children: null });
    const selectionSignal = findElements(customerTree, MarketplaceRouteFunnelSignal)[0];
    emitRouteSignal(selectionSignal, failureUrl.search);
    expect(capturedDetails()).toHaveLength(0);

    runtime.redirectedTo = null;
    mocks.selectCustomerOffer.mockResolvedValueOnce({ ok: true });
    await expect(selectMarketplaceCustomerOfferAction("customer-token", formData)).rejects.toThrow("NEXT_REDIRECT");
    const successUrl = new URL(runtime.redirectedTo ?? "", "https://preview.proffera.test");
    expect(successUrl.pathname).toBe("/offert/jobb/kund/customer-token");
    emitRouteSignal(selectionSignal, successUrl.search);
    expect(capturedDetails()).toEqual([
      { event: "marketplace_customer_selection_completed", properties: { locale: "en" } },
    ]);
  });

  it("emits service-job completion only for the persisted completion route marker", () => {
    const tree = MarketplaceProviderJobLayout({ children: null });
    const completionSignal = findElements(tree, MarketplaceRouteFunnelSignal)[0];

    emitRouteSignal(completionSignal, "job=failed&service_job_id=secret");
    expect(capturedDetails()).toHaveLength(0);

    emitRouteSignal(completionSignal, "job=completed&service_job_id=secret");
    expect(capturedDetails()).toEqual([
      { event: "marketplace_service_job_completed", properties: { locale: "sv" } },
    ]);
  });

  it("emits verified-review exactly once after a successful persisted response and never on failure", async () => {
    const form = {
      __entries: {
        reviewer_name: "Private Name",
        message: "Private free text that must never reach analytics",
        consent: "true",
        website: "",
      },
      reset: vi.fn(),
    };
    const event = { preventDefault: vi.fn(), currentTarget: form };

    mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "failed" }) });
    resetHooks(new Map([[0, 5]]));
    const failedTree = VerifiedReviewForm({
      token: "private-review-token",
      customerName: "Private Name",
      service: "Cleaning",
      area: "Private address",
      companyName: "Provider",
      language: "en",
      primaryColor: "#17452f",
    });
    const failedForm = findElements(failedTree, "form")[0];
    const failedSubmit = failedForm.props.onSubmit as (input: unknown) => Promise<void>;
    await failedSubmit(event);
    expect(capturedDetails()).toHaveLength(0);

    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    resetHooks(new Map([[0, 5]]));
    const successTree = VerifiedReviewForm({
      token: "private-review-token",
      customerName: "Private Name",
      service: "Cleaning",
      area: "Private address",
      companyName: "Provider",
      language: "en",
      primaryColor: "#17452f",
    });
    const successForm = findElements(successTree, "form")[0];
    const successSubmit = successForm.props.onSubmit as (input: unknown) => Promise<void>;
    await successSubmit(event);
    expect(capturedDetails()).toEqual([
      { event: "marketplace_verified_review_submitted", properties: { locale: "en" } },
    ]);
  });

  it("the browser emitter itself strips sensitive properties before dispatch", () => {
    const emitted = emitMarketplaceFunnelEvent({
      event: "marketplace_provider_offer_submitted",
      properties: {
        locale: "en",
        price_kind: "fixed",
        email: "private@example.com",
        organization_number: "5561234567",
        address: "Private 1",
        latitude: 59.3,
        longitude: 18.0,
        quote_request_id: "quote-secret",
        workspace_id: "workspace-secret",
        service_job_id: "job-secret",
        provider_id: "provider-secret",
        claim_id: "claim-secret",
        url: "https://preview.proffera.test/private?token=secret#fragment",
        referrer: "https://private.example.test",
        free_text: "must not pass",
      },
    });

    expect(emitted).toBe(true);
    expect(capturedDetails()).toEqual([
      {
        event: "marketplace_provider_offer_submitted",
        properties: { locale: "en", price_kind: "fixed" },
      },
    ]);
  });
});
