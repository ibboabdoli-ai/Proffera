import { createHash, randomBytes } from "node:crypto";

export function createVerifiedReviewToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVerifiedReviewToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
