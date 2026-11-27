"use client";

import { useRef } from "react";

type Props = {
  label: string;
  confirmation: string;
  disabled?: boolean;
  kind?: "close" | "open";
};

export function MariaCalendarConfirmButton({label,confirmation,disabled,kind="close"}: Props) {
  const confirmationField = useRef<HTMLInputElement>(null);
  return (<>
    <input type="hidden" name="confirmed" defaultValue="no" ref={confirmationField} />
    <button
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        const input = confirmationField.current;
        if (!input) { event.preventDefault(); return; }
        input.value = "no";
        if (!window.confirm(confirmation)) { event.preventDefault(); return; }
        input.value = "yes";
      }}
      className={kind === "close"
        ? "min-h-11 rounded-lg bg-[#845363] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6d3e4e] disabled:cursor-not-allowed disabled:opacity-45"
        : "min-h-11 rounded-lg border border-[#bfa1a9] bg-white px-4 py-2.5 text-sm font-semibold text-[#754b5a] hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-45"}
    >
      {label}
    </button>
  </>);
}
