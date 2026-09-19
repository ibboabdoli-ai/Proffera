import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getSql: vi.fn(),
  sql: vi.fn(),
  createWorkspaceSlug: vi.fn(),
  provisionWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({
  getServerSession: routeMocks.getServerSession,
}));

vi.mock("@/lib/db/server", () => ({
  getSql: routeMocks.getSql,
}));

vi.mock("@/features/company/workspace-provisioning", () => ({
  createWorkspaceSlug: routeMocks.createWorkspaceSlug,
  provisionWorkspace: routeMocks.provisionWorkspace,
}));

import CreateAccountPage from "../src/app/skapa-konto/page";
import EnglishCreateAccountPage from "../src/app/en/create-account/page";
import { POST } from "../src/app/api/signup/provision/route";
import { submitSignup } from "../src/components/signup/signup-form";
import {
  passwordResetRedirectTo,
  submitPasswordResetRequest,
} from "../src/app/glomt-losenord/PasswordResetRequestForm";
import {
  readResetToken,
  resetCompletionLoginUrl,
  resetLocaleTarget,
  resetUrlWithoutFragment,
  submitResetPassword,
} from "../src/app/aterstall-losenord/ResetPasswordForm";

type SignupElement = React.ReactElement<{
  locale: "sv" | "en";
  initialPlan: "starter" | "professional";
}>;

describe("signup entry runtime behavior", () => {
  it("fixes locale per route and falls back invalid plans to starter", async () => {
    const svProfessional = await CreateAccountPage({
      searchParams: Promise.resolve({ plan: "professional" }),
    }) as SignupElement;
    const svInvalid = await CreateAccountPage({
      searchParams: Promise.resolve({ plan: "enterprise" }),
    }) as SignupElement;
    const enProfessional = await EnglishCreateAccountPage({
      searchParams: Promise.resolve({ plan: "professional" }),
    }) as SignupElement;
    const enInvalid = await EnglishCreateAccountPage({
      searchParams: Promise.resolve({ plan: "enterprise" }),
    }) as SignupElement;

    expect(svProfessional.props).toMatchObject({ locale: "sv", initialPlan: "professional" });
    expect(svInvalid.props).toMatchObject({ locale: "sv", initialPlan: "starter" });
    expect(enProfessional.props).toMatchObject({ locale: "en", initialPlan: "professional" });
    expect(enInvalid.props).toMatchObject({ locale: "en", initialPlan: "starter" });
  });

  it("normalizes signup input, preserves the plan, and navigates after provisioning", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ error: null });
    const provision = vi.fn().mockResolvedValue({
      ok: true,
      redirectPath: "/dashboard/onboarding?new=1",
    });
    const persistLocale = vi.fn();
    const navigate = vi.fn();

    const result = await submitSignup({
      locale: "en",
      accountReady: false,
      contactName: "  Test Owner  ",
      companyName: "  Acme AB  ",
      email: "  OWNER@EXAMPLE.COM  ",
      password: "password123",
      city: "  Stockholm  ",
      phone: "  0701234567  ",
      plan: "professional",
    }, {
      signUpEmail,
      provision,
      persistLocale,
      navigate,
    });

    expect(result).toEqual({ accountReady: true, error: null });
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Test Owner",
      email: "owner@example.com",
      password: "password123",
    });
    expect(provision).toHaveBeenCalledWith({
      companyName: "Acme AB",
      city: "Stockholm",
      phone: "0701234567",
      plan: "professional",
    });
    expect(persistLocale).toHaveBeenCalledWith("en");
    expect(navigate).toHaveBeenCalledWith("/dashboard/onboarding?new=1");
  });

  it("keeps account-ready state when provisioning throws and retries without duplicate signup", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ error: null });
    const provision = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, redirectPath: "/dashboard" });
    const persistLocale = vi.fn();
    const navigate = vi.fn();

    const input = {
      locale: "sv" as const,
      accountReady: false,
      contactName: "Owner",
      companyName: "Acme AB",
      email: "owner@example.com",
      password: "password123",
      city: "Stockholm",
      phone: "",
      plan: "starter" as const,
    };

    const first = await submitSignup(input, { signUpEmail, provision, persistLocale, navigate });
    expect(first).toEqual({ accountReady: true, error: "recovery" });

    const second = await submitSignup(
      { ...input, accountReady: first.accountReady },
      { signUpEmail, provision, persistLocale, navigate },
    );

    expect(second).toEqual({ accountReady: true, error: null });
    expect(signUpEmail).toHaveBeenCalledTimes(1);
    expect(provision).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps account-ready retry state and does not create the account twice", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ error: null });
    const provision = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, redirectPath: "/dashboard" });
    const persistLocale = vi.fn();
    const navigate = vi.fn();

    const input = {
      locale: "sv" as const,
      accountReady: false,
      contactName: "Owner",
      companyName: "Acme AB",
      email: "owner@example.com",
      password: "password123",
      city: "Stockholm",
      phone: "",
      plan: "starter" as const,
    };

    const first = await submitSignup(input, { signUpEmail, provision, persistLocale, navigate });
    expect(first).toEqual({ accountReady: true, error: "recovery" });

    const second = await submitSignup(
      { ...input, accountReady: first.accountReady },
      { signUpEmail, provision, persistLocale, navigate },
    );

    expect(second).toEqual({ accountReady: true, error: null });
    expect(signUpEmail).toHaveBeenCalledTimes(1);
    expect(provision).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signup provisioning route runtime behavior", () => {
  beforeEach(() => {
    for (const mock of Object.values(routeMocks)) mock.mockReset();
    routeMocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "OWNER@EXAMPLE.COM" },
    });
    routeMocks.getSql.mockReturnValue(routeMocks.sql);
    routeMocks.sql.mockResolvedValue([]);
    routeMocks.createWorkspaceSlug.mockReturnValue("acme-ab");
    routeMocks.provisionWorkspace.mockResolvedValue({
      workspaceId: "workspace-1",
      trialEndsAt: "2026-10-03T00:00:00.000Z",
    });
  });

  it("passes authenticated normalized data to provisionWorkspace", async () => {
    const request = new NextRequest("https://www.proffera.se/api/signup/provision", {
      method: "POST",
      headers: {
        origin: "https://www.proffera.se",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        companyName: "  Acme AB  ",
        city: "  Stockholm  ",
        phone: "  0701234567  ",
        plan: "professional",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      workspaceId: "workspace-1",
      alreadyProvisioned: false,
      redirectPath: "/dashboard/onboarding?new=1",
    });
    expect(routeMocks.createWorkspaceSlug).toHaveBeenCalledWith("Acme AB");
    expect(routeMocks.provisionWorkspace).toHaveBeenCalledWith({
      userId: "user-1",
      slug: "acme-ab",
      companyName: "Acme AB",
      city: "Stockholm",
      email: "owner@example.com",
      phone: "0701234567",
      planKey: "professional",
    });
  });

  it("is idempotent when the authenticated user already has a workspace", async () => {
    routeMocks.sql.mockResolvedValue([
      { workspace_id: "workspace-existing", status: "active" },
    ]);

    const request = new NextRequest("https://www.proffera.se/api/signup/provision", {
      method: "POST",
      headers: {
        origin: "https://www.proffera.se",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        companyName: "Acme AB",
        city: "Stockholm",
        phone: "",
        plan: "starter",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      workspaceId: "workspace-existing",
      alreadyProvisioned: true,
      redirectPath: "/dashboard",
    });
    expect(routeMocks.provisionWorkspace).not.toHaveBeenCalled();
  });
});

describe("password recovery runtime behavior", () => {
  it("normalizes reset requests and keeps the locale-specific callback", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });

    const result = await submitPasswordResetRequest(
      "  OWNER@EXAMPLE.COM  ",
      "en",
      requestPasswordReset,
    );

    expect(result).toEqual({ ok: true });
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "owner@example.com",
      redirectTo: "/aterstall-losenord?lang=en",
    });
    expect(passwordResetRedirectTo("sv")).toBe("/aterstall-losenord");
  });

  it("captures a valid fragment token and produces a fragment-free visible URL", () => {
    const token = "ABCDEFGHIJKLMNOPQRSTUVWX";

    expect(readResetToken(`#token=${token}`)).toBe(token);
    expect(readResetToken("#token=short")).toBeNull();
    expect(resetUrlWithoutFragment("/aterstall-losenord", "?lang=en"))
      .toBe("/aterstall-losenord?lang=en");
    expect(resetLocaleTarget("en", token))
      .toBe(`/aterstall-losenord?lang=en#token=${token}`);
  });

  it("submits the reset payload and returns the correct completion navigation", async () => {
    const resetPassword = vi.fn().mockResolvedValue({ error: null });
    const token = "ABCDEFGHIJKLMNOPQRSTUVWX";

    const result = await submitResetPassword({
      token,
      password: "new-password-123",
      confirmation: "new-password-123",
      resetPassword,
    });

    expect(result).toEqual({ ok: true, error: null });
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password-123",
      token,
    });
    expect(resetCompletionLoginUrl("en")).toBe("/logga-in?lang=en&reset=1");
    expect(resetCompletionLoginUrl("sv")).toBe("/logga-in?reset=1");
  });

  it("rejects mismatched passwords without calling the reset API", async () => {
    const resetPassword = vi.fn();

    const result = await submitResetPassword({
      token: "ABCDEFGHIJKLMNOPQRSTUVWX",
      password: "new-password-123",
      confirmation: "different-password",
      resetPassword,
    });

    expect(result).toEqual({ ok: false, error: "mismatch" });
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
