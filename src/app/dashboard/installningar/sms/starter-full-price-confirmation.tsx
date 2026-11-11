"use client";
import { useState } from "react";
import type { StarterFullPriceQuote } from "@/lib/maria-starter-full-price-policy";

export function StarterFullPriceConfirmation({ quote, en }: {
  quote: StarterFullPriceQuote; en: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const date = new Intl.DateTimeFormat(en ? "en-GB" : "sv-SE", {
    dateStyle: "long", timeZone: "Europe/Stockholm",
  }).format(new Date(quote.periodEnd * 1000));
  return <section className="rounded-card border border-line bg-surface p-6">
    <h2 className="text-lg font-bold">{en ? "Switch to full-price Starter" : "Byt till Starter utan rabatt"}</h2>
    <p className="mt-3 text-sm">{en
      ? "You keep the same subscription. Your currently paid period retains its 50 SMS units. No extra charge today."
      : "Du behåller samma abonnemang. Din redan betalda period behåller 50 SMS-enheter. Ingen extra avgift idag."}</p>
    <p className="mt-3 font-semibold">{en
      ? "Current: SEK 150/month (50 units). New price: SEK 299/month (100 units)."
      : "Nu: 150 kr/mån (50 enheter). Nytt pris: 299 kr/mån (100 enheter)."}</p>
    <p className="mt-2 text-sm">{en
      ? "New price starts at the next renewal on " + date + ", after successful full-price payment. Amount includes VAT."
      : "Nytt pris gäller från nästa förnyelse " + date + ", efter betald faktura till fullt pris. Moms ingår."}</p>
    {done ? <p role="status" className="mt-4">{message}</p> : <form className="mt-4 grid gap-4" onSubmit={async e => {
      e.preventDefault(); setSending(true); setMessage("");
      try {
        const response = await fetch("/api/stripe/starter-full-price", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...quote, acknowledged, confirmation }),
        });
        const data = await response.json() as { updated?: boolean; error?: string };
        if (!response.ok) throw Error(data.error || "Request failed");
        setDone(true); setMessage(en ? "Change approved. The next paid renewal activates 100 SMS units."
          : "Bytet är godkänt. Nästa betalda förnyelse aktiverar 100 SMS-enheter.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Request failed");
      } finally { setSending(false); }
    }}>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} required />
        {en ? "I approve the new recurring charge of SEK 299 from the stated renewal date."
          : "Jag godkänner den nya återkommande avgiften 299 kr från angivet förnyelsedatum."}
      </label>
      <label className="grid gap-2 text-sm">
        {en ? "Type CONFIRM 299 SEK" : "Skriv CONFIRM 299 SEK för att bekräfta"}
        <input className="rounded-control border border-line px-3 py-2" required autoComplete="off"
          value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      </label>
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
      <button className="w-fit rounded-control bg-brand-deep px-4 py-2 font-semibold text-white"
        type="submit" disabled={sending || !acknowledged || confirmation !== "CONFIRM 299 SEK"}>
        {sending ? "..." : en ? "Approve next renewal price" : "Godkänn pris vid nästa förnyelse"}
      </button>
    </form>}
  </section>;
}
