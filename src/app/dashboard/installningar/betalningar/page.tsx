import { CheckCircle2, CircleAlert, CreditCard, Landmark, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getWorkspacePaymentAccount, syncWorkspaceStripeConnectAccount } from "@/lib/workspace-payments-db";
import { getPayableWorkspaceServiceJobs } from "@/lib/workspace-service-job-payments";
import { PaymentLinkCreator } from "./payment-link-creator";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Betalningar", title: "Ta betalt av dina kunder", description: "Anslut företagets Stripe-konto. Kundbetalningar hålls separata från ditt Proffera-abonnemang.", ready: "Betalningar är klara", readyBody: "Kontot kan ta emot betalningar och utbetalningar via Stripe.", incomplete: "Stripe behöver mer information", incompleteBody: "Fortsätt onboarding tills både betalningar och utbetalningar är aktiverade.", disconnected: "Stripe Connect är inte anslutet", disconnectedBody: "Anslut ett separat Stripe-konto för företagets kundbetalningar.", locked: "Betalningar är låst för denna workspace", lockedBody: "Aktivera Betalningar från Platform Admin eller använd en plan som inkluderar modulen.", connect: "Anslut Stripe", continue: "Fortsätt Stripe-onboarding", charges: "Ta emot betalningar", payouts: "Utbetalningar", submitted: "Företagsuppgifter", yes: "Klar", no: "Ej klar", note: "Proffera skapar ingen kundbetalning förrän Stripe markerar kontot som redo.", error: "Stripe-anslutningen kunde inte startas. Kontrollera Stripe Connect-konfigurationen och försök igen.", forbidden: "Endast workspace Owner kan hantera betalningskontot.", unconfigured: "Stripe är inte konfigurerat för denna miljö.",
  },
  en: {
    eyebrow: "Payments", title: "Accept payments from your customers", description: "Connect the business Stripe account. Customer payments stay separate from your Proffera subscription.", ready: "Payments are ready", readyBody: "The account can accept payments and receive payouts through Stripe.", incomplete: "Stripe needs more information", incompleteBody: "Continue onboarding until both payments and payouts are enabled.", disconnected: "Stripe Connect is not connected", disconnectedBody: "Connect a separate Stripe account for the business customer payments.", locked: "Payments are locked for this workspace", lockedBody: "Enable Payments from Platform Admin or use a plan that includes the module.", connect: "Connect Stripe", continue: "Continue Stripe onboarding", charges: "Accept payments", payouts: "Payouts", submitted: "Business details", yes: "Ready", no: "Not ready", note: "Proffera will not create a customer payment until Stripe marks the account as ready.", error: "The Stripe connection could not be started. Check the Stripe Connect configuration and try again.", forbidden: "Only the workspace Owner can manage the payment account.", unconfigured: "Stripe is not configured for this environment.",
  },
} as const;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function PaymentsSettingsPage({ searchParams }: { searchParams?: Promise<{ lang?: string | string[]; connect?: string | string[] }> }) {
  const query = await searchParams;
  const locale: Locale = first(query?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];
  const state = first(query?.connect);
  const access = await getUserWorkspaceAccess();
  if (!access.ok) redirect(access.reason === "no_session" ? "/logga-in" : "/dashboard");
  const canManage = canManageWorkspaceMembers(access);
  const featureEnabled = await hasWorkspaceFeature("payments");

  let account = featureEnabled ? await getWorkspacePaymentAccount(access.workspaceId) : null;
  if (featureEnabled && account?.stripeAccountId) {
    try { account = await syncWorkspaceStripeConnectAccount(access.workspaceId); } catch (error) { console.error("Failed to refresh Stripe Connect account", error); }
  }

  const ready = Boolean(account?.ready);
  const jobs = featureEnabled && ready && canManage ? await getPayableWorkspaceServiceJobs(access.workspaceId) : [];
  const statusTitle = !featureEnabled ? text.locked : ready ? text.ready : account ? text.incomplete : text.disconnected;
  const statusBody = !featureEnabled ? text.lockedBody : ready ? text.readyBody : account ? text.incompleteBody : text.disconnectedBody;
  const StatusIcon = !featureEnabled ? LockKeyhole : ready ? CheckCircle2 : CircleAlert;
  const stateMessage = state === "error" ? text.error : state === "forbidden" ? text.forbidden : state === "unconfigured" ? text.unconfigured : state === "locked" ? text.lockedBody : "";

  return (
    <div className="grid gap-6" lang={locale}>
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} icon={CreditCard} />
      {stateMessage ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-semibold text-danger ring-1 ring-[#f4c7ba]">{stateMessage}</p> : null}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-4"><span className={`rounded-control p-3 ${ready ? "bg-[#eaf8f2] text-[#087754]" : "bg-[#fff7df] text-[#805d14]"}`}><StatusIcon className="h-6 w-6" /></span><div><h2 className="text-xl font-black text-ink">{statusTitle}</h2><p className="mt-2 text-sm leading-6 text-ink-muted">{statusBody}</p></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{[[text.submitted, account?.detailsSubmitted], [text.charges, account?.chargesEnabled], [text.payouts, account?.payoutsEnabled]].map(([label, value]) => <div key={String(label)} className="rounded-control border border-line bg-surface-subtle p-4"><p className="text-xs font-black uppercase tracking-wide text-ink-muted">{String(label)}</p><p className="mt-2 font-bold text-ink">{value ? text.yes : text.no}</p></div>)}</div>
          {featureEnabled && canManage && !ready ? <form method="post" action="/api/stripe/connect/onboard" className="mt-6"><input type="hidden" name="lang" value={locale} /><button type="submit" className="min-h-11 rounded-control bg-brand-deep px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">{account ? text.continue : text.connect}</button></form> : null}
        </article>
        <aside className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"><Landmark className="h-6 w-6 text-brand" /><h2 className="mt-4 text-lg font-black text-ink">Stripe Connect</h2><p className="mt-3 text-sm leading-6 text-ink-muted">{text.note}</p></aside>
      </section>
      {featureEnabled && ready && canManage ? <PaymentLinkCreator jobs={jobs} locale={locale} /> : null}
    </div>
  );
}
