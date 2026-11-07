import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  updateStatus: vi.fn(),
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
  runtime.loadDetail.mockReset().mockResolvedValue(detail("qa@example.invalid"));
  runtime.updateStatus.mockReset();
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
});
