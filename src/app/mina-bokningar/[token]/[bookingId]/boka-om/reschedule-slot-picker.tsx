"use client";

import { useState } from "react";

type Slot = { startsAtLocal: string; label: string };

type Props = {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
  selectedDayLabel?: string;
};

export function RescheduleSlotPicker({ slots, action, selectedDayLabel }: Props) {
  const [selected, setSelected] = useState("");
  const selectedSlot = slots.find((slot) => slot.startsAtLocal === selected);

  return (
    <form action={action} className="mt-4">
      <fieldset>
        <legend className="sr-only">Välj en ledig tid</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {slots.map((slot) => (
            <label key={slot.startsAtLocal} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="startsAtLocal"
                value={slot.startsAtLocal}
                required
                checked={selected === slot.startsAtLocal}
                onChange={() => setSelected(slot.startsAtLocal)}
              />
              <span className="grid min-h-14 place-items-center rounded-xl border border-[#b9ccc0] bg-[#f3f8f4] px-4 py-3 text-base font-bold text-[#17452f] transition peer-checked:border-[#17452f] peer-checked:bg-[#17452f] peer-checked:text-white hover:border-[#17452f]">
                {slot.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selectedSlot ? (
        <p className="mt-5 rounded-xl bg-[#edf5ef] p-4 text-sm font-bold text-[#17452f]" role="status">
          Vald tid: {selectedDayLabel ? `${selectedDayLabel} kl. ` : ""}{selectedSlot.label}
        </p>
      ) : (
        <p className="mt-5 text-sm font-semibold text-[#667168]">Välj en tid för att fortsätta.</p>
      )}

      <p className="mt-4 text-xs leading-5 text-[#667168]">Tiderna är redan kontrollerade mot arbetstid, medarbetarens frånvaro, andra bokningar och tillfälligt reserverade tider. Tillgängligheten kontrolleras igen när du sparar.</p>
      <button
        disabled={!selected}
        className="mt-5 min-h-12 w-full rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white hover:bg-[#123824] disabled:cursor-not-allowed disabled:bg-[#aebbb2]"
      >
        Spara vald tid
      </button>
    </form>
  );
}
