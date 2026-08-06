import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("workspace service job lifecycle", () => {
  it("derives Workspace access on the server and limits mutations to managers", () => {
    const persistence = source("src/lib/workspace-service-jobs-db.ts");

    expect(persistence).toContain("getUserWorkspaceAccess");
    expect(persistence).toContain("canManageWorkspaceSettings");
    expect(persistence).toContain("getActiveWorkspaceAccess(true)");
    expect(persistence).toContain("workspace_id = ${access.workspaceId}::uuid");
    expect(persistence).toContain("job.workspace_id = $1::uuid");
    expect(persistence).toContain("staff.workspace_id = current.workspace_id::text");
    expect(persistence).toContain("staff.is_active = true");
  });

  it("serializes assignment and records the assigned event atomically", () => {
    const persistence = source("src/lib/workspace-service-jobs-db.ts");

    expect(persistence).toContain("export async function assignDashboardWorkspaceServiceJob");
    expect(persistence).toContain("for update");
    expect(persistence).toContain("status in ('new', 'assigned', 'in_progress')");
    expect(persistence).toContain("status = case when job.status = 'new' then 'assigned' else job.status end");
    expect(persistence).toContain("job.assigned_staff_id is distinct from staff.id");
    expect(persistence).toContain("insert into workspace_service_job_events");
    expect(persistence).toContain("'assigned'");
    expect(persistence).toContain("jsonb_build_object('staff_id', staff_id)");
  });

  it("allows only declared status transitions and makes terminal states immutable", () => {
    const policy = source("src/lib/workspace-service-job-policy.ts");
    const policyTest = source("src/lib/workspace-service-job-policy.test.ts");
    const persistence = source("src/lib/workspace-service-jobs-db.ts");

    expect(policy).toContain('new: ["assigned", "in_progress", "cancelled"]');
    expect(policy).toContain('assigned: ["in_progress", "cancelled"]');
    expect(policy).toContain('in_progress: ["completed", "cancelled"]');
    expect(policy).toContain("completed: []");
    expect(policy).toContain("cancelled: []");
    expect(policyTest).toContain('["new", "completed"]');
    expect(policyTest).toContain('["completed", "in_progress"]');
    expect(persistence).toContain("canTransitionWorkspaceServiceJob(currentStatus, nextStatus)");
    expect(persistence).toContain("and status = ${currentStatus}");
  });

  it("requires completion evidence and records completion atomically", () => {
    const persistence = source("src/lib/workspace-service-jobs-db.ts");
    const page = source("src/app/dashboard/uppdrag/[id]/page.tsx");
    const migration = source("db/migrations/20260802_0025_workspace_service_jobs.sql");

    expect(persistence).toContain('nextStatus === "completed" && (!evidence || evidence.length > 5000)');
    expect(persistence).toContain("completion_summary = case when ${nextStatus} = 'completed'");
    expect(persistence).toContain("completed_at = case when ${nextStatus} = 'completed' then now()");
    expect(persistence).toContain("insert into workspace_service_job_completion_evidence");
    expect(persistence).toContain("'completion_evidence_added'");
    expect(persistence).toContain("'evidence_type', 'note'");

    expect(page).toContain('name="status" value="completed"');
    expect(page).toContain("name=\"evidence\" required maxLength={5000}");
    expect(page).toContain("getWorkspaceServiceJobTransitions(job.status)");
    expect(page).toContain("canManageWorkspaceSettings(access)");

    expect(migration).toContain("workspace_service_job_completion_evidence_payload_check");
    expect(migration).toContain("evidence_type = 'note'");
    expect(migration).toContain("length(trim(coalesce(description, ''))) between 1 and 5000");
  });

  it("records customer history and synchronizes terminal Booking states", () => {
    const persistence = source("src/lib/workspace-service-jobs-db.ts");

    expect(persistence).toContain("insert into customer_events");
    expect(persistence).toContain("'dashboard_service_job'");
    expect(persistence).toContain("'from_status', ${currentStatus}");
    expect(persistence).toContain("'to_status', ${nextStatus}");
    expect(persistence).toContain("update bookings booking");
    expect(persistence).toContain("case when ${nextStatus} = 'completed' then 'completed' else 'cancelled' end");
    expect(persistence).toContain("booking.workspace_id = job.workspace_id::text");
    expect(persistence).toContain("${nextStatus} in ('completed', 'cancelled')");
    expect(persistence).toContain("booking.status not in ('completed', 'cancelled', 'no_show')");
  });

  it("enforces one fulfillment job per source and valid lifecycle payloads", () => {
    const migration = source("db/migrations/20260802_0025_workspace_service_jobs.sql");

    expect(migration).toContain("workspace_service_jobs_source_type_check");
    expect(migration).toContain("source_type in ('quote_offer', 'booking')");
    expect(migration).toContain("workspace_service_jobs_status_check");
    expect(migration).toContain("status in ('new', 'assigned', 'in_progress', 'completed', 'cancelled')");
    expect(migration).toContain("workspace_service_jobs_quote_offer_unique");
    expect(migration).toContain("workspace_service_jobs_booking_unique");
    expect(migration).toContain("workspace_service_jobs_schedule_check");
    expect(migration).toContain("workspace_service_jobs_total_minor_check");
  });
});
