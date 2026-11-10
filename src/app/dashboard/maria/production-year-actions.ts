"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { mariaDefaultCardCopy } from "@/lib/maria-default-card-copy";
import { isMariaProductionYearEditorReady } from "@/lib/maria-production-year-editor";
import { readMariaYearDescription, readMariaYearPrice } from "@/lib/maria-year-editor";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

/**
 * Production-safe, content-only Maria year editor. No booking, calendar,
 * deposit, publication or existing is_active state may be changed here.
 * The unrelated Preview editor retains its independent QA-only controls.
 */
export async function saveMariaProductionYearAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  if (process.env.VERCEL_ENV !== "production"
    || !access.ok
    || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }
  if (!(await isMariaProductionYearEditorReady())) {
    redirect("/dashboard/maria?error=translation_setup");
  }
  const sql = getSql();
  if (!sql) redirect("/dashboard/maria?error=database");

  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2026 || year > 2036) {
    redirect("/dashboard/maria?error=year");
  }

  const fields = [
    "trial", "without",
    "trial_description", "without_description",
    "trial_description_en", "trial_description_ar",
    "without_description_en", "without_description_ar",
  ] as const;
  if (fields.some(field => typeof formData.get(field) !== "string")) {
    redirect("/dashboard/maria?error=description");
  }

  let prices: {trial: number | null; without: number | null};
  try {
    prices = {
      trial: readMariaYearPrice(formData.get("trial")),
      without: readMariaYearPrice(formData.get("without")),
    };
  } catch {
    redirect("/dashboard/maria?error=price");
  }

  let copy: {
    trial: {sv: string; en: string; ar: string};
    without: {sv: string; en: string; ar: string};
  };
  try {
    copy = {
      trial: {
        sv: readMariaYearDescription(formData.get("trial_description"), mariaDefaultCardCopy.trial.sv),
        en: readMariaYearDescription(formData.get("trial_description_en"), ""),
        ar: readMariaYearDescription(formData.get("trial_description_ar"), ""),
      },
      without: {
        sv: readMariaYearDescription(formData.get("without_description"), mariaDefaultCardCopy["without-trial"].sv),
        en: readMariaYearDescription(formData.get("without_description_en"), ""),
        ar: readMariaYearDescription(formData.get("without_description_ar"), ""),
      },
    };
  } catch {
    redirect("/dashboard/maria?error=description");
  }

  const upsertService = (kind: "trial" | "without-trial") => {
    const trial = kind === "trial";
    const slug = `maria-bridal-${kind}-${year}`;
    const name = `Brudsmink ${trial ? "med" : "utan"} prov ${year}`;
    const price = prices[trial ? "trial" : "without"];
    const description = copy[trial ? "trial" : "without"].sv;
    const amountMinor = price === null ? null : Math.round(price * 100);
    const basePrice = price !== null && Number.isInteger(price) ? price : null;
    const label = price === null ? "Pris på förfrågan" : `${new Intl.NumberFormat("sv-SE").format(price)} kr`;

    return sql!`
      insert into workspace_services (
        workspace_id, name, description, short_description, category, price_label,
        price_type, price_amount_minor, base_price_sek, duration_minutes, buffer_after_minutes,
        is_active, sort_order, public_slug, public_status, conversion_mode,
        service_area, maximum_advance_days
      )
      select ${access.workspaceId}, ${name}, ${description}, ${description},
        'Brudmakeup', ${label}, ${price === null ? "quote" : "fixed"},
        ${amountMinor}, ${basePrice},
        coalesce((select max(s.duration_minutes) from workspace_services s
          where s.workspace_id = ${access.workspaceId}
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'), 180),
        coalesce((select max(s.buffer_after_minutes) from workspace_services s
          where s.workspace_id = ${access.workspaceId}
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'), 0),
        false, ${year * 10 + (trial ? 0 : 1)}, ${slug}, 'draft', 'quote',
        'Södertälje', 730
      where exists (
        select 1 from workspaces w
        where w.id=${access.workspaceId}::uuid and w.slug='makeup-by-maria'
          and w.status in ('active','trial')
      )
      on conflict (workspace_id, name) do update set
        description = excluded.description,
        short_description = excluded.short_description,
        price_label = excluded.price_label,
        price_type = excluded.price_type,
        price_amount_minor = excluded.price_amount_minor,
        base_price_sek = excluded.base_price_sek,
        updated_at = now()
      where workspace_services.workspace_id = ${access.workspaceId}
        and workspace_services.public_slug = ${slug}
        -- A live service must never become quote-priced or zero-priced through
        -- a content edit. Keep hidden/draft services free to use quote pricing.
        -- Evaluated in the same locked upsert transaction as the price write.
        and (not (workspace_services.is_active and workspace_services.public_status = 'published')
          or (excluded.price_type = 'fixed'
            and excluded.price_amount_minor > 0
            and excluded.price_amount_minor <= 25000000))
      returning id
    `;
  };

  const upsertLanguage = (kind: "trial" | "without-trial", locale: "en" | "ar") => {
    const slug = `maria-bridal-${kind}-${year}`;
    const description = copy[kind === "trial" ? "trial" : "without"][locale];
    return sql!`
      insert into maria_service_card_translations(service_id, locale, description)
      select s.id, ${locale}, ${description}
      from workspace_services s
      join workspaces w on w.id::text = s.workspace_id
      where w.id = ${access.workspaceId}::uuid and w.slug='makeup-by-maria'
        and w.status in ('active','trial') and s.public_slug = ${slug}
      on conflict (service_id, locale) do update
        set description = excluded.description, updated_at = now()
      returning service_id
    `;
  };

  try {
    const results = await sql!.transaction([
      sql!`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
      upsertService("trial"), upsertService("without-trial"),
      upsertLanguage("trial", "en"), upsertLanguage("trial", "ar"),
      upsertLanguage("without-trial", "en"), upsertLanguage("without-trial", "ar"),
      // A conflicting slug/name or a missing target aborts all writes,
      // including the audit row. Never partially update a price or language.
      sql!`
        select 1 / (case when (
          select count(*) from workspace_services s
          where s.workspace_id = ${access.workspaceId}
            and (
              (s.name = ${`Brudsmink med prov ${year}`} and s.public_slug = ${`maria-bridal-trial-${year}`}
                and s.short_description = ${copy.trial.sv}
                and s.price_amount_minor is not distinct from ${prices.trial === null ? null : Math.round(prices.trial*100)}::bigint)
              or
              (s.name = ${`Brudsmink utan prov ${year}`} and s.public_slug = ${`maria-bridal-without-trial-${year}`}
                and s.short_description = ${copy.without.sv}
                and s.price_amount_minor is not distinct from ${prices.without === null ? null : Math.round(prices.without*100)}::bigint)
            )
        ) = 2 then 1 else 0 end) as maria_production_content_guard
      `,
      sql!`
        select 1 / (case when (
          select count(*) from maria_service_card_translations t
          join workspace_services s on s.id = t.service_id
          join workspaces w on w.id::text=s.workspace_id
          where w.id = ${access.workspaceId}::uuid and w.slug = 'makeup-by-maria'
          and (
            (s.public_slug = ${`maria-bridal-trial-${year}`}
              and ((t.locale='en' and t.description=${copy.trial.en})
                or (t.locale='ar' and t.description=${copy.trial.ar})))
            or
            (s.public_slug = ${`maria-bridal-without-trial-${year}`}
              and ((t.locale='en' and t.description=${copy.without.en})
                or (t.locale='ar' and t.description=${copy.without.ar})))
          )
        ) = 4 then 1 else 0 end) as maria_production_translations_guard
      `,
      sql!`
        insert into admin_audit_logs (admin_user_id,workspace_id,action,reason,new_value)
        values (${access.userId},${access.workspaceId}::uuid,
          'maria.booking_year_content.updated',
          'Maria owner updated yearly service prices and Swedish/English/Arabic descriptions',
          ${JSON.stringify({
            year, trialPriceSek: prices.trial, withoutTrialPriceSek: prices.without,
            locales: ["sv","en","ar"], mode: "production_content_only",
            bookingPublicationChanged: false,
          })}::jsonb)
      `,
    ]);
    if ([1,2,3,4,5,6].some(i => results[i]?.length !== 1)) {
      throw new Error("MISSING_OR_CONFLICTING_MARIA_SERVICE");
    }
  } catch (error) {
    console.error("Maria Production year content write refused", error);
    redirect(`/dashboard/maria?error=save&year=${year}#priser`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/maria");
  redirect(`/dashboard/maria?updated=${year}&year=${year}#priser`);
}
