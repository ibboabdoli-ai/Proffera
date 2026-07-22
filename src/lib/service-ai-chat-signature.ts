import { createHmac, timingSafeEqual } from "node:crypto";

export function signServiceAiChatRequest(timestamp: string, body: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function isMatchingServiceAiChatSignature(timestamp: string, body: string, signature: string, secret: string) {
  const expected = signServiceAiChatRequest(timestamp, body, secret);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
