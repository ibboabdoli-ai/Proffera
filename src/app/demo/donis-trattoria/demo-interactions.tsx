"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, X } from "lucide-react";

type BookingStep = "details" | "times" | "confirmed";

const availableTimes = ["17:00", "18:00", "19:00", "20:00", "21:00"];

function formatSwedishDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function DemoInteractions() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [step, setStep] = useState<BookingStep>("details");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState("19:00");

  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    const bookingTriggers = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="#boka"]'),
    );
    const availabilityButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Visa lediga bord"),
    );

    const openBooking = (event: Event) => {
      event.preventDefault();
      setBookingOpen(true);
      setStep("details");
    };

    bookingTriggers.forEach((trigger) => trigger.addEventListener("click", openBooking));
    availabilityButton?.addEventListener("click", openBooking);

    return () => {
      bookingTriggers.forEach((trigger) => trigger.removeEventListener("click", openBooking));
      availabilityButton?.removeEventListener("click", openBooking);
    };
  }, []);

  useEffect(() => {
    const menuSection = document.querySelector<HTMLElement>("#meny");
    if (!menuSection) return;

    const chips = Array.from(menuSection.querySelectorAll<HTMLSpanElement>("span")).filter((span) =>
      ["Populärt", "Pizza", "Pasta", "Kött", "Vegetariskt"].includes(span.textContent?.trim() ?? ""),
    );
    const cards = Array.from(menuSection.querySelectorAll<HTMLElement>("article"));

    const classify = (card: HTMLElement) => {
      const text = card.textContent?.toLowerCase() ?? "";
      if (text.includes("mare mare")) return "Pizza";
      if (text.includes("fettuccine") || text.includes("penne")) return "Pasta";
      return "Populärt";
    };

    const handlers = chips.map((chip) => {
      const handler = () => {
        const selected = chip.textContent?.trim() || "Populärt";
        chips.forEach((item) => {
          const active = item === chip;
          item.style.background = active ? "#1a201b" : "rgba(255,255,255,.55)";
          item.style.color = active ? "white" : "#565d57";
          item.style.cursor = "pointer";
        });
        cards.forEach((card) => {
          const category = classify(card);
          card.style.display = selected === "Populärt" || category === selected ? "" : "none";
        });
      };
      chip.style.cursor = "pointer";
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.addEventListener("click", handler);
      chip.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") handler();
      });
      return { chip, handler };
    });

    return () => handlers.forEach(({ chip, handler }) => chip.removeEventListener("click", handler));
  }, []);

  useEffect(() => {
    if (!bookingOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBookingOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [bookingOpen]);

  if (!bookingOpen) return null;

  const canContinue = Boolean(date && guests);
  const canConfirm = Boolean(name.trim() && phone.trim() && time);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Stäng bokningsdemo"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => setBookingOpen(false)}
      />

      <section className="relative z-10 max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#fbf8f1] shadow-[0_35px_120px_rgba(0,0,0,.4)] sm:rounded-[2rem]">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-black/7 bg-[#fbf8f1]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#927035]">Doni’s Trattoria</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-[#1a201b]">Boka bord · demo</h2>
          </div>
          <button
            type="button"
            onClick={() => setBookingOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full border border-black/8 bg-white text-[#1a201b] transition hover:bg-[#f1eadc]"
            aria-label="Stäng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "details" ? (
          <div className="p-5 sm:p-7">
            <div className="rounded-[1.5rem] bg-[#1a201b] p-5 text-white sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#e8cb8a]">Steg 1 av 2</p>
              <p className="mt-2 font-serif text-3xl font-semibold">När vill ni komma?</p>
              <p className="mt-2 text-sm leading-6 text-white/55">Välj datum och antal gäster. Inga riktiga bokningar skickas från den här demon.</p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#737a73]">Datum</span>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-2xl border border-[#d9d4ca] bg-white px-4 py-3.5 text-sm font-bold outline-none transition focus:border-[#af8a45] focus:ring-4 focus:ring-[#d8b66a]/15"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#737a73]">Antal gäster</span>
                <select
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  className="w-full rounded-2xl border border-[#d9d4ca] bg-white px-4 py-3.5 text-sm font-bold outline-none transition focus:border-[#af8a45] focus:ring-4 focus:ring-[#d8b66a]/15"
                >
                  {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={String(count)}>{count} {count === 1 ? "gäst" : "gäster"}</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep("times")}
              className="mt-5 w-full rounded-2xl bg-[#1a201b] px-5 py-4 text-sm font-black text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#252c26] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Visa lediga tider
            </button>
          </div>
        ) : null}

        {step === "times" ? (
          <div className="p-5 sm:p-7">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mb-5 inline-flex items-center gap-1 text-xs font-black text-[#6c716c] hover:text-[#1a201b]"
            >
              <ChevronLeft className="h-4 w-4" /> Ändra datum
            </button>

            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#927035]">{formatSwedishDate(date)} · {guests} {guests === "1" ? "gäst" : "gäster"}</p>
            <h3 className="mt-2 font-serif text-3xl font-semibold text-[#1a201b]">Välj en ledig tid</h3>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availableTimes.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${time === slot ? "border-[#1a201b] bg-[#1a201b] text-white" : "border-[#d9d4ca] bg-white text-[#1a201b] hover:border-[#b39456]"}`}
                >
                  {slot}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#737a73]">Namn</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ditt namn"
                  className="w-full rounded-2xl border border-[#d9d4ca] bg-white px-4 py-3.5 text-sm font-bold outline-none transition focus:border-[#af8a45] focus:ring-4 focus:ring-[#d8b66a]/15"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#737a73]">Mobilnummer</span>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="07x xxx xx xx"
                  className="w-full rounded-2xl border border-[#d9d4ca] bg-white px-4 py-3.5 text-sm font-bold outline-none transition focus:border-[#af8a45] focus:ring-4 focus:ring-[#d8b66a]/15"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => setStep("confirmed")}
              className="mt-5 w-full rounded-2xl bg-[#d8b66a] px-5 py-4 text-sm font-black text-[#1a201b] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#e5c57b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Bekräfta demobokning
            </button>
          </div>
        ) : null}

        {step === "confirmed" ? (
          <div className="p-6 text-center sm:p-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dce9df] text-[#2e6a47]">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#927035]">Demobokning klar</p>
            <h3 className="mt-2 font-serif text-4xl font-semibold text-[#1a201b]">Så här enkelt kan gästen boka.</h3>
            <div className="mx-auto mt-6 max-w-md rounded-[1.5rem] border border-[#ddd6ca] bg-white p-5 text-left">
              <div className="flex justify-between gap-4 border-b border-black/6 pb-3 text-sm"><span className="font-bold text-[#7a807a]">Datum</span><span className="font-black">{formatSwedishDate(date)}</span></div>
              <div className="flex justify-between gap-4 border-b border-black/6 py-3 text-sm"><span className="font-bold text-[#7a807a]">Tid</span><span className="font-black">{time}</span></div>
              <div className="flex justify-between gap-4 border-b border-black/6 py-3 text-sm"><span className="font-bold text-[#7a807a]">Gäster</span><span className="font-black">{guests}</span></div>
              <div className="flex justify-between gap-4 pt-3 text-sm"><span className="font-bold text-[#7a807a]">Namn</span><span className="font-black">{name}</span></div>
            </div>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-[#767c76]">I en riktig lösning kan bokningen skickas vidare till restaurangens bokningssystem och samtidigt kopplas till kundhistoriken i Proffera.</p>
            <button
              type="button"
              onClick={() => setBookingOpen(false)}
              className="mt-6 rounded-full bg-[#1a201b] px-7 py-3.5 text-sm font-black text-white"
            >
              Stäng demo
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
