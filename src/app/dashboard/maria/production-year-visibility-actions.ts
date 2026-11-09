"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { isMariaProductionYearEditorReady } from "@/lib/maria-production-year-editor";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

/**
 * Only Maria's owner/admin can publish or hide an EXISTING complete year.
 * Never delete a service or touch existing bookings, deposits or schedule.
 * Create/edit packages with the existing content-only year editor first.
 */
export async function setMariaProductionYearVisibilityAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  if (process.env.VERCEL_ENV !== "production"
    || !access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }
  if (!(await isMariaProductionYearEditorReady())) {
    redirect("/dashboard/maria?error=translation_setup");
  }
  const year = Number(formData.get("year"));
  const visibility = formData.get("visibility");
  if (!Number.isInteger(year) || year < 2026 || year > 2036
    || (visibility !== "show" && visibility !== "hide")) {
    redirect("/dashboard/maria?error=year");
  }
  const sql = getSql();
  if (!sql) redirect("/dashboard/maria?error=database");

  const show = visibility === "show";
  const trialSlug = `maria-bridal-trial-${year}`;
  const withoutSlug = `maria-bridal-without-trial-${year}`;

  try {
    // Advisory lock 713 also serializes OTP holds, finalization, schedule and
    // other Maria service writes. Fail the entire transaction if either package
    // is missing or cannot safely be booked. No auto-publication on price edits.
    const results = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
      sql`
        with eligible as materialized (
          select s.id
          from workspace_services s
          join workspaces w on w.id::text = s.workspace_id
          where w.id = ${access.workspaceId}::uuid
            and w.slug = 'makeup-by-maria'
            and w.status in ('active','trial')
            and s.public_slug in (${trialSlug}, ${withoutSlug})
            and (
              ${!show}::boolean
              or (s.price_type = 'fixed' and s.price_amount_minor > 0
                and s.price_amount_minor <= 25000000
                and s.duration_minutes between 1 and 1440
                and s.maximum_advance_days between 1 and 730)
            )
          for update of s
        ),
        eligible_pair as (
          select count(*) = 2 as complete from eligible
        ),
        updated as (
          update workspace_services s set
            is_active = ${show}::boolean,
            public_status = case when ${show}::boolean then 'published'
              else s.public_status end,
            updated_at = now()
          from eligible e
          where s.id = e.id and (select complete from eligible_pair)
          returning s.id
        )
        select 1 / (case when count(*) = 2 then 1 else 0 end)
          as maria_year_publication_guard from updated
      `,
      sql`
        insert into admin_audit_logs (admin_user_id, workspace_id, action, reason, new_value)
        values (${access.userId}, ${access.workspaceId}::uuid,
          'maria.booking_year_visibility.updated',
          'Maria owner explicitly changed a wedding year public visibility',
          ${JSON.stringify({ year, visible: show, preservedBookings: true })}::jsonb)
      `,
    ]);
    if (results[1]?.length !== 1) throw new Error("MISSING_MARIA_YEAR_PUBLICATION_GUARD");
  } catch (error) {
    console.error("Maria year visibility update refused", error);
    redirect(`/dashboard/maria?year=${year}&error=visibility#priser`);
  }

  revalidatePath("/dashboard/maria");
  revalidatePath("/api/makeup-by-maria/config");
  redirect(`/dashboard/maria?year=${year}&updated=visibility#priser`);
}
