import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  updateStatus: vi.fn(),
  sendStatusEmail: vi.fn(),
  retrySql: vi.fn(),
  retryGate: vi.fn(),
  retryClaim: vi.fn(),
  retryFinish: vi.fn(),
  mariaReschedulePending: vi.fn(),
  mariaRescheduleRetry: vi.fn(),
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
  canManageWorkspaceMembers: () => true,
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
vi.mock("@/lib/db/server", () => ({
  getSql: () => (...args: unknown[]) => runtime.retrySql(...args),
}));
vi.mock("@/lib/maria-status-retry-journal", () => ({
  getMariaStatusRetryGate: runtime.retryGate,
  claimMariaStatusRetry: runtime.retryClaim,
  finishMariaStatusRetry: runtime.retryFinish,
}));
vi.mock("@/lib/maria-manual-swish", () => ({
  readMariaManualSwishStatuses: async () => ({ ok: true, entries: {} }),
}));
vi.mock("@/lib/maria-reschedule-notice-retry", () => ({
  hasPendingMariaRescheduleNotice: runtime.mariaReschedulePending,
  retryMariaRescheduleNotice: runtime.mariaRescheduleRetry,
}));

import { MariaStatusEmailRetryButton } from "@/components/dashboard/maria-status-email-retry-button";
import { MariaRescheduleEmailRetryButton } from "@/components/dashboard/maria-reschedule-email-retry-button";
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

async function getStatusRetryAction() {
  const page = await BookingDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ lang: "en" }),
  });
  const form = collectElements(page).find((element) =>
    element.type === "form" && collectElements(element.props.children)
      .some((child) => child.type === MariaStatusEmailRetryButton),
  );
  if (typeof form?.props.action !== "function") throw new Error("Maria retry form action missing");
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
  runtime.retrySql.mockReset();
  runtime.retryGate.mockReset().mockResolvedValue("retryable");
  runtime.retryClaim.mockReset().mockResolvedValue("00000000-0000-4000-8000-000000000998");
  runtime.retryFinish.mockReset().mockResolvedValue(true);
  runtime.mariaReschedulePending.mockReset().mockResolvedValue(false);
  runtime.mariaRescheduleRetry.mockReset().mockResolvedValue({ ok:true });
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
  it("does not claim an update when an already cancelled booking is cancelled again", async () => {
    const action = await getStatusAction();
    runtime.updateStatus.mockResolvedValue({ changed: false, previousStatus: "cancelled" });
    await expect(action(statusForm("cancelled"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?lang=en`,
    );
    expect(runtime.updateStatus).toHaveBeenCalledExactlyOnceWith(id, "cancelled");
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
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

  it("preserves an uncertain provider outcome for the current notice", async () => {
    const action = await getStatusAction();
    runtime.updateStatus.mockResolvedValue({
      changed: true, previousStatus: "requested", timeZone: "Europe/Stockholm",
      notification: {
        customerEmail: "qa@example.invalid", customerName: "Synthetic QA customer",
        service: "Synthetic QA service", startsAt: "2027-06-18T09:00:00.123Z",
        endsAt: "2027-06-18T12:00:00.456Z", city: "Stockholm", language: "en",
        revision: "2027-06-18T07:30:00.789Z",
        noticeEventId: "00000000-0000-4000-8000-000000000987",
      },
    });
    runtime.sendStatusEmail.mockResolvedValue({ ok: false, error: "email_delivery_uncertain" });
    runtime.retrySql.mockResolvedValueOnce([{ notice_state: "uncertain" }]);
    await expect(action(statusForm("cancelled"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?updated=1&maria_mail=uncertain&lang=en`,
    );
    const journal = (runtime.retrySql.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(journal).toContain("update customer_events");
    expect(runtime.retrySql.mock.calls[0]).toContain("uncertain");
  });

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

  it("preserves existing cancellation but requires independent Swish permission for confirmation during intake pause", async () => {
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN","https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","false");
    vi.stubEnv("BREVO_API_KEY","synthetic-non-delivering-key");
    runtime.loadDetail.mockResolvedValue(detail("customer@example.com"));
    const action = await getStatusAction();
    const page = await BookingDetailPage({params:Promise.resolve({id}),
      searchParams:Promise.resolve({lang:"en"})});
    const statusSelect=collectElements(page).find(el => el.type==="select" && el.props.name==="status");
    expect(statusSelect).toBeTruthy();
    const options=collectElements(statusSelect?.props.children)
      .filter(el=>el.type==="option")
      .map(el=>String((el.props as {value?:string}).value));
    expect(options).toEqual(["cancelled"]);
    runtime.updateStatus.mockResolvedValue({
      changed:true,previousStatus:"confirmed",timeZone:"Europe/Stockholm",
      notification:{
        customerEmail:"customer@example.com",customerName:"Synthetic QA customer",
        service:"Synthetic QA service",startsAt:"2026-11-20T09:00:00.000Z",
        endsAt:"2026-11-20T10:00:00.000Z",city:"Stockholm",language:"en",
      },
    });
    await expect(action(statusForm("confirmed"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?error=maria_email_setup&lang=en`);
    expect(runtime.updateStatus).not.toHaveBeenCalled();
    await expect(action(statusForm("cancelled"))).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?updated=1&lang=en`);
    expect(runtime.updateStatus).toHaveBeenCalledExactlyOnceWith(id,"cancelled");
    expect(runtime.sendStatusEmail).toHaveBeenCalledOnce();
  });

  it("lets the owner retry only a journaled existing Maria reschedule when paid intake is paused", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED", "false");
    runtime.loadDetail.mockResolvedValue({
      ...detail("customer@example.com"),
      booking: { ...detail("customer@example.com").booking,
        source: "public_booking", status: "confirmed" },
    });
    runtime.mariaReschedulePending.mockResolvedValue(true);
    const page = await BookingDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ lang: "en" }),
    });
    const retryForm = collectElements(page).find(element =>
      element.type === "form" && collectElements(element.props.children)
        .some(child => child.type === MariaRescheduleEmailRetryButton),
    );
    expect(retryForm).toBeTruthy();
    expect(runtime.mariaReschedulePending).toHaveBeenCalledWith(
      id, "00000000-0000-4000-8000-000000000001",
    );
    const retry = retryForm?.props.action;
    expect(typeof retry).toBe("function");
    const form = new FormData(); form.set("lang","en");
    await expect((retry as (form:FormData)=>Promise<unknown>)(form)).rejects.toThrow(
      "REDIRECT:/dashboard/bokningar/" + id + "?maria_reschedule_mail=resent&lang=en",
    );
    expect(runtime.mariaRescheduleRetry).toHaveBeenCalledExactlyOnceWith(
      id, "00000000-0000-4000-8000-000000000001",
    );
  });

  it("hides an existing-reschedule retry when Production manager lifecycle permission is absent", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED", "false");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED", "false");
    runtime.loadDetail.mockResolvedValue({
      ...detail("customer@example.com"),
      booking: { ...detail("customer@example.com").booking,
        source: "public_booking", status: "confirmed" },
    });
    runtime.mariaReschedulePending.mockResolvedValue(true);
    const page = await BookingDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ lang: "en" }),
    });
    expect(collectElements(page).some(element =>
      element.type === MariaRescheduleEmailRetryButton)).toBe(false);
    expect(runtime.mariaReschedulePending).not.toHaveBeenCalled();
    expect(runtime.mariaRescheduleRetry).not.toHaveBeenCalled();
  });

  it("retries a tab-padded Preview cancellation without losing PostgreSQL timestamp milliseconds", async () => {
    const current = detail("qa@example.invalid");
    runtime.loadDetail.mockResolvedValue({
      ...current, booking: { ...current.booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", service: "Synthetic QA service", city: "Stockholm",
      starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: new Date("2027-06-18T07:30:00.789Z"),
      customer_name: "Synthetic QA customer",
      customer_email: "\tQA@example.invalid  \r",
      booking_language: "sv", confirmed_at: null,
    }]).mockResolvedValueOnce([{ gate: "retryable" }])
      .mockResolvedValueOnce([{ id: "00000000-0000-4000-8000-000000000998" }]);
    const action = await getStatusRetryAction();
    const form = new FormData();
    form.set("lang", "en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?maria_mail=resent&lang=en`,
    );
    expect(runtime.sendStatusEmail).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: id,
      customerEmail: "qa@example.invalid",
      startsAt: "2027-06-18T09:00:00.123Z",
      endsAt: "2027-06-18T12:00:00.456Z",
      expectedRevision: "2027-06-18T07:30:00.789Z",
      status: "cancelled",
    }));
    const query = (runtime.retrySql.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(query).toContain("lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))=?");
    expect(runtime.retryClaim).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: id, revision: "2027-06-18T07:30:00.789Z",
    }));
    expect(runtime.retryFinish).toHaveBeenCalledWith(expect.objectContaining({
      claimId: "00000000-0000-4000-8000-000000000998", outcome: "accepted",
    }));
  });

  it("binds a status retry to the current notice revision and preserves accepted delivery state", async () => {
    const revision = new Date("2027-06-18T07:30:00.789Z");
    runtime.loadDetail.mockResolvedValue({
      ...detail("qa@example.invalid"),
      booking: { ...detail("qa@example.invalid").booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", service: "Synthetic QA service", city: "Stockholm",
      starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: revision,
      notice_event_id: "00000000-0000-4000-8000-000000000987",
      retry_gate: "accepted",
      customer_name: "Synthetic QA customer", customer_email: "qa@example.invalid",
      booking_language: "sv", confirmed_at: null,
    }]).mockResolvedValueOnce([{ gate: "accepted" }]);
    runtime.retryGate.mockResolvedValueOnce("accepted");
    runtime.sendStatusEmail.mockResolvedValue({ ok: false });
    const action = await getStatusRetryAction();
    const form = new FormData();
    form.set("lang", "en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?maria_mail=already_sent&lang=en`,
    );
    expect(runtime.retryGate).toHaveBeenCalledWith(expect.objectContaining({
      revision: "2027-06-18T07:30:00.789Z",
    }));
    expect(runtime.retryClaim).not.toHaveBeenCalled();
    expect(runtime.retryFinish).not.toHaveBeenCalled();
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
  });

  it("blocks retry after an uncertain provider acceptance instead of emailing again", async () => {
    const current = detail("qa@example.invalid");
    runtime.loadDetail.mockResolvedValue({
      ...current, booking: { ...current.booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", retry_gate: "uncertain",
      starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: new Date("2027-06-18T07:30:00.789Z"),
      customer_name: "Synthetic QA customer", customer_email: "qa@example.invalid",
      confirmed_at: null,
    }]);
    runtime.retryGate.mockResolvedValueOnce("uncertain");
    const action = await getStatusRetryAction();
    const form = new FormData();
    form.set("lang", "en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?maria_mail=uncertain&lang=en`,
    );
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
    expect(runtime.retryClaim).not.toHaveBeenCalled();
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
  });

  it("appends retry history to the loaded revision without overwriting earlier status changes", async () => {
    const current = detail("qa@example.invalid");
    runtime.loadDetail.mockResolvedValue({
      ...current, booking: { ...current.booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", retry_gate: "retryable",
      starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: new Date("2027-06-18T07:30:00.789Z"),
      notice_event_id: null,
      customer_name: "Synthetic QA customer", customer_email: "qa@example.invalid",
      confirmed_at: null,
    }]).mockResolvedValueOnce([{ gate: "retryable" }])
      .mockResolvedValueOnce([{ id: "00000000-0000-4000-8000-000000000998" }]);
    const action = await getStatusRetryAction();
    const form = new FormData();
    form.set("lang", "en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?maria_mail=resent&lang=en`,
    );
    expect(runtime.retryClaim).toHaveBeenCalledWith(expect.objectContaining({
      revision: "2027-06-18T07:30:00.789Z",
      parentEventId: null,
    }));
    expect(runtime.retryFinish).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "accepted", revision: "2027-06-18T07:30:00.789Z",
    }));
  });

  it("never sends when the booking revision changed before the retry gate", async () => {
    const current = detail("qa@example.invalid");
    runtime.loadDetail.mockResolvedValue({
      ...current, booking: { ...current.booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", service: "Synthetic QA service",
      starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: new Date("2027-06-18T07:30:00.789Z"),
      customer_name: "Synthetic QA customer",
      customer_email: "qa@example.invalid",
      confirmed_at: null,
    }]);
    runtime.retryGate.mockResolvedValueOnce("revision_changed");
    const action = await getStatusRetryAction();
    const form = new FormData();
    form.set("lang", "en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?error=save&lang=en`,
    );
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
  });

  it("never sends when another manager has already claimed the same revision", async () => {
    const current = detail("qa@example.invalid");
    runtime.loadDetail.mockResolvedValue({
      ...current, booking: { ...current.booking, status: "cancelled" },
    });
    runtime.retrySql.mockResolvedValueOnce([{
      status: "cancelled", starts_at: new Date("2027-06-18T09:00:00.123Z"),
      ends_at: new Date("2027-06-18T12:00:00.456Z"),
      booking_revision: new Date("2027-06-18T07:30:00.789Z"),
      customer_email: "qa@example.invalid", confirmed_at: null,
    }]);
    runtime.retryClaim.mockResolvedValueOnce(null);
    const action = await getStatusRetryAction();
    const form = new FormData(); form.set("lang","en");
    await expect(action(form)).rejects.toThrow(
      `REDIRECT:/dashboard/bokningar/${id}?maria_mail=uncertain&lang=en`,
    );
    expect(runtime.sendStatusEmail).not.toHaveBeenCalled();
    expect(runtime.retryFinish).not.toHaveBeenCalled();
  });

  it("does not falsely claim email delivery when a Maria reschedule notification fails", async () => {
    const page = await BookingDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ lang: "en", rescheduled: "1", maria_reschedule_mail: "failed" }),
    });
    const feedback = collectElements(page)
      .map(element => element.props as { statusMessage?: string; alertMessage?: string })
      .find(props => typeof props.alertMessage === "string" && props.alertMessage.includes("could not be delivered"));
    expect(feedback?.statusMessage).toContain("saved in the booking history");
    expect(feedback?.statusMessage).not.toContain("notified");
    expect(feedback?.alertMessage).toContain("could not be delivered");
  });

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
