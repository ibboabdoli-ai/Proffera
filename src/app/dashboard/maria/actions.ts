"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const FIRST_YEAR = 2026;
const LAST_YEAR = 2036;
const MAX_PRICE_SEK = 250_000;

function readPrice(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  if (!/^(0|[1-9][0-9]{0,5})$/.test(raw)) throw new Error("INVALID_PRICE");
  const price = Number(raw);
  if (!Number.isSafeInteger(price) || price > MAX_PRICE_SEK) throw new Error("INVALID_PRICE");
  return price;
}

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
  try {
    trial = readPrice(formData, "trial");
    without = readPrice(formData, "without");
  } catch {
    redirect("/dashboard/maria?error=price");
  }

  const record = (kind: "trial" | "without-trial", price: number | null) => {
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
        ${withTrial ? "Brudmakeup med provsminkning och hembesök." : "Brudmakeup på bröllopsdagen med hembesök."},
        ${withTrial ? "Brudmakeup med provsminkning och hembesök." : "Brudmakeup med hembesök."},
        'Brudmakeup', ${label}, ${price === null ? "quote" : "fixed"},
        ${price === null ? null : price * 100}, ${price},
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
        price_label=excluded.price_label,
        price_type=excluded.price_type,
        price_amount_minor=excluded.price_amount_minor,
        base_price_sek=excluded.base_price_sek,
        is_active=excluded.is_active,
        public_slug=excluded.public_slug,
        public_status='draft',
        conversion_mode='quote',
        updated_at=now()
      where workspace_services.workspace_id=${access.workspaceId}
        and workspace_services.public_slug = ${slug}
      returning id
    `;
  };

  try {
    const result = await sql.transaction([
      record("trial", trial),
      record("without-trial", without),
      sql`
        insert into admin_audit_logs (admin_user_id,workspace_id,action,reason,new_value)
        values (
          ${access.userId},${access.workspaceId}::uuid,
          'maria.booking_year_pricing.updated',
          'Workspace owner changed Maria booking demo years and prices',
          ${JSON.stringify({ year, enabled, trialPriceSek: trial, withoutTrialPriceSek: without, mode: "preview_only" })}::jsonb
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
  redirect(`/dashboard/maria?updated=${year}`);
}
