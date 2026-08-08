import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createWorkspaceSlug, provisionWorkspace } from "@/features/company/workspace-provisioning";
import { getServerSession } from "@/lib/auth-session";
import { getSql } from "@/lib/db/server";

export const runtime = "nodejs";

const signupProvisionSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(80),
  plan: z.enum(["starter", "professional"]),
});

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, code: "origin" }, { status: 403 });
  }

  const session = await getServerSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();

  if (!userId || !email) {
    return NextResponse.json({ ok: false, code: "auth" }, { status: 401 });
  }

  const parsed = signupProvisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "input" }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ ok: false, code: "database" }, { status: 503 });
  }

  try {
    const existingMemberships = await sql`
      select wm.workspace_id, w.status
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${userId}
      order by wm.created_at asc
      limit 1
    `;
    const existing = existingMemberships[0];

    if (existing?.workspace_id) {
      return NextResponse.json({
        ok: true,
        workspaceId: String(existing.workspace_id),
        alreadyProvisioned: true,
        redirectPath: "/dashboard",
      });
    }

    const result = await provisionWorkspace({
      userId,
      slug: createWorkspaceSlug(parsed.data.companyName),
      companyName: parsed.data.companyName,
      city: parsed.data.city,
      email,
      phone: parsed.data.phone,
      planKey: parsed.data.plan,
    });

    return NextResponse.json({
      ok: true,
      workspaceId: result.workspaceId,
      trialEndsAt: result.trialEndsAt,
      alreadyProvisioned: false,
      redirectPath: "/dashboard/onboarding?new=1",
    });
  } catch (error) {
    console.error("Failed to provision self-service signup workspace", error);
    return NextResponse.json({ ok: false, code: "database" }, { status: 500 });
  }
}
