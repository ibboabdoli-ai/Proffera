"use client";

import { useEffect, useRef } from "react";

const exactTranslations: Record<string, string> = {
  "Plan och betalning": "Plan and billing",
  "Starta abonnemanget via Stripes säkra betalningssida.": "Start your subscription through Stripe's secure checkout.",
  "Väntar på betalning": "Waiting for payment",
  "Testperiod aktiv": "Trial active",
  "Aktiv": "Active",
  "Betalning saknas": "Payment overdue",
  "Avslutad": "Cancelled",
  "Pausad": "Paused",
  "Ingen aktiv plan": "No active plan",
  "Hantera abonnemang": "Manage subscription",
  "Öppna Stripes säkra portal för att byta betalkort, se fakturor eller avsluta abonnemanget vid periodens slut.": "Open Stripe's secure portal to change payment method, view invoices or cancel at the end of the billing period.",
  "Hantera betalning och abonnemang": "Manage billing and subscription",
  "Öppnar Stripe…": "Opening Stripe…",
  "Välj plan": "Choose a plan",
  "Inte tillgänglig ännu.": "Not available yet.",
  "Förbereds": "Coming soon",
  "Uppgradera till Professional": "Upgrade to Professional",
  "Nuvarande plan": "Current plan",
  "Ny plan": "New plan",
  "Fortsätt till bekräftelse": "Continue to confirmation",
  "Bekräfta uppgraderingen": "Confirm upgrade",
  "Team och behörigheter": "Team and permissions",
  "Hantera vilka som har åtkomst till arbetsytan.": "Manage who can access the workspace.",
  "Namn (för inbjudan)": "Name (for invitation)",
  "Befintlig användares e-post": "Existing user's email",
  "Roll": "Role",
  "Lägg till": "Add",
  "Endast arbetsytans Owner kan ändra medlemmar.": "Only the workspace Owner can manage members.",
  "Väntande inbjudningar": "Pending invitations",
  "Länkarna kan användas en gång och gäller i 48 timmar.": "Invitation links can be used once and remain valid for 48 hours.",
  "Skicka igen": "Resend",
  "Återkalla": "Revoke",
  "Spara": "Save",
  "Ta bort": "Remove",
  "Kontosäkerhet": "Account security",
  "Byt lösenord": "Change password",
  "Använd minst 8 tecken. När lösenordet ändras loggas andra enheter ut.": "Use at least 8 characters. Other signed-in devices are logged out after the password is changed.",
  "Nuvarande lösenord": "Current password",
  "Nytt lösenord": "New password",
  "Bekräfta nytt lösenord": "Confirm new password",
  "Sparar...": "Saving...",
  "Tjänster": "Services",
  "Bokningslänk": "Booking link",
  "Kopiera länk": "Copy link",
  "Kopierad": "Copied",
};

function translateText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const exact = exactTranslations[trimmed];
  if (exact) return text.replace(trimmed, exact);
  return text
    .replace(/(\d+) medlemmar/g, "$1 members")
    .replace(/Gäller till /g, "Valid until ")
    .replace(/Nuvarande period gäller till /g, "Current period ends ")
    .replace(/Välj (Starter|Professional)/g, "Choose $1");
}

export function SettingsLocaleBoundary({ isEnglish, children }: { isEnglish: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnglish || !ref.current) return;
    const root = ref.current;
    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && !["SCRIPT", "STYLE", "CODE"].includes(parent.tagName)) node.textContent = translateText(node.textContent ?? "");
        node = walker.nextNode();
      }
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
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isEnglish]);

  return <div ref={ref}>{children}</div>;
}
