const chatActions = [
  {
    title: "Live demo",
    eyebrow: "Testa som besökare",
    description:
      "Öppna Proffera Chat som en webbplatsbesökare ser den. Kontrollera välkomsttext, AI-svar och kundflöde innan widgeten används skarpt.",
    href: "https://chat.proffera.se/demo?tenant=proffera",
    cta: "Öppna live demo",
    priority: "Primär",
  },
  {
    title: "Inkorg",
    eyebrow: "Kunddialoger och leads",
    description:
      "Se inkommande konversationer, följ upp leads och hantera kundmeddelanden från Proffera Chat när modulen är redo att aktiveras.",
    href: "https://chat.proffera.se/app/inbox?tenant=proffera",
    cta: "Öppna inkorg",
    priority: "Primär",
  },
  {
    title: "Installera widget",
    eyebrow: "Kod för webbplatsen",
    description:
      "Förbered installationskoden för Proffera Chat och använd den först när AI-assistentmodulen ska aktiveras skarpt.",
    href: "https://chat.proffera.se/app/widget-install?tenant=proffera",
    cta: "Visa installationskod",
    priority: "Viktig",
  },
  {
    title: "Inställningar",
    eyebrow: "Utseende och AI-regler",
    description:
      "Förbered färger, texter, välkomstmeddelande, widgetposition och andra inställningar innan modulen öppnas för kunder.",
    href: "https://chat.proffera.se/app/settings?tenant=proffera",
    cta: "Öppna inställningar",
    priority: "Viktig",
  },
  {
    title: "Teknisk konfiguration",
    eyebrow: "Widget Config API",
    description:
      "Kontrollera widgetens tekniska konfiguration vid förberedelse, installation och felsökning. Direct access kan kräva rätt domänkälla.",
    href: "https://chat.proffera.se/api/widget-config?clientId=proffera",
    cta: "Visa konfiguration",
    priority: "Teknisk",
  },
] as const;

const setupSteps = [
  {
    step: "1",
    title: "Testa live demo",
    detail: "Säkerställ att Proffera Chat svarar rätt innan widgeten installeras på proffera.se.",
  },
  {
    step: "2",
    title: "Förbered widget",
    detail: "Kontrollera installationskod och inställningar innan modulen aktiveras för riktiga kunder.",
  },
  {
    step: "3",
    title: "Följ upp vid aktivering",
    detail: "När modulen tas i bruk ska konversationer och leads följas upp i Proffera Chats inkorg.",
  },
] as const;

const guardrails = [
  "AI-assistenten är en planerad Proffera-modul för webbplatsens besökare.",
  "Live demo används för test innan ändringar visas för riktiga kunder.",
  "Inkorgen används först skarpt när kundchatten är aktiverad.",
  "Tekniska länkar är främst för förberedelse, installation och felsökning.",
] as const;

export default function AiAssistantPage() {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl bg-[#17452f] shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Proffera Chat</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight !text-white md:text-4xl">
              Förhandsvy för planerad AI-assistent
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
              Den här sidan samlar förhandsvägarna till Proffera Chat. Använd live demo för att granska kundflödet,
              och öppna övriga vyer först när modulen ska förberedas eller aktiveras skarpt.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://chat.proffera.se/demo?tenant=proffera"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef]"
              >
                Öppna live demo
              </a>
              <a
                href="https://chat.proffera.se/app/inbox?tenant=proffera"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold !text-white transition hover:bg-white/10"
              >
                Öppna inkorg
              </a>
            </div>
          </div>
          <aside className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Status</p>
            <p className="mt-3 break-all text-lg font-bold !text-white">Planerad modul</p>
            <p className="mt-3 text-sm leading-7 text-white/75">
              AI-assistenten är förberedd som kommande Proffera-modul. Länkarna går till tenant-säkra vyer med{" "}
              <span className="font-semibold text-white">tenant=proffera</span>.
            </p>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {chatActions.map((item, index) => (
            <article
              key={item.href}
              className={
                index < 2
                  ? "rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#cfdacf] md:min-h-[260px]"
                  : "rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] md:min-h-[240px]"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">{item.eyebrow}</p>
                  <h3 className="mt-2 text-xl font-bold text-[#17201a]">{item.title}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#17452f]">
                  {item.priority}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#5b665f]">{item.description}</p>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-[#17452f] px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-[#0f3322]"
              >
                {item.cta}
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
              </a>
            </article>
          ))}
        </div>

        <aside className="grid gap-4">
          <article className="rounded-3xl bg-[#f7f7f4] p-6 ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Så används sidan</p>
            <h3 className="mt-2 text-xl font-bold text-[#17201a]">Välj rätt väg i Proffera Chat</h3>
            <div className="mt-5 space-y-4">
              {setupSteps.map((item) => (
                <div key={item.step} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17452f] text-sm font-bold !text-white">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#17201a]">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5b665f]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Tydlighet</p>
            <h3 className="mt-2 text-xl font-bold text-[#17201a]">Vad varje länk betyder</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5b665f]">
              {guardrails.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#17452f]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}
