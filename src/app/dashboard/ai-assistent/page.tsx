import Link from "next/link";
import { ArrowUpRight, Bot, CheckCircle2, Code2, MessageSquareText, Settings2, Unplug } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getWorkspaceAiChatIntegration, isServiceAiChatBridgeConfigured } from "@/lib/service-ai-chat-bridge";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";

type AiAssistantPageProps = {
  searchParams?: Promise<{ error?: string | string[]; synced?: string | string[]; lang?: string | string[] }>;
};

const errorMessages = {
  sv: {
    forbidden: "Endast workspace-owner eller admin kan aktivera AI Chat.",
    "not-entitled": "AI Chat ingår inte i den aktiva planen.",
    provisioning: "AI Chat kunde inte förberedas just nu. Försök igen om en stund.",
    activation: "Aktiveringslänken kunde inte skapas. Försök igen om en stund.",
    fallback: "Något gick fel. Försök igen.",
  },
  en: {
    forbidden: "Only the workspace owner or an administrator can activate AI Chat.",
    "not-entitled": "AI Chat is not included in the active plan.",
    provisioning: "AI Chat could not be prepared right now. Try again shortly.",
    activation: "The activation link could not be created. Try again shortly.",
    fallback: "Something went wrong. Please try again.",
  },
} as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function panelHref(path: string, tenantId: string) {
  return `https://chat.proffera.se${path}?tenant=${encodeURIComponent(tenantId)}`;
}

export default async function AiAssistantPage({ searchParams }: AiAssistantPageProps) {
  const params = searchParams ? await searchParams : {};
  const isEnglish = firstParam(params.lang) === "en";
  const errorValue = firstParam(params.error);
  const syncedValue = firstParam(params.synced);
  const access = await getUserWorkspaceAccess();
  const eligible = access.ok ? await hasDashboardFeatureAccess("ai_assistant") : false;
  const integration = access.ok
    ? await getWorkspaceAiChatIntegration(access.workspaceId)
    : { databaseReady: false, tenantId: null, clientId: null, lifecycle: null, lastErrorCode: null };
  const canManage = canManageWorkspaceSettings(access);
  const active = eligible && integration.lifecycle === "active" && Boolean(integration.tenantId);
  const errors = isEnglish ? errorMessages.en : errorMessages.sv;

  const statusLabel = active
    ? isEnglish ? "Active" : "Aktiv"
    : eligible
      ? isEnglish ? "Ready to activate" : "Redo att aktiveras"
      : isEnglish ? "Not included in the plan" : "Ingår inte i planen";

  const statusHelp = active
    ? isEnglish
      ? "AI Chat is connected to your workspace and appears automatically on your public booking page."
      : "AI Chat är kopplad till din workspace och visas automatiskt på din publika bokningssida."
    : isEnglish
      ? "AI Chat becomes available when a Professional subscription is active."
      : "AI Chat aktiveras först när en Professional-prenumeration är aktiv.";

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Proffera AI Chat"
        title={isEnglish ? "Customer conversations on your website" : "Din kunddialog på webbplatsen"}
        description={
          isEnglish
            ? "Each eligible workspace gets an isolated AI tenant, inbox and widget. Customer conversations are never shared with other Proffera customers."
            : "Varje berättigad workspace får en isolerad AI-tenant, inkorg och widget. Kunddialoger delas aldrig med andra Proffera-kunder."
        }
        icon={Bot}
        actions={
          active ? (
            <a
              href={panelHref("/app/inbox", integration.tenantId!)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-4 text-sm font-bold text-white transition hover:bg-brand-hover"
            >
              {isEnglish ? "Open inbox" : "Öppna inbox"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null
        }
      />

      <section className="rounded-card border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${active ? "bg-[#eaf8f2] text-[#087754]" : eligible ? "bg-[#eef5ff] text-brand" : "bg-surface-subtle text-ink-muted"}`}>
              {active ? <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" /> : <Unplug className="h-[18px] w-[18px]" aria-hidden="true" />}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">{isEnglish ? "Status" : "Status"}</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{statusLabel}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{statusHelp}</p>
            </div>
          </div>
          {active ? <span className="w-fit rounded-full bg-[#eaf8f2] px-3 py-1 text-xs font-bold text-[#087754]">{isEnglish ? "Connected" : "Ansluten"}</span> : null}
        </div>
      </section>

      {errorValue ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-semibold text-danger">{errors[errorValue as keyof typeof errors] ?? errors.fallback}</p> : null}
      {syncedValue === "booking" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-semibold text-[#087754]">{isEnglish ? "The booking page is now connected to your own AI Chat." : "Bokningssidan är nu kopplad till din egen AI Chat."}</p> : null}

      {!access.ok ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-bold text-ink">{isEnglish ? "Select a workspace first" : "Välj en workspace först"}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "AI Chat is managed per workspace and requires an active sign-in." : "AI Chat hanteras per workspace och kräver en aktiv inloggning."}</p>
        </section>
      ) : !eligible ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-bold text-ink">{isEnglish ? "AI Chat is included in Professional" : "AI Chat ingår i Professional"}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "When Professional is active, a dedicated tenant, inbox and installation code are created for your workspace." : "När Professional är aktiv skapas en egen tenant, inkorg och installationskod för din workspace."}</p>
          <Link href={localizedHref("/dashboard/installningar?plan=professional", isEnglish)} className="mt-4 inline-flex min-h-10 items-center rounded-control bg-brand-deep px-4 text-sm font-bold text-white">{isEnglish ? "View plan and billing" : "Se plan och betalning"}</Link>
        </section>
      ) : !isServiceAiChatBridgeConfigured() ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-bold text-ink">{isEnglish ? "AI Chat is being prepared" : "AI Chat förbereds"}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "The connection to the AI Chat service is not configured in this environment yet." : "Kopplingen till AI Chat-tjänsten är inte konfigurerad i den här miljön ännu."}</p>
        </section>
      ) : !active ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-bold text-ink">{isEnglish ? "Activate your AI Chat panel" : "Aktivera din AI Chat-panel"}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "We create a separate tenant and secure account for your workspace. After activation, your own inbox opens." : "Vi skapar en separat tenant och ett säkert konto för din workspace. Efter aktivering öppnas din egen inkorg."}</p>
          {canManage ? (
            <a href={localizedHref("/api/ai-chat/activate", isEnglish)} className="mt-4 inline-flex min-h-10 items-center rounded-control bg-brand-deep px-4 text-sm font-bold text-white">
              {isEnglish ? "Activate AI Chat" : "Aktivera AI Chat"}
            </a>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">{isEnglish ? "Ask the workspace owner or an administrator to activate AI Chat." : "Be workspace-owner eller admin att aktivera AI Chat."}</p>
          )}
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-ink">{isEnglish ? "AI Chat workspace" : "AI Chat-arbetsyta"}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{isEnglish ? "Open the right tool without leaving the Proffera workflow unclear." : "Öppna rätt verktyg utan att tappa Proffera-flödet."}</p>
            </div>
            <div className="divide-y divide-line">
              {[
                {
                  href: panelHref("/app/inbox", integration.tenantId!),
                  icon: MessageSquareText,
                  eyebrow: isEnglish ? "Customer conversations" : "Kunddialoger",
                  title: isEnglish ? "Open inbox" : "Öppna inbox",
                  text: isEnglish ? "View chats and follow up leads from your own website." : "Se chattar och följ upp leads från din egen webbplats.",
                },
                {
                  href: panelHref("/app/settings", integration.tenantId!),
                  icon: Settings2,
                  eyebrow: isEnglish ? "AI and branding" : "AI och varumärke",
                  title: isEnglish ? "Open settings" : "Öppna inställningar",
                  text: isEnglish ? "Configure replies, languages, services and approved domains." : "Ställ in svar, språk, tjänster och godkända domäner.",
                },
                {
                  href: panelHref("/app/widget-install", integration.tenantId!),
                  icon: Code2,
                  eyebrow: isEnglish ? "Installation" : "Installation",
                  title: isEnglish ? "Get widget code" : "Hämta widget-kod",
                  text: isEnglish ? "Copy the unique widget code to your website and test it in demo mode." : "Kopiera den unika widget-koden till din webbplats och testa i demo-läget.",
                },
              ].map((item) => (
                <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="group grid gap-3 px-5 py-4 transition hover:bg-surface-subtle sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-soft text-brand"><item.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">{item.eyebrow}</span>
                    <span className="mt-0.5 block text-sm font-bold text-ink">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-ink-muted">{item.text}</span>
                  </span>
                  <ArrowUpRight className="hidden h-4 w-4 text-brand transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Connection" : "Koppling"}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">{isEnglish ? "Booking page sync" : "Synk med bokningssidan"}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "Keep your booking page connected to the same isolated AI tenant." : "Håll bokningssidan kopplad till samma isolerade AI-tenant."}</p>
                {canManage ? <a href={localizedHref("/api/ai-chat/sync-booking-page", isEnglish)} className="mt-3 inline-flex text-sm font-bold text-brand underline underline-offset-4">{isEnglish ? "Sync AI Chat with booking page" : "Synka AI Chat med bokningssidan"}</a> : null}
              </div>
              {canManage ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Access" : "Åtkomst"}</p>
                  <h3 className="mt-1 text-lg font-bold text-ink">{isEnglish ? "Having trouble signing in?" : "Fungerar inte inloggningen?"}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{isEnglish ? "Create a new AI Chat password. Your Proffera sign-in, subscription and customer conversations are not affected." : "Skapa ett nytt lösenord för AI Chat. Din Proffera-inloggning, prenumeration och kunddialoger påverkas inte."}</p>
                  <a href={localizedHref("/api/ai-chat/activate", isEnglish)} className="mt-3 inline-flex min-h-10 items-center rounded-control border border-line px-4 text-sm font-bold text-brand-deep">{isEnglish ? "Reset AI Chat password" : "Återställ lösenord för AI Chat"}</a>
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
