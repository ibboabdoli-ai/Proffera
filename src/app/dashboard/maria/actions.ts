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
  if (process.env.VERCEL_ENV !== "preview" || !access.ok || access.workspaceSlug !== "makeup-by-maria" || !canManageWorkspaceSettings(access)) {
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
  let localized: {
    trial: {en: string; ar: string};
    without: {en: string; ar: string};
  };
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
    // An incomplete/stale form must not overwrite previously saved Swedish
    // text with a fallback, or erase English/Arabic translations.
    for (const field of [
      "trial_description", "without_description",
      "trial_description_en", "trial_description_ar",
      "without_description_en", "without_description_ar",
    ]) {
      if (typeof formData.get(field) !== "string") throw new Error("INVALID_DESCRIPTION");
    }
    localized = {
      trial: {
        en: readMariaYearDescription(formData.get("trial_description_en"), ""),
        ar: readMariaYearDescription(formData.get("trial_description_ar"), ""),
      },
      without: {
        en: readMariaYearDescription(formData.get("without_description_en"), ""),
        ar: readMariaYearDescription(formData.get("without_description_ar"), ""),
      },
    };
  } catch {
    redirect("/dashboard/maria?error=description");
  }

  // The new table must be installed in the isolated Preview before editing.
  // Missing storage cannot cause a partial price or language update.
  let translationStorageReady = false;
  try {
    const rows = await sql`select to_regclass('public.maria_service_card_translations') as relation`;
    translationStorageReady = Boolean(rows[0]?.relation);
  } catch { /* fail closed */ }
  if (!translationStorageReady) redirect("/dashboard/maria?error=translation_setup");

  const record = (kind: "trial" | "without-trial", price: number | null, description: string) => {
    const withTrial = kind === "trial";
    const serviceName = `Brudsmink ${withTrial ? "med" : "utan"} prov ${year}`;
    const slug = `maria-bridal-${kind}-${year}`;
    const label = price === null ? "Pris på förfrågan" : `${new Intl.NumberFormat("sv-SE").format(price)} kr`;
    // base_price_sek is a legacy integer. Exact öre belong only in price_amount_minor.
    const legacyIntegerSek = price !== null && Number.isInteger(price) ? price : null;
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
        ${price === null ? null : Math.round(price * 100)}, ${legacyIntegerSek},
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

  /** Persist one explicitly scoped English/Arabic text without changing other tenants. */
  const recordTranslation = (kind: "trial" | "without-trial", locale: "en" | "ar") => {
    const slug = `maria-bridal-${kind}-${year}`;
    const description = localized[kind === "trial" ? "trial" : "without"][locale];
    return sql!`
      insert into maria_service_card_translations(service_id, locale, description)
      select s.id, ${locale}, ${description}
      from workspace_services s
      join workspaces w on w.id::text = s.workspace_id
      where w.id = ${access.workspaceId}::uuid
        and w.slug = 'makeup-by-maria'
        and w.status in ('active','trial')
        and s.public_slug = ${slug}
      on conflict (service_id, locale) do update
      set description = excluded.description, updated_at = now()
      returning service_id
    `;
  };

  try {
    const result = await sql.transaction([
      // Serialize new-year creation with schedule changes and booking holds.
      // Both settings writers must inherit the same committed duration/buffer.
      sql`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
      record("trial", trial, trialDescription),
      record("without-trial", without, withoutDescription),
      recordTranslation("trial", "en"),
      recordTranslation("trial", "ar"),
      recordTranslation("without-trial", "en"),
      recordTranslation("without-trial", "ar"),
      // Check the final persisted values inside the DB transaction, not after commit.
      // A name collision with a different slug must roll back both packages and the audit.
      sql`
        select 1 / (case when (
          select count(*) from workspace_services s
          where s.workspace_id=${access.workspaceId}
            and (
              (s.name=${`Brudsmink med prov ${year}`}
                and s.public_slug=${`maria-bridal-trial-${year}`}
                and s.short_description=${trialDescription}
                and s.price_amount_minor is not distinct from ${trial === null ? null : Math.round(trial*100)}::bigint
                and s.base_price_sek is not distinct from ${trial !== null && Number.isInteger(trial) ? trial : null}::integer
                and s.is_active=${enabled})
              or (s.name=${`Brudsmink utan prov ${year}`}
                and s.public_slug=${`maria-bridal-without-trial-${year}`}
                and s.short_description=${withoutDescription}
                and s.price_amount_minor is not distinct from ${without === null ? null : Math.round(without*100)}::bigint
                and s.base_price_sek is not distinct from ${without !== null && Number.isInteger(without) ? without : null}::integer
                and s.is_active=${enabled})
            )
        ) = 2 then 1 else 0 end) as maria_year_guard
      `,
            // A mismatch of any localized row aborts the entire transaction.
      // Check persisted values, not merely the input form or RETURNING count.
      sql`
        select 1 / (case when (
          select count(*) from maria_service_card_translations t
          join workspace_services s on s.id = t.service_id
          join workspaces w on w.id::text = s.workspace_id
          where w.id = ${access.workspaceId}::uuid
            and w.slug = 'makeup-by-maria'
            and (
              (s.public_slug = ${`maria-bridal-trial-${year}`}
                and ((t.locale = 'en' and t.description = ${localized.trial.en})
                  or (t.locale = 'ar' and t.description = ${localized.trial.ar})))
              or (s.public_slug = ${`maria-bridal-without-trial-${year}`}
                and ((t.locale = 'en' and t.description = ${localized.without.en})
                  or (t.locale = 'ar' and t.description = ${localized.without.ar})))
            )
        ) = 4 then 1 else 0 end) as maria_card_translations_guard
      `,
      sql`
        insert into admin_audit_logs (admin_user_id,workspace_id,action,reason,new_value)
        values (
          ${access.userId},${access.workspaceId}::uuid,
          'maria.booking_year_content.updated',
          'Workspace owner changed Maria yearly card copy in Swedish, English and Arabic and prices',
          ${JSON.stringify({ year, enabled, trialPriceSek: trial, withoutTrialPriceSek: without, locales: ["sv", "en", "ar"], copyUpdated: true, mode: "preview_only" })}::jsonb
        )
      `,
    ]);
    if (result[1]?.length !== 1 || result[2]?.length !== 1
      || [3, 4, 5, 6].some(index => result[index]?.length !== 1)) {
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
