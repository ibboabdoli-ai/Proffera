const stats = [
  { label: "AI-konversationer", value: "38", helper: "Senaste 30 dagarna" },
  { label: "Leads fångade", value: "14", helper: "Skickade vidare till sälj" },
  { label: "Svarstid", value: "< 10 sek", helper: "Första svar till besökare" },
  { label: "Vanligaste ärendet", value: "Boka tid", helper: "Högst intentandel" },
] as const;

const messages = [
  { from: "Besökare", text: "Hej, kan jag boka fönsterputs i Södertälje nästa vecka?", side: "left" },
  { from: "AI-assistent", text: "Absolut. Gäller det lägenhet, villa eller kontor?", side: "right" },
  { from: "Besökare", text: "Lägenhet, ungefär 70 kvadratmeter.", side: "left" },
  { from: "AI-assistent", text: "Tack. Jag samlar kontaktuppgifter, föreslår en passande tid och skickar ärendet vidare för bekräftelse.", side: "right" },
] as const;

const intents = [
  { label: "Boka tid", value: "42%" },
  { label: "Prisfråga", value: "31%" },
  { label: "Tjänstefråga", value: "19%" },
  { label: "Övrigt", value: "8%" },
] as const;

const capabilities = [
  {
    title: "Kvalificera nya leads",
    description: "Ställ följdfrågor om tjänst, ort, tid och kontaktuppgifter innan ärendet skickas vidare.",
    status: "Aktiv",
  },
  {
    title: "Föreslå nästa steg",
    description: "Visa om kunden bör ringas, få offert, bokas in eller följas upp av teamet.",
    status: "Redo",
  },
  {
    title: "Svara konsekvent",
    description: "Använd samma ton, information och process i varje kunddialog, även när teamet är upptaget.",
    status: "Planerad",
  },
] as const;

const workflow = [
  { step: "1", title: "Fråga kommer in", detail: "Webb, QR-flöde eller chatt startar dialogen." },
  { step: "2", title: "AI samlar behov", detail: "Tjänst, ort, tid, omfattning och kontaktuppgifter struktureras." },
  { step: "3", title: "Lead blir åtgärd", detail: "Teamet ser nästa steg och kan snabbt boka eller följa upp." },
] as const;

type CapabilityStatus = (typeof capabilities)[number]["status"];

const statusStyles: Record<CapabilityStatus, string> = {
  Aktiv: "bg-[#e7f1eb] text-[#17452f]",
  Redo: "bg-[#e7edf8] text-[#1f3f6f]",
  Planerad: "bg-[#fff4d7] text-[#6f4f00]",
};

export default function AiAssistantPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">AI-assistent</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#17201a]">Automatisera första kunddialogen</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Här visas hur AI-assistenten hjälper verksamheten att fånga nya förfrågningar, ställa rätt följdfrågor och skicka vidare tydliga leads till teamet.
            </p>
          </div>
          <div className="rounded-2xl bg-[#eef5ef] px-4 py-3 text-sm font-semibold text-[#17452f]">
            14 leads fångade
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-xs text-[#6d7770]">{item.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="border-b border-[#dfe5dd] px-5 py-4">
            <h3 className="text-lg font-bold text-[#17201a]">Kunddialog</h3>
            <p className="mt-1 text-sm text-[#5b665f]">Exempel på hur en ny förfrågan kan kvalificeras innan den blir ett lead.</p>
          </div>
          <div className="space-y-3 p-5">
            {messages.map((message) => (
              <div
                key={message.text}
                className={
                  message.side === "right"
                    ? "ml-auto max-w-xl rounded-2xl bg-[#17452f] p-4 !text-white"
                    : "max-w-xl rounded-2xl bg-[#f7f7f4] p-4 text-[#344139]"
                }
              >
                <p className={message.side === "right" ? "text-xs font-semibold uppercase tracking-wide text-white/70" : "text-xs font-semibold uppercase tracking-wide text-[#17452f]"}>
                  {message.from}
                </p>
                <p className="mt-2 text-sm leading-6">{message.text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid gap-4">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <h3 className="text-xl font-bold text-[#17201a]">Intentfördelning</h3>
            <p className="mt-2 text-sm leading-7 text-[#5b665f]">Vilka ärenden besökare oftast tar upp i chatten.</p>
            <div className="mt-4 space-y-3">
              {intents.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm text-[#344139]">
                    <span>{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7ece5]">
                    <div className="h-2 rounded-full bg-[#17452f]" style={{ width: item.value }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-3xl bg-[#17452f] p-6 !text-white">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Nästa steg</p>
            <h3 className="mt-2 text-xl font-bold">Koppla till riktiga frågor</h3>
            <p className="mt-3 text-sm leading-7 text-white/80">
              När nästa integrationsfas är klar kan AI-assistenten använda företagskunskap, tjänster, öppettider och notifieringar i riktiga kundflöden.
            </p>
          </article>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {capabilities.map((item) => (
          <article key={item.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-[#17201a]">{item.title}</h3>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>{item.status}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="border-b border-[#dfe5dd] px-5 py-4">
          <h3 className="text-lg font-bold text-[#17201a]">AI-flöde från fråga till åtgärd</h3>
          <p className="mt-1 text-sm text-[#5b665f]">En enkel arbetsordning för hur assistenten kan avlasta teamet.</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.step} className="rounded-2xl bg-[#f7f7f4] p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17452f] text-sm font-bold !text-white">{item.step}</span>
              <h4 className="mt-4 font-bold text-[#17201a]">{item.title}</h4>
              <p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
