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

const failureCases = [
  [400, "Kontrollera formuläret och försök igen."],
  [404, "Omdömeslänken kan inte användas längre."],
  [409, "Omdömet kan inte skickas i det här läget."],
  [429, "För många försök. Vänta en stund och försök igen."],
  [503, "Omdömet kunde inte sparas just nu. Försök igen senare."],
] as const;

let stateValues: unknown[];
let stateCursor: number;

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

function renderReviewForm(): ElementLike {
  stateCursor = 0;
  return VerifiedReviewForm({
    token: "review-token",
    customerName: "Anna",
    service: "Window cleaning",
    area: "Stockholm",
    companyName: "Nordic Fix AB",
    language: "sv",
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
  it.each(failureCases)("renders the localized error for HTTP %s and re-enables submit", async (status, expectedMessage) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status });
    vi.stubGlobal("fetch", fetchMock);

    const initialForm = renderReviewForm();
    const submit = initialForm.props.onSubmit;
    expect(typeof submit).toBe("function");

    const event = {
      preventDefault: vi.fn(),
      currentTarget: { reset: vi.fn() },
    } as unknown as FormEvent<HTMLFormElement>;

    await (submit as (event: FormEvent<HTMLFormElement>) => Promise<void>)(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const rerenderedForm = renderReviewForm();
    expect(textContent(rerenderedForm)).toContain(expectedMessage);

    const submitButton = findSubmitButton(rerenderedForm);
    expect(submitButton).not.toBeNull();
    expect(submitButton?.props.disabled).toBe(false);
  });
});
