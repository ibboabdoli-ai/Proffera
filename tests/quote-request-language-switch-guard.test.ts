import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  stateIndex: 0,
  stateOverrides: new Map<number, unknown>(),
  refIndex: 0,
  refs: new Map<number, { current: unknown }>(),
}));

const mocks = vi.hoisted(() => ({
  submitQuoteRequest: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useRef: (initialValue: unknown) => {
      const index = runtime.refIndex;
      runtime.refIndex += 1;
      const existing = runtime.refs.get(index);
      if (existing) return existing;
      const created = { current: initialValue };
      runtime.refs.set(index, created);
      return created;
    },
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

vi.mock("lucide-react", () => ({ CheckCircle2: () => null }));
vi.mock("@/components/analytics/marketplace-funnel-signal", () => ({
  emitMarketplaceFunnelEvent: vi.fn(() => true),
}));
vi.mock("@/features/quote-request/actions", () => ({ submitQuoteRequest: mocks.submitQuoteRequest }));
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
vi.mock("@/features/quote-request/step-contact", () => ({ QuoteContactStep: () => null }));
vi.mock("@/features/quote-request/step-description", () => ({ QuoteDescriptionStep: () => null }));
vi.mock("@/features/quote-request/step-location", () => ({ QuoteLocationStep: () => null }));
vi.mock("@/features/quote-request/step-review", () => ({ QuoteReviewStep: () => null }));
vi.mock("@/features/quote-request/step-service", () => ({ QuoteServiceStep: () => null }));
vi.mock("@/features/quote-request/step-smart-details", () => ({ QuoteSmartDetailsStep: () => null }));

import { LocalizedQuoteRequestForm } from "@/features/quote-request/localized-quote-request-form";

type ElementLike = { type: unknown; props: Record<string, unknown> };

function resetHooks(overrides: ReadonlyMap<number, unknown> = new Map()) {
  runtime.stateIndex = 0;
  runtime.refIndex = 0;
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

function findButton(root: unknown, label: string) {
  const button = findElements(root, "button").find((element) => element.props.children === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("Quote-request language switch guard", () => {
  const storage = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => storage.set(key, value));
  const removeItem = vi.fn((key: string) => storage.delete(key));
  const assign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    runtime.refs.clear();
    resetHooks();

    vi.stubGlobal("window", {
      location: {
        href: "https://preview.proffera.test/offert",
        origin: "https://preview.proffera.test",
        pathname: "/offert",
        search: "",
        hash: "",
        assign,
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem,
        removeItem,
      },
      requestAnimationFrame: (callback: () => void) => {
        callback();
        return 1;
      },
      cancelAnimationFrame: vi.fn(),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("blocks locale navigation and draft writes while submission is unresolved, then restores switching after settlement", async () => {
    let resolveRequest!: (value: { ok: true; referenceId: string }) => void;
    const request = new Promise<{ ok: true; referenceId: string }>((resolve) => {
      resolveRequest = resolve;
    });
    mocks.submitQuoteRequest.mockReturnValue(request);

    resetHooks(new Map([[0, 5]]));
    const tree = LocalizedQuoteRequestForm({
      locale: "sv",
      alternateLocaleHref: "/en/quote",
      alternateLocaleLabel: "English",
    });
    const submit = findButton(tree, "Submit").props.onClick as () => void;
    const switchLocale = findButton(tree, "English").props.onClick as () => void;

    submit();
    switchLocale();

    expect(setItem).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();

    resolveRequest({ ok: true, referenceId: "RQ-safe" });
    await flushMicrotasks();

    switchLocale();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/en/quote");
  });

  it("disables the locale control while the submission state is pending", () => {
    resetHooks(new Map<number, unknown>([
      [0, 5],
      [8, true],
    ]));
    const tree = LocalizedQuoteRequestForm({
      locale: "en",
      alternateLocaleHref: "/offert",
      alternateLocaleLabel: "Svenska",
    });

    expect(findButton(tree, "Svenska").props.disabled).toBe(true);
  });
});
