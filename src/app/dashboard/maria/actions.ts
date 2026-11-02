"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { readMariaYearDescription, readMariaYearPrice } from "@/lib/maria-year-editor";

const FIRST_YEAR = 2026;
const LAST_YEAR = 2036;

export async function saveMariaYearAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || access.workspaceSlug !== "makeup-by-maria" || !canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }
  const sql = getSql();
  if (!sql) redirect("/dashboard/maria?error=database");

  const year = Number(String(formData.get("year") ?? ""));
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
    redirect("/dashboard/maria?error=year");
  }
  const enabled = formData.get("enabled") === "on";
  let trial: number | null;
  let without: number | null;
  let trialDescription: string;
  let withoutDescription: string;
  try {
    trial = readMariaYearPrice(formData.get("trial"));
    without = readMariaYearPrice(formData.get("without"));
  } catch {
    redirect("/dashboard/maria?error=price");
  }
  try {
    trialDescription = readMariaYearDescription(
      formData.get("trial_description"), "Brudmakeup med provsminkning och hembesök.",
    );
    withoutDescription = readMariaYearDescription(
      formData.get("without_description"), "Brudmakeup med hembesök.",
    );
  } catch {
    redirect("/dashboard/maria?error=description");
  }

  const record = (kind: "trial" | "without-trial", price: number | null, description: string) => {
    const withTrial = kind === "trial";
    const serviceName = `Brudsmink ${withTrial ? "med" : "utan"} prov ${year}`;
    const slug = `maria-bridal-${kind}-${year}`;
    const label = price === null ? "Pris på förfrågan" : `${new Intl.NumberFormat("sv-SE").format(price)} kr`;
    return sql!`
      insert into workspace_services (
        workspace_id, name, description, short_description, category, price_label,
        price_type, price_amount_minor, base_price_sek, duration_minutes, buffer_after_minutes,
        is_active, sort_order, public_slug, public_status, conversion_mode,
        service_area, maximum_advance_days
      )
      select ${access.workspaceId}, ${serviceName},
        ${description}, ${description},
        'Brudmakeup', ${label}, ${price === null ? "quote" : "fixed"},
        ${price === null ? null : Math.round(price * 100)}, ${price},
        coalesce((select max(s.duration_minutes) from workspace_services s
          where s.workspace_id = ${access.workspaceId}
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'), 180),
        coalesce((select max(s.buffer_after_minutes) from workspace_services s
          where s.workspace_id = ${access.workspaceId}
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'), 0),
        ${enabled}, ${year * 10 + (withTrial ? 0 : 1)}, ${slug}, 'draft', 'quote',
        'Södertälje', 730
      where exists (
        select 1 from workspaces
        where id=${access.workspaceId}::uuid and slug='makeup-by-maria' and status in ('active','trial')
      )
      on conflict (workspace_id, name) do update set
        description=excluded.description,
        short_description=excluded.short_description,
        price_label=excluded.price_label,
        price_type=excluded.price_type,
        price_amount_minor=excluded.price_amount_minor,
        base_price_sek=excluded.base_price_sek,
        is_active=excluded.is_active,
        public_slug=excluded.public_slug,
        -- Keep an already published service published when editing its price.
        -- New services remain drafts until intentionally published.
        public_status=workspace_services.public_status,
        conversion_mode=workspace_services.conversion_mode,
        updated_at=now()
      where workspace_services.workspace_id=${access.workspaceId}
        and workspace_services.public_slug = ${slug}
      returning id
    `;
  };

  try {
    const result = await sql.transaction([
      record("trial", trial, trialDescription),
      record("without-trial", without, withoutDescription),
      sql`
        insert into admin_audit_logs (admin_user_id,workspace_id,action,reason,new_value)
        values (
          ${access.userId},${access.workspaceId}::uuid,
          'maria.booking_year_content.updated',
          'Workspace owner changed Maria booking year descriptions and prices',
          ${JSON.stringify({ year, enabled, trialPriceSek: trial, withoutTrialPriceSek: without, copyUpdated: true, mode: "preview_only" })}::jsonb
        )
      `,
    ]);
    if (result[0]?.length !== 1 || result[1]?.length !== 1) {
      // A missing target indicates a stale or conflicting Maria service; fail closed.
      throw new Error("SERVICE_CONFLICT");
    }
  } catch (error) {
    console.error("Maria booking year update failed", error);
    redirect("/dashboard/maria?error=save");
  }

  revalidatePath("/dashboard/maria");
  revalidatePath("/api/makeup-by-maria/config");
  redirect(`/dashboard/maria?updated=${year}&year=${year}#priser`);
}
