import "server-only";

import { getSql } from "@/lib/db/server";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export const supportedIndustryKeys = [
  "salon",
  "cleaning",
  "window_cleaning",
  "consulting",
  "repair",
  "healthcare",
  "restaurant",
  "other",
] as const;

export type SupportedIndustryKey = (typeof supportedIndustryKeys)[number];

type ServiceSeed = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  sortOrder: number;
};

const industryServiceSeeds: Record<SupportedIndustryKey, ServiceSeed[]> = {
  salon: [
    { name: "Klippning", description: "Klippning och enklare styling.", category: "Hår", durationMinutes: 45, sortOrder: 10 },
    { name: "Barnklippning", description: "Klippning för barn.", category: "Hår", durationMinutes: 30, sortOrder: 20 },
    { name: "Färgning", description: "Hårfärgning efter konsultation.", category: "Hår", durationMinutes: 120, sortOrder: 30 },
    { name: "Skäggtrimning", description: "Trimning och formning av skägg.", category: "Barberare", durationMinutes: 30, sortOrder: 40 },
    { name: "Konsultation", description: "Kort konsultation inför behandling.", category: "Konsultation", durationMinutes: 20, sortOrder: 50 },
  ],
  cleaning: [
    { name: "Hemstädning", description: "Återkommande eller enstaka hemstädning.", category: "Städning", durationMinutes: 120, sortOrder: 10 },
    { name: "Flyttstädning", description: "Komplett städning inför eller efter flytt.", category: "Städning", durationMinutes: 240, sortOrder: 20 },
    { name: "Kontorsstädning", description: "Lokalvård för kontor och mindre företag.", category: "Företag", durationMinutes: 180, sortOrder: 30 },
    { name: "Storstädning", description: "Grundlig städning av hela bostaden.", category: "Städning", durationMinutes: 240, sortOrder: 40 },
  ],
  window_cleaning: [
    { name: "Fönsterputs bostad", description: "Fönsterputs för lägenhet eller villa.", category: "Fönsterputs", durationMinutes: 120, sortOrder: 10 },
    { name: "Fönsterputs företag", description: "Fönsterputs för butik, kontor eller fastighet.", category: "Fönsterputs", durationMinutes: 180, sortOrder: 20 },
    { name: "Inglasad balkong", description: "Putsning av inglasad balkong eller uterum.", category: "Fönsterputs", durationMinutes: 90, sortOrder: 30 },
    { name: "Kostnadsfri bedömning", description: "Bedömning inför större eller återkommande uppdrag.", category: "Offert", durationMinutes: 30, sortOrder: 40 },
  ],
  consulting: [
    { name: "Konsultation", description: "Rådgivande möte online eller på plats.", category: "Rådgivning", durationMinutes: 60, sortOrder: 10 },
    { name: "Introduktionsmöte", description: "Första möte för behovsanalys och nästa steg.", category: "Rådgivning", durationMinutes: 30, sortOrder: 20 },
    { name: "Uppföljningsmöte", description: "Uppföljning av pågående uppdrag.", category: "Rådgivning", durationMinutes: 45, sortOrder: 30 },
  ],
  repair: [
    { name: "Felsökning", description: "Inledande felsökning och bedömning.", category: "Service", durationMinutes: 60, sortOrder: 10 },
    { name: "Reparation", description: "Planerad reparation efter bedömning.", category: "Service", durationMinutes: 120, sortOrder: 20 },
    { name: "Servicebesök", description: "Förebyggande service och kontroll.", category: "Service", durationMinutes: 90, sortOrder: 30 },
    { name: "Kostnadsfri offert", description: "Kort besök eller samtal inför offert.", category: "Offert", durationMinutes: 30, sortOrder: 40 },
  ],
  healthcare: [
    { name: "Första besök", description: "Inledande bedömning och behandlingsplan.", category: "Behandling", durationMinutes: 60, sortOrder: 10 },
    { name: "Återbesök", description: "Uppföljning eller fortsatt behandling.", category: "Behandling", durationMinutes: 45, sortOrder: 20 },
    { name: "Konsultation", description: "Kort rådgivande konsultation.", category: "Rådgivning", durationMinutes: 30, sortOrder: 30 },
  ],
  restaurant: [
    { name: "Bordsbokning", description: "Boka bord för ett vanligt restaurangbesök.", category: "Bokning", durationMinutes: 120, sortOrder: 10 },
    { name: "Gruppbokning", description: "Bokning för större sällskap.", category: "Bokning", durationMinutes: 180, sortOrder: 20 },
    { name: "Eventförfrågan", description: "Möte eller samtal inför privat event.", category: "Event", durationMinutes: 30, sortOrder: 30 },
  ],
  other: [
    { name: "Standardtjänst", description: "Redigera namn, pris och längd så att tjänsten passar verksamheten.", category: "Tjänster", durationMinutes: 60, sortOrder: 10 },
    { name: "Konsultation", description: "Första samtal eller möte med kunden.", category: "Rådgivning", durationMinutes: 30, sortOrder: 20 },
  ],
};

export function normalizeIndustryKey(value: string): SupportedIndustryKey {
  return supportedIndustryKeys.includes(value as SupportedIndustryKey)
    ? (value as SupportedIndustryKey)
    : "other";
}

export function getIndustryServiceSeeds(value: string) {
  return industryServiceSeeds[normalizeIndustryKey(value)];
}

export async function seedWorkspaceServicesForIndustry(industryKey: string) {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok) throw new Error("A valid workspace membership is required to create default services");
  if (!sql) throw new Error("Database is not configured");

  const seeds = getIndustryServiceSeeds(industryKey);
  const payload = JSON.stringify(seeds);
  const rows = await sql`
    with seed as (
      select *
      from jsonb_to_recordset(${payload}::jsonb) as item(
        name text,
        description text,
        category text,
        "durationMinutes" integer,
        "sortOrder" integer
      )
    )
    insert into workspace_services (
      workspace_id,
      name,
      description,
      category,
      price_label,
      base_price_sek,
      duration_minutes,
      buffer_before_minutes,
      buffer_after_minutes,
      minimum_notice_minutes,
      maximum_advance_days,
      service_area,
      is_active,
      sort_order
    )
    select
      ${access.workspaceId},
      seed.name,
      seed.description,
      seed.category,
      'Pris på förfrågan',
      null,
      seed."durationMinutes",
      0,
      0,
      60,
      365,
      '',
      true,
      seed."sortOrder"
    from seed
    where not exists (
      select 1 from workspace_services existing
      where existing.workspace_id = ${access.workspaceId}
    )
    returning id
  `;

  return { created: rows.length, industryKey: normalizeIndustryKey(industryKey) };
}
