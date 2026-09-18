"use client";

import { useState } from "react";

import styles from "../../../customer-portal.module.css";

type Slot = { startsAtLocal: string; label: string };

type Props = {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
  selectedDayLabel?: string;
  language?: "sv" | "en";
};

export function RescheduleSlotPicker({ slots, action, selectedDayLabel, language = "sv" }: Props) {
  const [selected, setSelected] = useState("");
  const selectedSlot = slots.find((slot) => slot.startsAtLocal === selected);
  const isEnglish = language === "en";

  return (
    <form action={action} className={styles.slotForm}>
      <fieldset>
        <legend className="sr-only">{isEnglish ? "Choose an available time" : "Välj en ledig tid"}</legend>
        <div className={styles.slotGrid}>
          {slots.map((slot) => (
            <label key={slot.startsAtLocal} className={styles.slotLabel}>
              <input
                className={styles.slotInput}
                type="radio"
                name="startsAtLocal"
                value={slot.startsAtLocal}
                required
                checked={selected === slot.startsAtLocal}
                onChange={() => setSelected(slot.startsAtLocal)}
              />
              <span className={styles.slotOption}>{slot.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {selectedSlot ? (
        <p className={styles.selectedNotice} role="status">
          {isEnglish ? "Selected time" : "Vald tid"}: {selectedDayLabel ? `${selectedDayLabel}${isEnglish ? " at " : " kl. "}` : ""}{selectedSlot.label}
        </p>
      ) : (
        <p className={styles.slotHelp}>{isEnglish ? "Choose a time to continue." : "Välj en tid för att fortsätta."}</p>
      )}

      <p className={styles.slotHelp}>
        {isEnglish
          ? "Times have already been checked against working hours, staff time off, other bookings and temporarily reserved slots. Availability is checked again when you save."
          : "Tiderna är redan kontrollerade mot arbetstid, medarbetarens frånvaro, andra bokningar och tillfälligt reserverade tider. Tillgängligheten kontrolleras igen när du sparar."}
      </p>
      <button disabled={!selected} className={styles.saveButton}>
        {isEnglish ? "Save selected time" : "Spara vald tid"}
      </button>
    </form>
  );
}
