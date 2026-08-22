import { NextResponse } from "next/server";

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";
import { getDirectoryGuestLeadMatch } from "@/features/matching/directory-guest-single";
import { expirePastMarketplaceInvitation, getMarketplaceInvitationSummaries } from "@/features/matching/marketplace-invitation-state";
import { planMarketplaceGuestWave } from "@/features/matching/marketplace-wave-plan";
import { getAdminForArea } from "@/lib/admin-authorization";
import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

const INVITATION_SEND_TIMEOUT_MS = 8_000;
const INVITATION_STATE_TIMEOUT_MS = 3_000;
const DISPATCH_DEADLINE_MS = 20_000;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function uuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text) ? text : "";
}

function redirect(request: Request, code: string, sent = 0) {
  const url = new URL("/admin/marketplace", request.url);
  url.searchParams.set("invite", code);
  if (sent > 0) url.searchParams.set("sent", String(sent));
  return NextResponse.redirect(url, 303);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const admin = await getAdminForArea("quote_admin");
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const quoteRequestId = uuid(form.get("quoteRequestId"));
  const requestedWave = Number(form.get("wave"));
  if (!quoteRequestId || (requestedWave !== 1 && requestedWave !== 2)) return redirect(request, "invalid_wave");
  if (!marketplaceGuestInvitationEmailConfigured()) return redirect(request, "email_configuration");

  const matchResult = await getDirectoryGuestLeadMatch(quoteRequestId);
  if (!matchResult.ok) return redirect(request, "matching_failed");
  const match = matchResult.match;
  if (!match) return redirect(request, "quote_closed");

  const summaries = await getMarketplaceInvitationSummaries([quoteRequestId]);
  const invitationSummary = summaries.get(quoteRequestId);
  if (!invitationSummary) return redirect(request, "matching_failed");

  const submittedOfferCount = match.offers.filter((offer) => offer.status === "submitted" || offer.status === "selected").length;
  const plan = planMarketplaceGuestWave({
    requestedWave: requestedWave as 1 | 2,
    candidates: match.candidates,
    invitationSummary,
    submittedOfferCount,
  });

  if (plan.reason !== "ready") return redirect(request, `auto_${plan.reason}`);

  let sent = 0;
  const dispatchDeadline = Date.now() + DISPATCH_DEADLINE_MS;
  for (const candidate of plan.candidates) {
    const remainingBeforeStateUpdate = dispatchDeadline - Date.now();
    if (remainingBeforeStateUpdate <= 0) {
      console.warn("Automatic Marketplace wave dispatch stopped at deadline", {
        quoteRequestId,
        wave: requestedWave,
        sent,
      });
      break;
    }

    try {
      await withTimeout(
        expirePastMarketplaceInvitation(quoteRequestId, candidate.profileId),
        Math.min(INVITATION_STATE_TIMEOUT_MS, remainingBeforeStateUpdate),
        "Marketplace invitation state update timed out",
      );

      const remainingDispatchMs = dispatchDeadline - Date.now();
      if (remainingDispatchMs <= 0) {
        console.warn("Automatic Marketplace wave dispatch stopped at deadline", {
          quoteRequestId,
          wave: requestedWave,
          sent,
        });
        break;
      }

      const result = await withTimeout(
        sendMarketplaceGuestQuoteInvitation({
          quoteRequestId,
          profileId: candidate.profileId,
          recipientEmail: candidate.recipientEmail,
          adminUserId: admin.userId,
          baseUrl: new URL(request.url).origin,
          wave: requestedWave,
          matchScore: candidate.score,
          matchReasons: candidate.reasons,
        }),
        Math.min(INVITATION_SEND_TIMEOUT_MS, remainingDispatchMs),
        "Marketplace invitation delivery timed out",
      );
      if (result.ok) sent += 1;
    } catch (error) {
      console.error("Automatic Marketplace wave invitation failed", {
        quoteRequestId,
        profileId: candidate.profileId,
        wave: requestedWave,
        error,
      });
    }
  }

  return redirect(request, sent > 0 ? "auto_wave_sent" : "auto_no_delivery", sent);
}
