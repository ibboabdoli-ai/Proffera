import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  createPublicWorkspaceQuoteOfferPdf,
  publicWorkspaceQuoteOfferPdfFilename,
} from "./workspace-quote-offer-pdf";

const offer = {
  status: "sent" as const,
  companyName: "Nordic Service AB",
  quoteReferenceId: "OFF-2026-001",
  customerName: "Ada Lovelace",
  currency: "SEK",
  subtotalMinor: 10000,
  vatRateBasisPoints: 2500,
  vatAmountMinor: 2500,
  totalMinor: 12500,
  title: "Fönsterputsning",
  terms: "Arbetet utförs enligt överenskommen tid. Kunden ansvarar för tillträde till fastigheten.",
  validUntil: "2026-08-31",
  sentAt: "2026-08-02T12:00:00.000Z",
  acceptedAt: "",
  rejectedAt: "",
};

describe("public workspace quote offer PDF", () => {
  it("creates a valid PDF with document metadata", async () => {
    const bytes = await createPublicWorkspaceQuoteOfferPdf(offer, "sv");
    const pdf = await PDFDocument.load(bytes);

    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Offert OFF-2026-001");
    expect(pdf.getAuthor()).toBe("Nordic Service AB");
  });

  it("flows long terms onto a continuation page", async () => {
    const bytes = await createPublicWorkspaceQuoteOfferPdf({
      ...offer,
      terms: "Detaljerat villkor. ".repeat(800),
    }, "en");
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("creates a safe reference-only filename", () => {
    expect(publicWorkspaceQuoteOfferPdfFilename("A/B (Test)"))
      .toBe("offert-a-b-test.pdf");
  });
});
