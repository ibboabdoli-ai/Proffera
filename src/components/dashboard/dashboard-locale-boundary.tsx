"use client";

import { useEffect, useRef } from "react";

const translations: Record<string, string> = {
  "Tillgänglighet": "Availability",
  "Blockera och hantera tider": "Block and manage times",
  "Skapa enstaka eller återkommande blockeringar och ta bort framtida blockeringar när planeringen ändras.": "Create one-time or recurring blocks and remove future blocks when plans change.",
  "Till kalendern": "Back to calendar",
  "Aktiva blockeringar": "Active blocks",
  "Kommande stängda tider": "Upcoming closed times",
  "Inga framtida blockeringar finns.": "There are no future blocks.",
  "Återkommande": "Recurring",
  "Ta bort": "Delete",
  "Enstaka period": "One-time period",
  "Blockera några timmar, en hel dag eller upp till 31 dagar. Tiderna anges i svensk lokal tid.": "Block a few hours, a full day or up to 31 days. Times use Stockholm local time.",
  "Startdatum och tid": "Start date and time",
  "Slutdatum och tid": "End date and time",
  "Orsak": "Reason",
  "Blockera perioden": "Block period",
  "Upprepa varje vecka": "Repeat weekly",
  "Välj dagar, tider och datumintervall. Exempel: lunch måndag–fredag 11:00–12:00.": "Choose weekdays, times and a date range. Example: lunch Monday–Friday 11:00–12:00.",
  "Veckodagar": "Weekdays",
  "Från datum": "From date",
  "Till och med datum": "Through date",
  "Starttid": "Start time",
  "Sluttid": "End time",
  "Skapa återkommande blockeringar": "Create recurring blocks",
  "Måndag": "Monday", "Tisdag": "Tuesday", "Onsdag": "Wednesday", "Torsdag": "Thursday", "Fredag": "Friday", "Lördag": "Saturday", "Söndag": "Sunday",
  "Personal": "Staff",
  "Fördela bokningar": "Assign bookings",
  "Koppla varje bokning till en aktiv medarbetare. Proffera stoppar dubbelbokning för samma medarbetare.": "Assign each booking to an active staff member. Proffera prevents double-booking the same staff member.",
  "Till personalregistret": "Back to staff register",
  "Kommande bokningar": "Upcoming bookings",
  "Nuvarande": "Current",
  "Ingen medarbetare": "No staff member",
  "Spara": "Save",
  "Inga bokningar att fördela.": "No bookings to assign.",
  "Arbetstider och ledighet": "Working hours and time off",
  "Hantera ordinarie arbetspass, lunch, semester, sjukfrånvaro och annan frånvaro per medarbetare.": "Manage regular shifts, lunch, vacation, sick leave and other time off for each staff member.",
  "Till personal": "Back to staff",
  "Ordinarie arbetstid": "Regular working hours",
  "Välj personal": "Select staff",
  "Lägg till arbetstid": "Add working hours",
  "Ledighet eller paus": "Time off or break",
  "Ledighet": "Leave", "Sjuk": "Sick leave", "Paus": "Break", "Annat": "Other",
  "Lägg till frånvaro": "Add time off",
  "Aktuell planering": "Current schedule",
  "Månad": "Month", "Vecka": "Week", "Medarbetare": "Staff",
  "Alla statusar": "All statuses", "Alla medarbetare": "All staff", "Ej fördelade": "Unassigned",
  "Idag": "Today", "Föregående": "Previous", "Nästa": "Next",
  "Utkast": "Draft", "Förfrågan": "Requested", "Bekräftad": "Confirmed", "Klar": "Completed", "Avbokad": "Cancelled", "Uteblev": "No-show",
  "Sjukfrånvaro": "Sick leave", "Rast": "Break", "Ej tillgänglig": "Unavailable", "Ej fördelad": "Unassigned",
};

function translate(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const exact = translations[trimmed];
  if (exact) return text.replace(trimmed, exact);
  return text
    .replace(/(\d+) tider/g, "$1 times")
    .replace(/(\d+) bokningar/g, "$1 bookings")
    .replace(/(\d+) aktiva medarbetare/g, "$1 active staff members")
    .replace(/Nuvarande: /g, "Current: ")
    .replace(/Till exempel: Semester/g, "For example: Vacation")
    .replace(/Till exempel: Lunch/g, "For example: Lunch")
    .replace(/Dra för att flytta/g, "Drag to move");
}

export function DashboardLocaleBoundary({ isEnglish, children }: { isEnglish: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnglish || !ref.current) return;
    const root = ref.current;
    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && !["SCRIPT", "STYLE", "CODE"].includes(parent.tagName)) node.textContent = translate(node.textContent ?? "");
        node = walker.nextNode();
      }
      root.querySelectorAll("a[href^='/dashboard']").forEach((item) => {
        const anchor = item as HTMLAnchorElement;
        const url = new URL(anchor.href, window.location.origin);
        url.searchParams.set("lang", "en");
        anchor.href = `${url.pathname}${url.search}${url.hash}`;
      });
      root.querySelectorAll("form").forEach((form) => {
        if (!form.querySelector('input[name="lang"]')) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "lang";
          input.value = "en";
          form.appendChild(input);
        }
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isEnglish]);

  return <div ref={ref}>{children}</div>;
}
