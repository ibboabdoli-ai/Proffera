const messages = [
  { from: "Besökare", text: "Hej, kan jag boka fönsterputs i Södertälje?", side: "left" },
  { from: "AI-assistent", text: "Ja. Vilken typ av bostad gäller det och när vill du helst få hjälp?", side: "right" },
  { from: "Besökare", text: "Lägenhet, helst nästa vecka.", side: "left" },
  { from: "AI-assistent", text: "Toppen. Jag kan ta dina kontaktuppgifter och skicka förfrågan vidare till rätt team.", side: "right" },
] as const;

const intents = [
  { label: "Boka tid", value: "42%" },
  { label: "Prisfråga", value: "31%" },
  { label: "Tjänstefråga", value: "19%" },
  { label: "Övrigt", value: "8%" },
] as const;

export default function AiAssistantPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">AI-assistent</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">AI-driven kunddialog</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Preview för hur en AI-assistent kan fånga leads, ställa följdfrågor och strukturera kunddialoger.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#17201a]">Chatt-preview</h3>
              <p className="text-sm text-[#5b665f]">Exempel på leadkvalificering.</p>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">AI preview</span>
          </div>
          <div className="mt-5 space-y-3">
            {messages.map((message) => (
              <div key={message.text} className={message.side === "right" ? "ml-auto max-w-xl rounded-2xl bg-[#17452f] p-4 text-white" : "max-w-xl rounded-2xl bg-[#f7f7f4] p-4 text-[#344139]"}>
                <p className={message.side === "right" ? "text-xs font-semibold uppercase tracking-wide text-white/70" : "text-xs font-semibold uppercase tracking-wide text-[#17452f]"}>{message.from}</p>
                <p className="mt-2 text-sm leading-6">{message.text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid gap-4">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <h3 className="text-xl font-bold text-[#17201a]">Intent preview</h3>
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
          <article className="rounded-3xl bg-[#17452f] p-6 text-white">
            <h3 className="text-xl font-bold">Kommande funktion</h3>
            <p className="mt-3 text-sm leading-7 text-white/80">
              AI-flödet kan senare kopplas till riktiga frågor, företagskunskap, leadformulär och notifieringar.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
