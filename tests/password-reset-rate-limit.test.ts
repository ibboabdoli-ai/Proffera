import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allowPublicSubmission: vi.fn(),
  getAuth: vi.fn(),
  handlerGet: vi.fn(),
  handlerPost: vi.fn(),
  toNextJsHandler: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));
vi.mock("@/lib/auth", () => ({ getAuth: mocks.getAuth }));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: mocks.toNextJsHandler,
}));

import { POST } from "@/app/api/auth/[...all]/route";
import {
  checkPasswordResetRateLimit,
  PASSWORD_RESET_REQUEST_RATE_LIMIT,
  PASSWORD_RESET_SUBMIT_RATE_LIMIT,
} from "@/lib/password-reset-rate-limit";

describe("password reset shared rate limits", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getAuth.mockReturnValue({ id: "auth" });
    mocks.handlerGet.mockResolvedValue(new Response("ok"));
    mocks.handlerPost.mockResolvedValue(new Response("ok"));
    mocks.toNextJsHandler.mockReturnValue({
      GET: mocks.handlerGet,
      POST: mocks.handlerPost,
    });
  });

  it("uses the shared public-submission store for reset requests", async () => {
    mocks.allowPublicSubmission.mockResolvedValue(false);
    const request = new Request("https://www.proffera.se/api/auth/request-password-reset", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const result = await checkPasswordResetRateLimit(request);

    expect(PASSWORD_RESET_REQUEST_RATE_LIMIT).toEqual({ windowSeconds: 900, maxAttempts: 5 });
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith({
      scope: "auth_password_reset_request",
      requestHeaders: request.headers,
      maxAttempts: 5,
      windowSeconds: 900,
    });
  });

  it("uses the shared public-submission store for reset submissions", async () => {
    mocks.allowPublicSubmission.mockResolvedValue(true);
    const request = new Request("https://www.proffera.se/api/auth/reset-password", {
      method: "POST",
      headers: { "x-real-ip": "203.0.113.11" },
    });

    const result = await checkPasswordResetRateLimit(request);

    expect(PASSWORD_RESET_SUBMIT_RATE_LIMIT).toEqual({ windowSeconds: 900, maxAttempts: 10 });
    expect(result).toEqual({ allowed: true, retryAfterSeconds: null });
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith({
      scope: "auth_password_reset_submit",
      requestHeaders: request.headers,
      maxAttempts: 10,
      windowSeconds: 900,
    });
  });

  it.each([
    ["/api/auth/request-password-reset"],
    ["/api/auth/reset-password"],
  ])("returns 429 before Better Auth when the shared limiter blocks %s", async (path) => {
    mocks.allowPublicSubmission.mockResolvedValue(false);
    const response = await POST(new Request(`https://www.proffera.se${path}`, {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.12" },
    }) as never);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    await expect(response.json()).resolves.toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests.",
    });
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.handlerPost).not.toHaveBeenCalled();
  });

  it("delegates an allowed reset request to Better Auth", async () => {
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.handlerPost.mockResolvedValue(new Response("delegated", { status: 202 }));
    const request = new Request("https://www.proffera.se/api/auth/request-password-reset", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.13" },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("delegated");
    expect(mocks.getAuth).toHaveBeenCalledTimes(1);
    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });
});
