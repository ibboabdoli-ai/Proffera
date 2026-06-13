const messages = [
  { from: "Besökare", text: "Hej, kan jag boka fönsterputs i Södertälje?" },
  { from: "AI-assistent", text: "Ja. Vilken typ av bostad gäller det och när vill du helst få hjälp?" },
  { from: "Besökare", text: "Lägenhet, helst nästa vecka." },
] as const;

export default function AiAssistantPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">AI-assistent</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">AI-driven kunddialog</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">Preview för hur en AI-assistent kan fånga leads och ställa rätt följdfrågor.</p>
      </section>
      <section className="max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.text} className="rounded-2xl bg-[#f7f7f4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">{message.from}</p>
              <p className="mt-2 text-sm text-[#344139]">{message.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
