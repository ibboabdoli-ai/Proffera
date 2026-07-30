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
  "Kunder kan bara skicka bokningsförfrågningar inom dessa tider. Spara tiderna för att publicera bokning.": "Customers can only submit booking requests during these hours. Save the hours to publish online booking.",
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
    .replace(/Kunder kan bara skicka bokningsförfrågningar inom dessa tider\./g, "Customers can only submit booking requests during these hours.")
    .replace(/Spara tiderna för att publicera bokning\./g, "Save the hours to publish online booking.");
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
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [active]);

  return <div ref={rootRef}>{children}</div>;
}
