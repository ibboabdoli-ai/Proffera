import { createHash, randomBytes } from "node:crypto";

const publicQuoteOfferTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createPublicWorkspaceQuoteOfferToken() {
  return randomBytes(32).toString("base64url");
}

export function isPublicWorkspaceQuoteOfferToken(value: string) {
  return publicQuoteOfferTokenPattern.test(value);
}

export function hashPublicWorkspaceQuoteOfferToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function publicWorkspaceQuoteOfferPath(token: string) {
  return `/offert/${encodeURIComponent(token)}`;
}

export function publicWorkspaceQuoteOfferPdfPath(token: string) {
  return `${publicWorkspaceQuoteOfferPath(token)}/pdf`;
}
