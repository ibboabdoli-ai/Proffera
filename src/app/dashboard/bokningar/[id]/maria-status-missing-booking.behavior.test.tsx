import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  updateStatus: vi.fn(),
  sendStatusEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: (): never => { throw new Error("NOT_FOUND"); },
  redirect: (url: string): never => { throw new Error("REDIRECT:" + url); },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceSlug: "makeup-by-maria", workspaceName: "Synthetic Maria",
    workspaceId: "00000000-0000-4000-8000-000000000001", role: "owner",
  }),
  canManageWorkspaceSettings: () => true,
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: async () => true,
}));
vi.mock("@/lib/dashboard-booking-detail-db", () => ({
  getDashboardBookingDetailInStockholm: runtime.loadDetail,
}));
vi.mock("@/lib/dashboard-booking-status", () => ({
  isDashboardBookingStatus: (status: string) =>
    ["requested", "confirmed", "completed", "cancelled"].includes(status),
  updateDashboardBookingStatus: runtime.updateStatus,
}));
vi.mock("@/features/email/maria-deposit-email", () => ({
  sendMariaBookingStatusEmail: runtime.sendStatusEmail,
}));
vi.mock("@/lib/maria-manual-swish", () => ({
  readMariaManualSwishStatuses: async () => ({ ok: true, entries: {} }),
}));

import BookingDetailPage from "./page";

const id = "00000000-0000-4000-8000-000000000123";

function detail(email: string) {
  return {
    booking: {
      id, title: "Synthetic Maria QA booking", status: "requested",
      source: "dashboard_manual", notes: "", time: "10:00", endsAt: "11:00",
      city: "Stockholm", service: "Synthetic QA service", createdAt: "Today",
      customer: "Synthetic QA customer",
    },
    customer: {
      id: "00000000-0000-4000-8000-000000000456", name: "Synthetic QA customer",
      email, phone: "", city: "Stockholm", type: "private", status: "active",
    },
    events: [],
  };
}

type NodeProps = { children?: ReactNode; name?: string; action?: unknown };
function collectElements(node: ReactNode): ReactElement<NodeProps>[] {
  const elements: ReactElement<NodeProps>[] = [];
  const visit = (child: ReactNode): void => {
    if (Array.isArray(child)) {
      child.forEach(visit);
    } else if (isValidElement<NodeProps>(child)) {
      elements.push(child);
      visit(child.props.children);
    }
  };
  visit(node);
  return elements;
}

async function getStatusAction() {
  const page = await BookingDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ lang: "en" }),
  });
  const form = collectElements(page).find((element) =>
    element.type === "form" && collectElements(element.props.children).some(
      (child) => child.type === "select" && child.props.name === "status",
    ),
  );
  if (typeof form?.props.action !== "function") throw new Error("Status form action missing");
  return form.props.action as (data: FormData) => Promise<unknown>;
}

function statusForm(status: string) {
  const form = new FormData();
  form.set("lang", "en");
  form.set("status", status);
  return form;
}

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "maria-synthetic-qa.vercel.app");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "synthetic-qa-only-key");
  vi.stubEnv("LEAD_FROM_EMAIL", "Preview QA <qa@example.invalid>");
  runtime.loadDetail.mockReset().mockResolvedValue(detail("qa@example.invalid"));
  runtime.updateStatus.mockReset();
  runtime.sendStatusEmail.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("Maria Preview booking status action on a deleted booking", () => {
  it.each(["requested", "confirmed", "completed", "cancelled"])(
    "returns the save error for missing booking on %s, without a write",
    async (status) => {
      const action = await getStatusAction();
      // The booking was displayed, then removed before manager submission.
      runtime.loadDetail.mockResolvedValue(null);
      await expect(action(statusForm(status))).rejects.toThrow(
        `REDIRECT:/dashboard/bokningar/${id}?error=save&lang=en`,
      );
      expect(runtime.updateStatus).not.toHaveBeenCalled();
    },
  );

  it("keeps the QA-recipient rejection for an existing, unapproved booking", async () => {
    const action = await getStatusAction();
    runtime.loadDetail.mockResolvedValue(detail("actual-customer@example.com"));
    await expect(action(statusForm("confirmed"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?error=maria_preview&lang=en`,
    );
    expect(runtime.updateStatus).not.toHaveBeenCalled();
  });

  it("allows an existing approved Preview booking through preflight", async () => {
    const action = await getStatusAction();
    runtime.updateStatus.mockResolvedValue({ changed: false, previousStatus: "requested" });
    await expect(action(statusForm("requested"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?lang=en`,
    );
    expect(runtime.updateStatus).toHaveBeenCalledExactlyOnceWith(id, "requested");
  });
  it.each(["cancelled", "no_show"])(
    "rejects reactivation from %s when the writer returns unchanged",
    async (previousStatus) => {
      const action = await getStatusAction();
      runtime.updateStatus.mockResolvedValue({ changed: false, previousStatus });
      await expect(action(statusForm("requested"))).rejects.toThrow(
        `REDIRECT:/dashboard/bokningar/${id}?error=maria_activation_conflict&lang=en`,
      );
      expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
    },
  );

  it.each(["confirmed", "cancelled"])(
    "reports failed QA email delivery after %s changed",
    async (status) => {
      const action = await getStatusAction();
      runtime.updateStatus.mockResolvedValue({
        changed: true, previousStatus: "requested", timeZone: "Europe/Stockholm",
        notification: {
          customerEmail: "qa@example.invalid", customerName: "Synthetic QA customer",
          service: "Synthetic QA service", startsAt: "2026-11-20T09:00:00.000Z",
          endsAt: "2026-11-20T10:00:00.000Z", city: "Stockholm", language: "en",
        },
      });
      runtime.sendStatusEmail.mockResolvedValue({ ok: false });
      await expect(action(statusForm(status))).rejects.toThrow(
        `REDIRECT:/dashboard/bokningar/${id}?updated=1&maria_mail=failed&lang=en`,
      );
      expect(runtime.updateStatus).toHaveBeenCalledExactlyOnceWith(id, status);
      expect(runtime.sendStatusEmail).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["PROFFERA_PREVIEW_BREVO_API_KEY", "LEAD_FROM_EMAIL"])(
    "blocks confirmation with a missing %s before the writer",
    async (key) => {
      const action = await getStatusAction();
      vi.stubEnv(key, undefined);
      await expect(action(statusForm("confirmed"))).rejects.toThrow(
        `REDIRECT:/dashboard/bokningar/${id}?error=maria_email_setup&lang=en`,
      );
      expect(runtime.updateStatus).not.toHaveBeenCalled();
    },
  );

  it("confirms a changed status with the standard success redirect", async () => {
    const action = await getStatusAction();
    runtime.updateStatus.mockResolvedValue({ changed: true, previousStatus: "requested" });
    await expect(action(statusForm("completed"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?updated=1&lang=en`,
    );
    expect(runtime.updateStatus).toHaveBeenCalledExactlyOnceWith(id, "completed");
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
  });

});
