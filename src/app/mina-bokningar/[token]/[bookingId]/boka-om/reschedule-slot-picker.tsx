"use client";

import { useState } from "react";

import styles from "../../../customer-portal.module.css";

type Slot = { startsAtLocal: string; label: string };

type Props = {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
  selectedDayLabel?: string;
  language?: "sv" | "en" | "ar";
};

export function RescheduleSlotPicker({ slots, action, selectedDayLabel, language = "sv" }: Props) {
  const [selected, setSelected] = useState("");
  const selectedSlot = slots.find((slot) => slot.startsAtLocal === selected);
  const isEnglish = language === "en";
  const isArabic = language === "ar";
  const t = (sv: string, en: string, ar: string) => isArabic ? ar : isEnglish ? en : sv;

  return (
    <form action={action} className={styles.slotForm}>
      <fieldset>
        <legend className="sr-only">{t("Välj en ledig tid", "Choose an available time", "اختر وقتًا متاحًا")}</legend>
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
          {t("Vald tid", "Selected time", "الموعد المختار")}: {selectedDayLabel ? `${selectedDayLabel}${isArabic ? "، الساعة " : isEnglish ? " at " : " kl. "}` : ""}{selectedSlot.label}
        </p>
      ) : (
        <p className={styles.slotHelp}>{t("Välj en tid för att fortsätta.", "Choose a time to continue.", "اختر وقتًا للمتابعة.")}</p>
      )}

      <p className={styles.slotHelp}>
        {t(
          "Tiderna är redan kontrollerade mot arbetstid, medarbetarens frånvaro, andra bokningar och tillfälligt reserverade tider. Tillgängligheten kontrolleras igen när du sparar.",
          "Times have already been checked against working hours, staff time off, other bookings and temporarily reserved slots. Availability is checked again when you save.",
          "تم التحقق من الأوقات مقابل ساعات العمل والحجوزات الأخرى والأوقات المحجوزة مؤقتًا. سنعيد التحقق عند الحفظ."
        )}
      </p>
      <button disabled={!selected} className={styles.saveButton}>
        {t("Spara vald tid", "Save selected time", "حفظ الموعد المختار")}
      </button>
    </form>
  );
}
