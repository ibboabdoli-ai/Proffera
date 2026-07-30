"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const exactFragments: Record<string, string> = {
  "medlemmar": "members",
  "Pris:": "Price:",
  "Baspris:": "Base price:",
  "Längd:": "Duration:",
  "Buffert:": "Buffer:",
  "Bokningsregel:": "Booking rule:",
  "Område:": "Service area:",
  "före": "before",
  "efter": "after",
  "minst": "at least",
  "dagar framåt": "days ahead",
  "Namn": "Name",
  "Beskrivning": "Description",
  "Kategori": "Category",
  "Prisvisning": "Price display",
  "Baspris SEK": "Base price SEK",
  "Längd min": "Duration (min)",
  "Sortering": "Sort order",
  "Bokningsregler": "Booking rules",
  "Buffert före, min": "Buffer before (min)",
  "Buffert efter, min": "Buffer after (min)",
  "Minsta framförhållning, min": "Minimum notice (min)",
  "Bokningshorisont, dagar": "Booking horizon (days)",
  "Aktiv tjänst": "Active service",
  "Skapa tjänst": "Create service",
  "Spara tjänst": "Save service",
  "Inaktiv": "Inactive",
  "Gäller till": "Valid until",
  "Åtkomst saknas": "Access denied",
  "Kunder kan bara skicka bokningsförfrågningar inom dessa tider. Spara tiderna för att publicera bokning.": "Customers can only submit booking requests during these hours. Save the hours to publish online booking.",
  "Kunder kan bara skicka bokningsförfrågningar inom dessa tider. Tiderna är publicerade.": "Customers can only submit booking requests during these hours. The hours are published.",
  "Styr förberedelsetid, paus efter tjänsten och hur nära eller långt fram kunden får boka.": "Control preparation time, the break after the service, and how soon or far ahead customers can book.",
  "Inga tjänster visas ännu. Skapa första tjänsten för att göra kundflöden, offertunderlag och kommande AI-svar tydligare.": "No services are shown yet. Create the first service to improve customer flows, quote details and future AI responses.",
  "Betalningen är genomförd. Planen aktiveras så snart Stripe har bekräftat abonnemanget.": "Payment was completed. The plan will activate as soon as Stripe confirms the subscription.",
  "Betalningen avbröts. Inga ändringar gjordes i arbetsytan.": "Payment was cancelled. No workspace changes were made.",
  "Teamets åtkomst uppdaterades.": "Team access was updated.",
  "Företagsprofilen sparades.": "The company profile was saved.",
  "Tjänsten sparades.": "The service was saved.",
  "Bokningstiderna sparades och används nu på din bokningssida.": "Booking hours were saved and are now used on your booking page.",
  "Skicka igen": "Resend",
  "Återkalla": "Revoke",
};

function translateFragment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const exact = exactFragments[trimmed];
  if (exact) return value.replace(trimmed, exact);

  return value
    .replace(/\bmedlemmar\b/g, "members")
    .replace(/\bPris:/g, "Price:")
    .replace(/\bBaspris:/g, "Base price:")
    .replace(/\bLängd:/g, "Duration:")
    .replace(/\bBuffert:/g, "Buffer:")
    .replace(/\bBokningsregel:/g, "Booking rule:")
    .replace(/\bOmråde:/g, "Service area:")
    .replace(/\bminst\b/g, "at least")
    .replace(/\bföre\b/g, "before")
    .replace(/\befter\b/g, "after")
    .replace(/\bmax (\d+) dagar framåt\b/g, "up to $1 days ahead")
    .replace(/\b(\d+) aktiva tjänster\b/g, "$1 active services")
    .replace(/\bGäller till\b/g, "Valid until")
    .replace(/Kunder kan bara skicka bokningsförfrågningar inom dessa tider\./g, "Customers can only submit booking requests during these hours.")
    .replace(/Spara tiderna för att publicera bokning\./g, "Save the hours to publish online booking.")
    .replace(/Tiderna är publicerade\./g, "The hours are published.");
}

export function SettingsResidualLocaleFix({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname.startsWith("/dashboard/installningar") && searchParams.get("lang") === "en";
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !rootRef.current) return;
    const root = rootRef.current;

    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && !["SCRIPT", "STYLE", "CODE"].includes(parent.tagName)) {
          const current = node.textContent ?? "";
          const translated = translateFragment(current);
          if (translated !== current) node.textContent = translated;
        }
        node = walker.nextNode();
      }

      root.querySelectorAll<HTMLElement>("[aria-label]").forEach((element) => {
        const label = element.getAttribute("aria-label");
        if (label) element.setAttribute("aria-label", translateFragment(label).replace(/^Roll för /, "Role for "));
      });

      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]").forEach((element) => {
        element.placeholder = translateFragment(element.placeholder)
          .replace("För- och efternamn", "First and last name")
          .replace("namn@foretag.se", "name@company.com");
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [active]);

  return <div ref={rootRef}>{children}</div>;
}
