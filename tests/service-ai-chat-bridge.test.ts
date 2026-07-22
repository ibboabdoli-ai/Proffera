import { describe, expect, it } from "vitest";

import { isMatchingServiceAiChatSignature, signServiceAiChatRequest } from "../src/lib/service-ai-chat-signature";

describe("Service AI Chat bridge signatures", () => {
  it("accepts the exact timestamp and body that were signed", () => {
    const timestamp = "2026-07-22T12:00:00.000Z";
    const body = '{"action":"provision","workspaceId":"workspace-1"}';
    const secret = "test-secret";
    const signature = signServiceAiChatRequest(timestamp, body, secret);

    expect(isMatchingServiceAiChatSignature(timestamp, body, signature, secret)).toBe(true);
  });

  it("rejects a signature when the body changes", () => {
    const timestamp = "2026-07-22T12:00:00.000Z";
    const secret = "test-secret";
    const signature = signServiceAiChatRequest(timestamp, '{"action":"provision"}', secret);

    expect(isMatchingServiceAiChatSignature(timestamp, '{"action":"activation_link"}', signature, secret)).toBe(false);
  });
});
