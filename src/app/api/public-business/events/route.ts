import { NextResponse } from "next/server";
import { z } from "zod";

import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  workspaceId: z.string().uuid(),
  serviceId: z.string().uuid().optional().nullable(),
  eventKey: z.enum(["business_view", "service_view", "book_clicked", "quote_clicked", "contact_clicked"]),
  path: z.string().max(500).optional().default(""),
  sessionKey: z.string().max(120).optional().default(""),
  referrer: z.string().max(1000).optional().default(""),
});

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
  const event = parsed.data;
  const allowed = await allowPublicSubmission({
    scope: `public_business_event:${event.workspaceId}`,
    requestHeaders: request.headers,
    identity: event.sessionKey || "anonymous",
    maxAttempts: 120,
    windowSeconds: 15 * 60,
  });
  if (!allowed) return NextResponse.json({ ok: true }, { status: 202 });

  const workspaces = await sql`select id from workspaces where id = ${event.workspaceId}::uuid and status in ('active', 'trial') limit 1`;
  if (!workspaces[0]) return NextResponse.json({ ok: false }, { status: 404 });

  if (event.serviceId) {
    const services = await sql`select id from workspace_services where id = ${event.serviceId}::uuid and workspace_id = ${event.workspaceId} limit 1`;
    if (!services[0]) return NextResponse.json({ ok: false }, { status: 400 });
  }

  await sql`
    insert into public_business_events (workspace_id, service_id, event_key, path, session_key, referrer)
    values (${event.workspaceId}::uuid, ${event.serviceId || null}::uuid, ${event.eventKey}, ${event.path}, ${event.sessionKey}, ${event.referrer})
  `;
  return NextResponse.json({ ok: true }, { status: 201 });
}
