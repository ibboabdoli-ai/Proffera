import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, Building2, KeyRound, Mail, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/auth-session";
import { parseClaimEmailEvidence } from "@/lib/company-directory-claim-email";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getSql } from "@/lib/db/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string | string[] }>;
};

const statusMessages: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Business email verified",
    body: "Your claim is waiting for manual review. Proffera will not connect the profile until your authority to represent the business has also been verified.",
  },
  email_code_sent: {
    title: "Verification code sent",
    body: "Check the business email and enter the six-digit code below. The code is valid for 10 minutes.",
  },
  email_code_invalid: {
    title: "Incorrect verification code",
    body: "The code does not match. Check the email and try again. After five incorrect attempts, you must request a new code.",
  },
  email_code_expired: {
    title: "The code has expired",
    body: "Send a new code to the same business email to continue.",
  },
  email_code_locked: {
    title: "Too many incorrect codes",
    body: "This code is locked. Send a new code to continue verification.",
  },
  email_delivery_failed: {
    title: "Could not send the verification email",
    body: "No claim was submitted for review. Check the email address and try again later.",
  },
  email_send_rate_limited: {
    title: "Wait before requesting another code",
    body: "Too many verification emails were requested in a short period. Try again later.",
  },
  email_verification_required: {
    title: "Verify the business email first",
    body: "Start with the free email verification below before the claim can be reviewed.",
  },
  reset: {
    title: "Verification reset",
    body: "You can now enter new details and request a new verification code.",
  },
  rate_limited: {
    title: "Too many attempts",
    body: "Try again later. This limit protects businesses from automated or incorrect claims.",
  },
  unavailable: {
    title: "Service temporarily unavailable",
    body: "No access to the business profile was granted. Try again later.",
  },
  claimed: {
    title: "Profile already connected",
    body: "The business profile already has a verified connection to a Proffera workspace.",
  },
  invalid_details: {
    title: "Check your details",
    body: "Name, role and business email must be filled in correctly before verification can continue.",
  },
  account_email_unverified: {
    title: "Verify your Proffera account first",
    body: "The email address on the Proffera account submitting the claim must be verified. The claim is always tied to the signed-in account.",
  },
};

export default async function EnglishClaimCompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [business, session, query] = await Promise.all([
    getPublicDirectoryBusiness(slug),
    getServerSession(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!business) notFound();

  const status = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const message = status ? statusMessages[status] : null;
  const profileHref = `/en/companies/${encodeURIComponent(business.slug)}`;
  const returnTo = `/en/companies/claim/${business.slug}`;

  let emailEvidence: ReturnType<typeof parseClaimEmailEvidence> = null;
  if (session?.user?.id) {
    const sql = getSql();
    if (sql) {
      const rows = await sql`
        select claim.verification_reference
        from company_directory_claims claim
        join company_directory_profiles profile on profile.id = claim.profile_id
        where profile.public_slug = ${business.slug}
          and claim.claimant_user_id = ${String(session.user.id)}
          and claim.status = 'pending'
          and claim.verification_method = 'email_domain'
        order by claim.requested_at desc
        limit 1
      `;
      emailEvidence = parseClaimEmailEvidence(rows[0]?.verification_reference);
    }
  }

  const challengeActive = emailEvidence?.stage === "business_email_code_sent" || emailEvidence?.stage === "business_email_locked";
  const challengeLocked = emailEvidence?.stage === "business_email_locked";
  const challengeExpired = status === "email_code_expired";

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-10 text-[#17201a] sm:px-6" lang="en">
      <div className="mx-auto max-w-2xl">
        <a href={profileHref} className="inline-flex items-center text-sm font-black text-[#173e2b]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to profile
        </a>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/10 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f2ec] text-[#173e2b]">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#54705e]">Claim this business</p>
          <h1 className="mt-2 text-3xl font-black">{business.companyName}</h1>
          <p className="mt-3 text-sm leading-6 text-[#5d685f]">
            The claim always belongs to the signed-in Proffera account. No one receives control of the profile until the business email and the right to represent the business have been verified.
          </p>

          {message ? (
            <div className="mt-7 rounded-2xl border border-[#cfe1d4] bg-[#f1f8f3] p-5">
              <p className="font-black text-[#173e2b]">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#536057]">{message.body}</p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-3">
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">The business is matched to official data</p><p className="mt-1 text-sm text-[#687169]">A claim does not change the official name, status or industry.</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">Verification is required before access</p><p className="mt-1 text-sm text-[#687169]">A verified email alone is not enough. Proffera also manually checks your authority.</p></div>
            </div>
          </div>

          {status !== "sent" ? session?.user?.id ? (
            <div className="mt-8 space-y-4">
              {challengeActive ? (
                <div className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-5">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <p className="font-black">Verify the business email</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">A six-digit code was sent to <strong>{emailEvidence?.businessEmail ?? "the business email"}</strong>.</p>
                      {emailEvidence?.emailDomainKind === "public_mailbox" ? (
                        <p className="mt-2 rounded-lg bg-[#fff5da] px-3 py-2 text-xs leading-5 text-[#76580d]">This is an external email provider, so Proffera will require additional manual checks before the claim can be approved.</p>
                      ) : null}
                    </div>
                  </div>

                  <form action="/api/public-directory/claim-email/verify" method="post" className="mt-5">
                    <input type="hidden" name="slug" value={business.slug} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="text-sm font-bold text-[#334139]">
                      Verification code
                      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={challengeLocked || challengeExpired} placeholder="000000" className="mt-2 min-h-12 w-full rounded-xl border border-[#cad8ce] bg-white px-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:bg-[#eef0ed] disabled:text-[#89908b]" />
                    </label>
                    <button type="submit" disabled={challengeLocked || challengeExpired} className="mt-4 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Verify email and submit for review</button>
                  </form>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="resend" />
                      <button type="submit" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cbd8ce] bg-white px-4 text-sm font-black text-[#17452f]"><RefreshCw className="h-4 w-4" /> Send new code</button>
                    </form>
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="reset" />
                      <button type="submit" className="min-h-11 w-full rounded-xl border border-[#d7ddd8] bg-white px-4 text-sm font-bold text-[#687169]">Change details</button>
                    </form>
                  </div>
                </div>
              ) : (
                <form action="/api/public-directory/claim-email/send" method="post" className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-5">
                  <input type="hidden" name="slug" value={business.slug} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="action" value="start" />

                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">Email + manual verification</p>
                        <span className="rounded-full bg-[#e4f2e8] px-2.5 py-1 text-[11px] font-black text-[#17452f]">FREE</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">First we verify that you can access the business email. Proffera then manually checks that you are allowed to represent the business.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#334139]">Your name<input name="claimantName" required minLength={2} maxLength={100} defaultValue={session.user.name ?? ""} autoComplete="name" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">Your role in the business<input name="role" required minLength={2} maxLength={80} placeholder="e.g. owner, CEO, authorised signatory" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">Business email<input name="businessEmail" type="email" required maxLength={254} autoComplete="email" placeholder="name@company.se" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">Phone number <span className="font-normal text-[#778078]">(optional)</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-xl bg-white p-4 text-sm leading-6 text-[#4f5c53] ring-1 ring-black/5">
                    <input type="checkbox" name="confirmAuthority" value="yes" required className="mt-1 h-4 w-4 accent-[#17452f]" />
                    <span>I confirm that I personally use this Proffera account and that the information above is correct. I understand that email verification does not grant access until Proffera has also verified my authority to represent the business.</span>
                  </label>

                  <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white">Send code to business email</button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-[#707870]"><Mail className="h-3.5 w-3.5" /> Signed in as {session.user.email ?? "Proffera user"}</p>
                </form>
              )}
            </div>
          ) : (
            <a href={`/logga-in?lang=en&next=${encodeURIComponent(returnTo)}`} className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white">Sign in to continue</a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
