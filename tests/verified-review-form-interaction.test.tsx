import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useState: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useEffect: reactMocks.useEffect,
    useRef: reactMocks.useRef,
    useState: reactMocks.useState,
  };
});
vi.mock("@/components/analytics/marketplace-funnel-signal", () => ({
  emitMarketplaceFunnelEvent: vi.fn(),
}));

import { VerifiedReviewForm } from "@/app/review/[token]/verified-review-form";

type ElementLike = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};

type Locale = "sv" | "en";

type FailedResponse = {
  ok: false;
  status: number;
};

const localizedFailureCases: ReadonlyArray<readonly [number, Locale, string]> = [
  [400, "sv", "Kontrollera formuläret och försök igen."],
  [404, "sv", "Omdömeslänken kan inte användas längre."],
  [409, "sv", "Omdömet kan inte skickas i det här läget."],
  [429, "sv", "För många försök. Vänta en stund och försök igen."],
  [503, "sv", "Omdömet kunde inte sparas just nu. Försök igen senare."],
  [400, "en", "Check the form and try again."],
  [404, "en", "This review link can no longer be used."],
  [409, "en", "This review cannot be submitted in its current state."],
  [429, "en", "Too many attempts. Wait a while and try again."],
  [503, "en", "The review could not be saved right now. Please try again later."],
];

let stateValues: unknown[];
let stateCursor: number;

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value: T) {
      if (!resolvePromise) throw new Error("Deferred promise was not initialized.");
      resolvePromise(value);
    },
  };
}

function isElementLike(value: unknown): value is ElementLike {
  return typeof value === "object" && value !== null && "props" in value;
}

function textContent(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (!isElementLike(node)) return "";
  return textContent(node.props.children);
}

function findSubmitButton(node: unknown): ElementLike | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findSubmitButton(child);
      if (match) return match;
    }
    return null;
  }
  if (!isElementLike(node)) return null;
  if (node.type === "button" && node.props.type === "submit") return node;
  return findSubmitButton(node.props.children);
}

function renderReviewForm(language: Locale): ElementLike {
  stateCursor = 0;
  return VerifiedReviewForm({
    token: "review-token",
    customerName: "Anna",
    service: "Window cleaning",
    area: "Stockholm",
    companyName: "Nordic Fix AB",
    language,
    primaryColor: "#1469d8",
  }) as unknown as ElementLike;
}

beforeEach(() => {
  stateValues = [5, false, false, null];
  stateCursor = 0;
  reactMocks.useEffect.mockReset();
  reactMocks.useRef.mockReset();
  reactMocks.useState.mockReset();

  reactMocks.useEffect.mockImplementation((effect: () => void) => {
    effect();
  });
  reactMocks.useRef.mockImplementation((initialValue: unknown) => ({ current: initialValue }));
  reactMocks.useState.mockImplementation((initialValue: unknown) => {
    const slot = stateCursor++;
    if (slot >= stateValues.length) stateValues[slot] = initialValue;

    const setValue = (nextValue: unknown) => {
      stateValues[slot] =
        typeof nextValue === "function"
          ? (nextValue as (previousValue: unknown) => unknown)(stateValues[slot])
          : nextValue;
    };

    return [stateValues[slot], setValue];
  });

  class FakeFormData {
    constructor(_form?: unknown) {}

    get(name: string) {
      switch (name) {
        case "reviewer_name":
          return "Anna";
        case "message":
          return "A verified review with enough detail.";
        case "consent":
          return "true";
        case "website":
          return "";
        default:
          return null;
      }
    }
  }

  vi.stubGlobal("FormData", FakeFormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VerifiedReviewForm submission failures", () => {
  it.each(localizedFailureCases)(
    "renders the %s HTTP failure in %s with pending submit protection",
    async (status, language, expectedMessage) => {
      const pendingResponse = createDeferred<FailedResponse>();
      const fetchMock = vi.fn().mockReturnValue(pendingResponse.promise);
      vi.stubGlobal("fetch", fetchMock);

      const initialForm = renderReviewForm(language);
      const submit = initialForm.props.onSubmit;
      expect(typeof submit).toBe("function");

      const event = {
        preventDefault: vi.fn(),
        currentTarget: { reset: vi.fn() },
      } as unknown as FormEvent<HTMLFormElement>;

      const submitPromise = (submit as (event: FormEvent<HTMLFormElement>) => Promise<void>)(event);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const pendingForm = renderReviewForm(language);
      const pendingSubmitButton = findSubmitButton(pendingForm);
      expect(pendingSubmitButton).not.toBeNull();
      expect(pendingSubmitButton?.props.disabled).toBe(true);

      pendingResponse.resolve({ ok: false, status });
      await submitPromise;

      const rerenderedForm = renderReviewForm(language);
      expect(textContent(rerenderedForm)).toContain(expectedMessage);

      const submitButton = findSubmitButton(rerenderedForm);
      expect(submitButton).not.toBeNull();
      expect(submitButton?.props.disabled).toBe(false);
    },
  );
});
