import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DashboardActionFeedback } from "@/components/dashboard/dashboard-action-feedback";
import { DashboardMetricGrid } from "@/components/dashboard/dashboard-page-ui";

describe("dashboard accessibility regression behavior", () => {
  it("keeps both live regions mounted and exposes status versus alert semantics", () => {
    const emptyMarkup = renderToStaticMarkup(<DashboardActionFeedback />);
    expect(emptyMarkup).toContain('role="status"');
    expect(emptyMarkup).toContain('aria-live="polite"');
    expect(emptyMarkup).toContain('role="alert"');
    expect(emptyMarkup).toContain('aria-live="assertive"');

    const messageMarkup = renderToStaticMarkup(
      <DashboardActionFeedback statusMessage="Saved" alertMessage="Could not save" />,
    );
    expect(messageMarkup).toContain("Saved");
    expect(messageMarkup).toContain("Could not save");
  });

  it("renders metric separators without a hard-coded locale landmark name", () => {
    const items = Array.from({ length: 4 }, (_, index) => ({
      label: `Metric ${index + 1}`,
      value: String(index + 1),
      helper: "Helper",
      icon: Activity,
      tone: "bg-brand-soft text-brand",
    }));

    const markup = renderToStaticMarkup(<DashboardMetricGrid items={items} />);
    expect(markup).toContain("grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4");
    expect(markup).not.toContain('aria-label="Sidöversikt"');
  });
});
