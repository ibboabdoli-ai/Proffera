"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type BookingStep = "details" | "times" | "confirmed";

const availableTimes = ["17:00", "17:30", "18:30", "19:00", "20:00", "20:30", "21:00"];

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

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerDone, setOfferDone] = useState(false);
  const [offerEmail, setOfferEmail] = useState("");
  const [offerConsent, setOfferConsent] = useState(false);

  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    const bookingTriggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-booking-trigger]"),
    );

    const openBooking = (event: Event) => {
      event.preventDefault();
      setBookingOpen(true);
      setStep("details");
    };

    bookingTriggers.forEach((trigger) => trigger.addEventListener("click", openBooking));
    return () => bookingTriggers.forEach((trigger) => trigger.removeEventListener("click", openBooking));
  }, []);

  useEffect(() => {
    const offerTriggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-offer-trigger]"),
    );

    const openOffer = (event: Event) => {
      event.preventDefault();
      setOfferOpen(true);
      setOfferDone(false);
    };

    offerTriggers.forEach((trigger) => trigger.addEventListener("click", openOffer));
    return () => offerTriggers.forEach((trigger) => trigger.removeEventListener("click", openOffer));
  }, []);

  useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-menu-filter]"),
    );
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-menu-category]"),
    );

    const handlers = buttons.map((button) => {
      const handler = () => {
        const selected = button.dataset.menuFilter ?? "all";

        buttons.forEach((item) => {
          const active = item === button;
          item.setAttribute("aria-pressed", active ? "true" : "false");
          item.style.background = active ? "#e0bf73" : "rgba(255,255,255,.05)";
          item.style.color = active ? "#161b17" : "rgba(255,255,255,.60)";
          item.style.borderColor = active ? "transparent" : "rgba(255,255,255,.12)";
        });

        cards.forEach((card) => {
          const categories = (card.dataset.menuCategory ?? "").split(" ");
          const show = selected === "all" || categories.includes(selected);
          card.style.display = show ? "" : "none";
        });
      };

      button.addEventListener("click", handler);
      return { button, handler };
    });

    return () => handlers.forEach(({ button, handler }) => button.removeEventListener("click", handler));
  }, []);

  useEffect(() => {
    if (!bookingOpen && !offerOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBookingOpen(false);
        setOfferOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [bookingOpen, offerOpen]);

  const canContinue = Boolean(date && guests);
  const canConfirm = Boolean(name.trim() && phone.trim() && time);
  const canJoinOffer = Boolean(offerEmail.includes("@") && offerConsent);

  return (
    <>
      {bookingOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5">
          <button
            type="button"
            aria-label="Stäng bokningsdemo"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setBookingOpen(false)}
          />

          <section className="relative z-10 max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#fbf8f1] shadow-[0_35px_120px_rgba(0,0,0,.45)] sm:rounded-[2.2rem]">
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
                <div className="rounded-[1.6rem] bg-[#172019] p-5 text-white sm:p-6">
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
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={String(count)}>{count} {count === 1 ? "gäst" : "gäster"}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-[#e5ded2] bg-white/75 p-4">
                  <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-[#747a74]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#41694f]" />
                    Den färdiga lösningen kan kopplas till restaurangens riktiga bokningssystem. Den här versionen sparar eller skickar ingenting.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep("times")}
                  className="mt-5 w-full rounded-2xl bg-[#172019] px-5 py-4 text-sm font-black text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#252c26] disabled:cursor-not-allowed disabled:opacity-35"
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

                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableTimes.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTime(slot)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${time === slot ? "border-[#172019] bg-[#172019] text-white" : "border-[#d9d4ca] bg-white text-[#1a201b] hover:border-[#b39456]"}`}
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
                  className="mt-6 rounded-full bg-[#172019] px-7 py-3.5 text-sm font-black text-white"
                >
                  Stäng demo
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {offerOpen ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5">
          <button
            type="button"
            aria-label="Stäng erbjudandedemo"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setOfferOpen(false)}
          />

          <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-t-[2rem] bg-[#fbf8f1] shadow-[0_35px_120px_rgba(0,0,0,.45)] sm:rounded-[2.2rem]">
            <div className="flex items-center justify-between border-b border-black/7 px-5 py-4 sm:px-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#927035]">Proffera · erbjudandedemo</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#1a201b]">20% på pasta varje tisdag</h2>
              </div>
              <button
                type="button"
                onClick={() => setOfferOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/8 bg-white text-[#1a201b]"
                aria-label="Stäng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!offerDone ? (
              <div className="p-5 sm:p-7">
                <div className="rounded-[1.7rem] bg-[#d8b66a] p-6 text-[#171b18]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#172019] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                    <Sparkles className="h-3.5 w-3.5 text-[#e7ca84]" /> Gästerbjudande
                  </span>
                  <p className="mt-5 font-serif text-4xl font-semibold leading-none">En anledning att komma tillbaka på tisdag.</p>
                  <p className="mt-4 text-sm font-semibold leading-6 text-black/58">Det här visar hur Doni’s kan samla frivilliga prenumerationer och skicka relevanta erbjudanden via Proffera.</p>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#737a73]">E-post</span>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d7650]" />
                    <input
                      type="email"
                      value={offerEmail}
                      onChange={(event) => setOfferEmail(event.target.value)}
                      placeholder="namn@example.se"
                      className="w-full rounded-2xl border border-[#d9d4ca] bg-white py-3.5 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-[#af8a45] focus:ring-4 focus:ring-[#d8b66a]/15"
                    />
                  </div>
                </label>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e0d9ce] bg-white p-4">
                  <input
                    type="checkbox"
                    checked={offerConsent}
                    onChange={(event) => setOfferConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#172019]"
                  />
                  <span className="text-xs font-semibold leading-5 text-[#6e746e]">Jag vill få erbjudanden och nyheter från Doni’s och kan avsluta prenumerationen när som helst. I den här demon skickas eller lagras ingen e-post.</span>
                </label>

                <button
                  type="button"
                  disabled={!canJoinOffer}
                  onClick={() => setOfferDone(true)}
                  className="mt-5 w-full rounded-2xl bg-[#172019] px-5 py-4 text-sm font-black text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Aktivera demoerbjudande
                </button>
              </div>
            ) : (
              <div className="p-7 text-center sm:p-10">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dce9df] text-[#2e6a47]">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#927035]">Demo klar</p>
                <h3 className="mt-2 font-serif text-4xl font-semibold text-[#1a201b]">Erbjudandet är kopplat.</h3>
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#727872]">I en riktig Proffera-lösning kan den här prenumerationen hamna i restaurangens kundlista, med samtycke och avregistrering hanterad i samma flöde.</p>
                <div className="mx-auto mt-6 max-w-sm rounded-[1.5rem] border border-[#ddd6ca] bg-white p-5 text-left">
                  <p className="flex items-center gap-2 text-sm font-black"><Mail className="h-4 w-4 text-[#8c6d36]" />{offerEmail}</p>
                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6f756f]"><ShieldCheck className="h-4 w-4 text-[#377050]" />Samtycke registrerat i demo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOfferOpen(false)}
                  className="mt-6 rounded-full bg-[#172019] px-7 py-3.5 text-sm font-black text-white"
                >
                  Stäng demo
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
