import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";

export const runtime = "nodejs";

type ChatLeadPayload = {
  workspaceId?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  city?: unknown;
  serviceInterest?: unknown;
  conversationId?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function hasValidSecret(request: Request) {
  const expected = process.env.CHAT_LEAD_WEBHOOK_SECRET ?? "";
  const received = request.headers.get("x-proffera-chat-secret") ?? "";

  if (!expected || expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: ChatLeadPayload;

  try {
    payload = (await request.json()) as ChatLeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const workspaceId = text(payload.workspaceId, 80);
  const name = text(payload.name, 140);
  const email = text(payload.email, 180).toLowerCase();
  const phone = text(payload.phone, 40);
  const city = text(payload.city, 120);
  const serviceInterest = text(payload.serviceInterest, 240);
  const conversationId = text(payload.conversationId, 160);

  if (!isUuid(workspaceId) || !name || (!email && !phone) || (email && !isEmail(email))) {
    return NextResponse.json({ error: "Invalid lead payload." }, { status: 400 });
  }

  const sql = getSql();

  if (!sql) {
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }

  const workspace = await sql`
    select id
    from workspaces
    where id = ${workspaceId}::uuid
      and status in ('active', 'trial')
    limit 1
  `;

  if (!workspace[0]) {
    return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
  }

  const customer = await sql`
    insert into customers (
      workspace_id, name, email, phone, city, status, source, notes
    ) values (
      ${workspaceId}, ${name}, ${email || null}, ${phone || null}, ${city || null}, 'prospect', 'chat', ${serviceInterest || null}
    )
    returning id
  `;

  const customerId = String(customer[0]?.id ?? "");

  if (!customerId) {
    return NextResponse.json({ error: "Lead could not be stored." }, { status: 500 });
  }

  await sql`
    insert into customer_events (workspace_id, customer_id, event_type, title, description, metadata)
    values (
      ${workspaceId}, ${customerId}::uuid, 'ai_conversation', 'Lead från Proffera Chat', ${serviceInterest || 'Kontaktuppgifter lämnades i chatten.'},
      ${JSON.stringify({ conversationId })}::jsonb
    )
  `;

  return NextResponse.json({ ok: true, customerId }, { status: 201 });
}
