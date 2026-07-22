import Link from "next/link";

import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";
import { getWorkspaceAiChatIntegration, isServiceAiChatBridgeConfigured } from "@/lib/service-ai-chat-bridge";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

type AiAssistantPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  forbidden: "Endast workspace-owner eller admin kan aktivera AI Chat.",
  "not-entitled": "AI Chat ingår inte i den aktiva planen.",
  provisioning: "AI Chat kunde inte förberedas just nu. Försök igen om en stund.",
  activation: "Aktiveringslänken kunde inte skapas. Försök igen om en stund.",
};

function panelHref(path: string, tenantId: string) {
  return `https://chat.proffera.se${path}?tenant=${encodeURIComponent(tenantId)}`;
}

export default async function AiAssistantPage({ searchParams }: AiAssistantPageProps) {
  const params = searchParams ? await searchParams : {};
  const access = await getUserWorkspaceAccess();
  const eligible = access.ok ? await hasDashboardFeatureAccess("ai_assistant") : false;
  const integration = access.ok
    ? await getWorkspaceAiChatIntegration(access.workspaceId)
    : { databaseReady: false, tenantId: null, clientId: null, lifecycle: null, lastErrorCode: null };
  const canManage = canManageWorkspaceSettings(access);
  const active = eligible && integration.lifecycle === "active" && Boolean(integration.tenantId);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl bg-[#17452f] shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Proffera AI Chat</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight !text-white md:text-4xl">Din kunddialog på webbplatsen</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
              Varje Professional-workspace får en egen AI-tenant, inkorg och widget. Dina kunddialoger delas aldrig med andra Proffera-kunder.
            </p>
          </div>
          <aside className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Status</p>
            <p className="mt-3 text-lg font-bold !text-white">
              {active ? "Aktiv" : eligible ? "Redo att aktiveras" : "Ingår inte i planen"}
            </p>
            <p className="mt-3 text-sm leading-7 text-white/75">
              {active ? "AI Chat är kopplad till din workspace och redo för inställning och installation." : "AI Chat aktiveras först när en Professional-prenumeration är aktiv."}
            </p>
          </aside>
        </div>
      </section>

      {params.error ? <p className="rounded-2xl bg-[#fff3e8] p-4 text-sm font-semibold text-[#8a3d12]">{errorMessages[params.error] ?? "Något gick fel. Försök igen."}</p> : null}

      {!access.ok ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Välj en workspace först</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">AI Chat hanteras per workspace och kräver en aktiv inloggning.</p>
        </section>
      ) : !eligible ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">AI Chat ingår i Professional</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">När Professional är aktiv skapas en egen tenant, inkorg och installationskod för din workspace.</p>
          <Link href="/dashboard/installningar?plan=professional" className="mt-5 inline-flex rounded-full bg-[#17452f] px-4 py-2.5 text-sm font-semibold !text-white">Se plan och betalning</Link>
        </section>
      ) : !isServiceAiChatBridgeConfigured() ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">AI Chat förbereds</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">Kopplingen till AI Chat-tjänsten är inte konfigurerad i den här miljön ännu.</p>
        </section>
      ) : !active ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Aktivera din AI Chat-panel</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">Vi skapar en separat tenant och ett säkert konto för din workspace. Efter aktivering öppnas din egen inkorg.</p>
          {canManage ? <a href="/api/ai-chat/activate" className="mt-5 inline-flex rounded-full bg-[#17452f] px-4 py-2.5 text-sm font-semibold !text-white">Aktivera AI Chat</a> : <p className="mt-4 text-sm text-[#5b665f]">Be workspace-owner eller admin att aktivera AI Chat.</p>}
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <a href={panelHref("/app/inbox", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunddialoger</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">Öppna inbox</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">Se chattar och följ upp leads från din egen webbplats.</p>
            </a>
            <a href={panelHref("/app/settings", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">AI och varumärke</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">Öppna inställningar</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">Ställ in svar, språk, tjänster och godkända domäner.</p>
            </a>
            <a href={panelHref("/app/widget-install", integration.tenantId!)} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Installation</p>
              <h3 className="mt-2 text-xl font-bold text-[#17201a]">Hämta widget-kod</h3>
              <p className="mt-3 text-sm leading-6 text-[#5b665f]">Kopiera den unika widget-koden till din webbplats och testa i demo-läget.</p>
            </a>
          </section>

          {canManage ? (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <h3 className="text-lg font-bold text-[#17201a]">Fungerar inte inloggningen?</h3>
              <p className="mt-2 text-sm leading-6 text-[#5b665f]">Skapa ett nytt lösenord för AI Chat. Din Proffera-inloggning, prenumeration och kunddialoger påverkas inte.</p>
              <a href="/api/ai-chat/activate" className="mt-4 inline-flex rounded-full border border-[#17452f] px-4 py-2.5 text-sm font-semibold text-[#17452f]">Återställ lösenord för AI Chat</a>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
