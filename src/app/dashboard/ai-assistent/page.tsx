import Link from "next/link";

import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";
import { getWorkspaceAiChatIntegration, isServiceAiChatBridgeConfigured } from "@/lib/service-ai-chat-bridge";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

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

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl bg-[#17452f] shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Proffera AI Chat</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight !text-white md:text-4xl">
              {isEnglish ? "Customer conversations on your website" : "Din kunddialog på webbplatsen"}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
              {isEnglish
                ? "Every Professional workspace receives its own AI tenant, inbox and widget. Your customer conversations are never shared with other Proffera customers."
                : "Varje Professional-workspace får en egen AI-tenant, inkorg och widget. Dina kunddialoger delas aldrig med andra Proffera-kunder."}
            </p>
          </div>
          <aside className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Status</p>
            <p className="mt-3 text-lg font-bold !text-white">
              {active
                ? isEnglish ? "Active" : "Aktiv"
                : eligible
                  ? isEnglish ? "Ready to activate" : "Redo att aktiveras"
                  : isEnglish ? "Not included in the plan" : "Ingår inte i planen"}
            </p>
            <p className="mt-3 text-sm leading-7 text-white/75">
              {active
                ? isEnglish
                  ? "AI Chat is connected to your workspace and appears automatically on your public booking page."
                  : "AI Chat är kopplad till din workspace och visas automatiskt på din publika bokningssida."
                : isEnglish
                  ? "AI Chat becomes available when a Professional subscription is active."
                  : "AI Chat aktiveras först när en Professional-prenumeration är aktiv."}
            </p>
          </aside>
        </div>
      </section>

      {errorValue ? <p className="rounded-2xl bg-[#fff3e8] p-4 text-sm font-semibold text-[#8a3d12]">{errors[errorValue as keyof typeof errors] ?? errors.fallback}</p> : null}
      {syncedValue === "booking" ? <p className="rounded-2xl bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f]">{isEnglish ? "The booking page is now connected to your own AI Chat." : "Bokningssidan är nu kopplad till din egen AI Chat."}</p> : null}

      {!access.ok ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Select a workspace first" : "Välj en workspace först"}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">{isEnglish ? "AI Chat is managed per workspace and requires an active sign-in." : "AI Chat hanteras per workspace och kräver en aktiv inloggning."}</p>
        </section>
      ) : !eligible ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "AI Chat is included in Professional" : "AI Chat ingår i Professional"}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">{isEnglish ? "When Professional is active, a dedicated tenant, inbox and installation code are created for your workspace." : "När Professional är aktiv skapas en egen tenant, inkorg och installationskod för din workspace."}</p>
          <Link href={localizedHref("/dashboard/installningar?plan=professional", isEnglish)} className="mt-5 inline-flex rounded-full bg-[#17452f] px-4 py-2.5 text-sm font-semibold !text-white">{isEnglish ? "View plan and billing" : "Se plan och betalning"}</Link>
        </section>
      ) : !isServiceAiChatBridgeConfigured() ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "AI Chat is being prepared" : "AI Chat förbereds"}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">{isEnglish ? "The connection to the AI Chat service is not configured in this environment yet." : "Kopplingen till AI Chat-tjänsten är inte konfigurerad i den här miljön ännu."}</p>
        </section>
      ) : !active ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Activate your AI Chat panel" : "Aktivera din AI Chat-panel"}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">{isEnglish ? "We create a separate tenant and secure account for your workspace. After activation, your own inbox opens." : "Vi skapar en separat tenant och ett säkert konto för din workspace. Efter aktivering öppnas din egen inkorg."}</p>
          {canManage ? <a href={localizedHref("/api/ai-chat/activate", isEnglish)} className="mt-5 inline-flex rounded-full bg-[#17452f] px-4 py-2.5 text-sm font-semibold !text-white">{isEnglish ? "Activate AI Chat" : "Aktivera AI Chat"}</a> : <p className="mt-4 text-sm text-[#5b665f]">{isEnglish ? "Ask the workspace owner or an administrator to activate AI Chat." : "Be workspace-owner eller admin att aktivera AI Chat."}</p>}
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <a href={panelHref("/app/inbox", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">{isEnglish ? "Customer conversations" : "Kunddialoger"}</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">{isEnglish ? "Open inbox" : "Öppna inbox"}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">{isEnglish ? "View chats and follow up leads from your own website." : "Se chattar och följ upp leads från din egen webbplats."}</p>
            </a>
            <a href={panelHref("/app/settings", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">{isEnglish ? "AI and branding" : "AI och varumärke"}</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">{isEnglish ? "Open settings" : "Öppna inställningar"}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">{isEnglish ? "Configure replies, languages, services and approved domains." : "Ställ in svar, språk, tjänster och godkända domäner."}</p>
            </a>
            <a href={panelHref("/app/widget-install", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">{isEnglish ? "Installation" : "Installation"}</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">{isEnglish ? "Get widget code" : "Hämta widget-kod"}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">{isEnglish ? "Copy the unique widget code to your website and test it in demo mode." : "Kopiera den unika widget-koden till din webbplats och testa i demo-läget."}</p>
            </a>
          </section>
          {canManage ? <a href={localizedHref("/api/ai-chat/sync-booking-page", isEnglish)} className="w-fit text-sm font-semibold text-[#17452f] underline underline-offset-4">{isEnglish ? "Sync AI Chat with booking page" : "Synka AI Chat med bokningssidan"}</a> : null}
          {canManage ? (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <h3 className="text-lg font-bold text-[#17201a]">{isEnglish ? "Having trouble signing in?" : "Fungerar inte inloggningen?"}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5b665f]">{isEnglish ? "Create a new AI Chat password. Your Proffera sign-in, subscription and customer conversations are not affected." : "Skapa ett nytt lösenord för AI Chat. Din Proffera-inloggning, prenumeration och kunddialoger påverkas inte."}</p>
              <a href={localizedHref("/api/ai-chat/activate", isEnglish)} className="mt-4 inline-flex rounded-full border border-[#17452f] px-4 py-2.5 text-sm font-semibold text-[#17452f]">{isEnglish ? "Reset AI Chat password" : "Återställ lösenord för AI Chat"}</a>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
