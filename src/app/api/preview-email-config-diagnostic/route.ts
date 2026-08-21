import { NextResponse } from "next/server";

import {
  resolveBrevoApiKey,
  resolvePreviewEmailRecipient,
} from "@/lib/email-runtime-config";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";

export const dynamic = "force-dynamic";

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const previewBrevo = process.env.PROFFERA_PREVIEW_BREVO_API_KEY?.trim() ?? "";
  const sharedBrevo = process.env.BREVO_API_KEY?.trim() ?? "";
  const previewRecipient = resolvePreviewEmailRecipient();
  const resolvedBrevo = resolveBrevoApiKey();

  let providerCredentialStatus: number | null = null;
  if (resolvedBrevo) {
    try {
      const response = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": resolvedBrevo },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      providerCredentialStatus = response.status;
    } catch {
      providerCredentialStatus = -1;
    }
  }

  return NextResponse.json({
    ok: true,
    previewBrevoKeyPresent: present(process.env.PROFFERA_PREVIEW_BREVO_API_KEY),
    sharedBrevoKeyPresent: present(process.env.BREVO_API_KEY),
    previewBrevoKeyDistinct: Boolean(previewBrevo && (!sharedBrevo || previewBrevo !== sharedBrevo)),
    resolvedBrevoKey: Boolean(resolvedBrevo),
    leadFromEmailPresent: present(process.env.LEAD_FROM_EMAIL),
    previewRecipientPresent: present(process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT),
    previewRecipientValid: Boolean(previewRecipient),
    authSecretPresent: Boolean(resolveAuthSecret()),
    emailConfigured: marketplaceGuestInvitationEmailConfigured(),
    providerCredentialStatus,
  });
}
