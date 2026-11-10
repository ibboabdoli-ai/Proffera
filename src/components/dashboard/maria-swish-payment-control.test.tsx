import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ManualSwishEntry } from "@/lib/maria-manual-swish";

vi.mock("@/app/dashboard/maria/payment-actions", () => ({
  recordMariaSwishPaymentAction: vi.fn(),
}));

import { MariaSwishPaymentControl } from "./maria-swish-payment-control";

const bookingId = "12345678-1234-4234-8234-123456789abc";
const legacyReference = `MBM-${bookingId.replaceAll("-", "").toUpperCase()}`;
const shortReference = "MBM-2026111301";

function render(readOk: boolean, entry?: ManualSwishEntry, isEnglish = false, bookingStatus = "requested") {
  return renderToStaticMarkup(createElement(MariaSwishPaymentControl, {
    bookingId, bookingStatus, readOk, entry, returnTo: "detail", isEnglish,
  }));
}

describe("Maria dashboard Swish reference read failures", () => {
  it("does not show or allow copying a fallback reference when the status read fails", () => {
    const html = render(false, undefined, false, "confirmed");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Betalningsstatus kunde inte läsas.");
    expect(html).not.toContain(legacyReference);
    expect(html).not.toContain("Bokningsnummer · Swish");
    expect(html).not.toContain("Jämför bokningsnumret");
    expect(html).not.toContain("Kopiera bokningsnummer");
    expect(html).not.toContain("Markera som betald");
  });

  it("does not expose even a stale supplied reference when readOk is false", () => {
    const html = render(false, { state: "unverified", markedAt: "", reference: shortReference }, true);
    expect(html).toContain("Cannot read payment status.");
    expect(html).not.toContain(shortReference);
    expect(html).not.toContain(legacyReference);
    expect(html).not.toContain("Compare this booking number");
    expect(html).not.toContain("Copy booking number");
  });

  it("uses the persisted short reference after a successful read", () => {
    const html = render(true, { state: "unverified", markedAt: "", reference: shortReference });
    expect(html).toContain(shortReference);
    expect(html).toContain('aria-label="Kopiera bokningsnummer"');
    expect(html).toContain("Jämför bokningsnumret");
    expect(html).not.toContain(legacyReference);
  });

  it("keeps the legacy reference only when a successful read finds none", () => {
    const html = render(true);
    expect(html).toContain(legacyReference);
    expect(html).toContain('aria-label="Kopiera bokningsnummer"');
    expect(html).not.toContain('role="alert"');
  });
});
