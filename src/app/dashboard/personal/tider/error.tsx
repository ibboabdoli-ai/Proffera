"use client";

export default function ErrorState({ reset }: { reset: () => void }) {
  return <div className="rounded-2xl bg-[#fff5f2] p-6 text-sm text-[#8f2f1b]"><p>Personalplaneringen kunde inte laddas.</p><button type="button" onClick={reset} className="mt-3 rounded-xl border border-[#e0b7b7] bg-white px-4 py-2 font-bold">Försök igen</button></div>;
}
