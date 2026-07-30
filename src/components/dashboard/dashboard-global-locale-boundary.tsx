"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const translations: Record<string, string> = {
  "Åtkomst saknas": "Access denied",
  "Du har inte behörighet att visa den här sidan. Kontakta Proffera om du tror att detta är fel.": "You do not have permission to view this page. Contact Proffera if you believe this is incorrect.",
  "Spara": "Save", "Sparar...": "Saving...", "Ta bort": "Remove", "Avbryt": "Cancel", "Stäng": "Close",
  "Redigera": "Edit", "Skapa": "Create", "Lägg till": "Add", "Tillbaka": "Back", "Nästa": "Next",
  "Föregående": "Previous", "Sök": "Search", "Filtrera": "Filter", "Rensa": "Clear", "Visa": "View",
  "Aktiv": "Active", "Inaktiv": "Inactive", "Kommande": "Coming soon", "Planerad": "Planned", "Låst": "Locked",
  "Bekräftad": "Confirmed", "Avbokad": "Cancelled", "Klar": "Completed", "Förfrågan": "Requested", "Utkast": "Draft",
  "Ingen data": "No data", "Inga resultat": "No results", "Ej angivet": "Not provided", "Ej tilldelad": "Unassigned",
  "Kund": "Customer", "Kunder": "Customers", "Bokning": "Booking", "Bokningar": "Bookings", "Tjänst": "Service", "Tjänster": "Services",
  "Personal": "Staff", "Medarbetare": "Staff member", "Kalender": "Calendar", "Inställningar": "Settings", "Översikt": "Overview",
  "Namn": "Name", "E-post": "Email", "Telefon": "Phone", "Adress": "Address", "Ort": "City", "Status": "Status",
  "Datum": "Date", "Tid": "Time", "Start": "Start", "Slut": "End", "Beskrivning": "Description", "Kategori": "Category",
  "Anteckningar": "Notes", "Meddelande": "Message", "Åtgärder": "Actions", "Roll": "Role", "Område": "Area",
  "Idag": "Today", "Måndag": "Monday", "Tisdag": "Tuesday", "Onsdag": "Wednesday", "Torsdag": "Thursday",
  "Fredag": "Friday", "Lördag": "Saturday", "Söndag": "Sunday", "Månad": "Month", "Vecka": "Week",
  "Öppnar": "Opens", "Stänger": "Closes", "Stängt": "Closed", "Publicerad": "Published", "Ej publicerad": "Not published",
  "Lyckades": "Success", "Något gick fel": "Something went wrong", "Försök igen": "Try again",
};

function translateText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const exact = translations[trimmed];
  if (exact) return value.replace(trimmed, exact);
  return value
    .replace(/(\d+) bokningar\b/g, "$1 bookings")
    .replace(/(\d+) kunder\b/g, "$1 customers")
    .replace(/(\d+) tjänster\b/g, "$1 services")
    .replace(/(\d+) medlemmar\b/g, "$1 members")
    .replace(/ · Du\b/g, " · You")
    .replace(/Till exempel:/g, "For example:")
    .replace(/Gäller till /g, "Valid until ");
}

export function DashboardGlobalLocaleBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname.startsWith("/dashboard") && searchParams.get("lang") === "en";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && !["SCRIPT", "STYLE", "CODE"].includes(parent.tagName)) {
          const current = node.textContent ?? "";
          const translated = translateText(current);
          if (translated !== current) node.textContent = translated;
        }
        node = walker.nextNode();
      }

      root.querySelectorAll("a[href^='/dashboard']").forEach((element) => {
        const anchor = element as HTMLAnchorElement;
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
      root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((element) => {
        const field = element as HTMLInputElement | HTMLTextAreaElement;
        field.placeholder = translateText(field.placeholder);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
