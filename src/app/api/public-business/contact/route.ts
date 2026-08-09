import { NextResponse } from "next/server";
import { z } from "zod";

import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  workspaceId: z.string().uuid(),
  serviceId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().min(2).max(1000),
  website: z.string().max(200).optional().default(""),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  const input = parsed.data;
  if (input.website) return NextResponse.json({ ok: true }, { status: 201 });

  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const allowed = await allowPublicSubmission({
    scope: `public_business_contact:${input.workspaceId}`,
    requestHeaders: request.headers,
    identity: input.email,
    maxAttempts: 5,
    windowSeconds: 30 * 60,
  });
  if (!allowed) return NextResponse.json({ ok: false, error: "rate_limit" }, { status: 429 });

  const workspaces = await sql`
    select id
    from workspaces
    where id = ${input.workspaceId}::uuid
      and status in ('active', 'trial')
    limit 1
  `;
  if (!workspaces[0]) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!(await hasWorkspaceFeatureAccessForWorkspace(input.workspaceId, "website_builder"))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  let serviceName = "";
  let serviceSlug = "";
  if (input.serviceId) {
    const services = await sql`
      select name, public_slug
      from workspace_services
      where id = ${input.serviceId}::uuid
        and workspace_id = ${input.workspaceId}
        and is_active = true
        and public_status = 'published'
        and conversion_mode = 'contact'
      limit 1
    `;
    if (!services[0]) return NextResponse.json({ ok: false, error: "invalid_service" }, { status: 400 });
    serviceName = String(services[0].name ?? "");
    serviceSlug = String(services[0].public_slug ?? "");
  }

  const customerLockKey = `${input.workspaceId}:${input.email.toLowerCase()}`;
  try {
    const [, rows] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${customerLockKey}::text, 0))`,
      sql`
        with existing_customer as (
          select id
          from customers
          where workspace_id = ${input.workspaceId}
            and lower(email) = lower(${input.email})
          order by created_at asc nulls last, id asc
          limit 1
        ), updated_existing as (
          update customers customer
          set
            phone = coalesce(nullif(customer.phone, ''), ${input.phone || null}),
            primary_service_slug = coalesce(nullif(customer.primary_service_slug, ''), ${serviceSlug || null}),
            updated_at = now()
          where customer.id = (select id from existing_customer)
            and customer.workspace_id = ${input.workspaceId}
          returning customer.id
        ), inserted_customer as (
          insert into customers (
            workspace_id, name, email, phone, customer_type, status, source, primary_service_slug
          )
          select
            ${input.workspaceId}, ${input.name}, ${input.email}, ${input.phone || null}, 'private', 'prospect', 'web_form', ${serviceSlug || null}
          where not exists (select 1 from existing_customer)
          returning id
        ), selected_customer as (
          select id from updated_existing
          union all
          select id from inserted_customer
          limit 1
        ), contact_event as (
          insert into customer_events (
            workspace_id, customer_id, event_type, title, description, metadata
          )
          select
            ${input.workspaceId}, id, 'note', 'Ny kontaktförfrågan', ${input.message},
            jsonb_build_object('source', 'public_business', 'service_id', ${input.serviceId || null}, 'service_name', ${serviceName})
          from selected_customer
          returning id
        )
        select
          (select id from selected_customer) as customer_id,
          (select id from contact_event) as event_id
      `,
    ]);

    if (!rows?.[0]?.customer_id || !rows?.[0]?.event_id) {
      return NextResponse.json({ ok: false, error: "save" }, { status: 503 });
    }
  } catch (error) {
    console.error("Failed to save public business contact", error);
    return NextResponse.json({ ok: false, error: "save" }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
