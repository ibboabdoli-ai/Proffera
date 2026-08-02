import { describe, expect, it } from "vitest";

import {
  createPublicWorkspaceQuoteOfferToken,
  hashPublicWorkspaceQuoteOfferToken,
  isPublicWorkspaceQuoteOfferToken,
  publicWorkspaceQuoteOfferPath,
} from "./workspace-quote-offer-public";

describe("public workspace quote offer token", () => {
  it("creates a URL-safe 256-bit token", () => {
    const token = createPublicWorkspaceQuoteOfferToken();

    expect(isPublicWorkspaceQuoteOfferToken(token)).toBe(true);
    expect(token).toHaveLength(43);
  });

  it("stores a deterministic SHA-256 hex digest instead of the raw token", () => {
    expect(hashPublicWorkspaceQuoteOfferToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects malformed tokens and URL-encodes the public path", () => {
    expect(isPublicWorkspaceQuoteOfferToken("raw-token")).toBe(false);
    expect(isPublicWorkspaceQuoteOfferToken("x".repeat(44))).toBe(false);
    expect(publicWorkspaceQuoteOfferPath("a/b")).toBe("/offert/a%2Fb");
  });
});
