import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("remaining public experience redesign", () => {
  it("uses the approved restrained marketplace palette without decorative gradients", () => {
    const css = source("src/app/remaining-public-experience.module.css");

    expect(css).toContain("#0a2e63");
    expect(css).toContain("#1469d8");
    expect(css).toContain("#dce4ee");
    expect(css).toContain("#f6f9fd");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("radial-gradient");
  });

  it("keeps public service-job payment token lookup and Stripe authorization intact while preserving locale", () => {
    const page = source("src/app/betala/[token]/page.tsx");
    const checkout = source("src/app/api/public/payments/checkout/route.ts");

    expect(page).toContain("getPublicServiceJobPayment(token)");
    expect(page).toContain("robots: { index: false, follow: false }");
    expect(page).toContain('name="token" value={token}');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain('payment.status === "paid"');
    expect(page).toContain('const awaitingConfirmation = !paid && status === "success"');
    expect(page).toContain("!paid && !awaitingConfirmation");
    expect(page).toContain("Payment received.");
    expect(page).toContain("Betalningen är mottagen.");

    expect(checkout).toContain('payment.status !== "pending"');
    expect(checkout).toContain("!payment.accountReady");
    expect(checkout).toContain("getStripeClient()");
    expect(checkout).toContain("existing = await stripe.checkout.sessions.retrieve(payment.checkoutSessionId);");
    expect(checkout).toContain('error: "checkout_state_unavailable"');
    expect(checkout).not.toContain("checkout.sessions.retrieve(payment.checkoutSessionId).catch(() => null)");
    expect(checkout).toContain("transfer_data: { destination: payment.stripeAccountId }");
    expect(checkout).toContain('payment_kind: "service_job"');
    expect(checkout).toContain('formData?.get("lang") === "en"');
    expect(checkout).toContain('successUrl.searchParams.set("lang", "en")');
    expect(checkout).toContain('cancelUrl.searchParams.set("lang", "en")');
  });

  it("keeps demo registration separate from SaaS signup and bilingual through API redirects", () => {
    const sv = source("src/app/anslut-foretag/registrera/page.tsx");
    const en = source("src/app/en/join-business/register/page.tsx");
    const api = source("src/app/api/foretag/route.ts");

    expect(sv).toContain('action="/api/foretag"');
    expect(sv).toContain('name="website"');
    expect(sv).toContain('name="consentAccepted"');
    expect(en).toContain('action="/api/foretag"');
    expect(en).toContain('name="locale" type="hidden" value="en"');
    expect(api).toContain('formData.get("locale") === "en"');
    expect(api).toContain('"/en/join-business/register"');
    expect(api).toContain('"/en/join-business/thank-you"');
    expect(api).toContain('scope: "company_demo"');
  });

  it("keeps business claims session-bound, verification-gated and language-consistent", () => {
    const claim = source("src/app/foretag/claim/[slug]/page.tsx");
    const english = source("src/app/en/companies/claim/[slug]/page.tsx");

    expect(claim).toContain("hasBetterAuthSessionCookie()");
    expect(claim).toContain("getServerSession()");
    expect(claim).toContain("getPublicDirectoryBusiness(slug)");
    expect(claim).toContain("claim.claimant_user_id = ${String(session.user.id)}");
    expect(claim).toContain('action="/api/public-directory/claim-email/send"');
    expect(claim).toContain('action="/api/public-directory/claim-email/verify"');
    expect(claim).toContain('/en/companies/claim/');
    expect(claim).toContain('/foretag/claim/');
    expect(english).toContain('lang: "en" as const');
    expect(english).toContain("ClaimCompanyPage");
  });

  it("adds real SV/EN counterparts for remaining platform marketing pages and legal language switches", () => {
    const locale = source("src/lib/public-locale.ts");
    const howSv = source("src/app/hur-det-fungerar/page.tsx");
    const howEn = source("src/app/en/how-it-works/page.tsx");
    const catSv = source("src/app/kategorier/page.tsx");
    const catEn = source("src/app/en/categories/page.tsx");
    const svLegal = source("src/components/marketing/swedish-legal-page.tsx");
    const enLegal = source("src/components/marketing/english-legal-page.tsx");

    expect(locale).toContain('{ sv: "/hur-det-fungerar", en: "/en/how-it-works" }');
    expect(locale).toContain('{ sv: "/kategorier", en: "/en/categories" }');
    expect(howSv).toContain('href="/en/how-it-works"');
    expect(howEn).toContain('href="/hur-det-fungerar"');
    expect(catSv).toContain('href="/en/categories"');
    expect(catEn).toContain('href="/kategorier"');
    expect(svLegal).toContain("englishHref");
    expect(enLegal).toContain("swedishHref");
  });
});
