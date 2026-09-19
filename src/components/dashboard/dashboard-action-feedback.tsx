"use client";

type DashboardActionFeedbackProps = {
  statusMessage?: string | null;
  alertMessage?: string | null;
};

export function DashboardActionFeedback({
  statusMessage,
  alertMessage,
}: DashboardActionFeedbackProps) {
  return (
    <div className="grid gap-3" data-dashboard-action-feedback>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          statusMessage
            ? "rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-semibold text-[#087754]"
            : "sr-only"
        }
      >
        {statusMessage ?? ""}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={
          alertMessage
            ? "rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-semibold text-danger"
            : "sr-only"
        }
      >
        {alertMessage ?? ""}
      </div>
    </div>
  );
}
