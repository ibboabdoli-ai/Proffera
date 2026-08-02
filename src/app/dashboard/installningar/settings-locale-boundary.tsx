"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const exactTranslations: Record<string, string> = {
  "Inställningar": "Settings",
  "Styr företagsprofil och tjänsteutbud": "Manage company profile and services",
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
  "Stripe Sandbox:": "Stripe Sandbox:",
  "Stripe använder testpriser i den här miljön. Inga riktiga pengar dras.": "Stripe uses test prices in this environment. No real money is charged.",
  "Testpris i Stripe Sandbox": "Test price in Stripe Sandbox",
  "Bokning, kontaktformulär och grundläggande leadlista.": "Booking, contact form and basic lead list.",
  "Allt i Starter samt CRM och en samlad kundöversikt.": "Everything in Starter, plus CRM and a unified customer overview.",

  "Team och behörigheter": "Team and permissions",
  "Hantera vilka som har åtkomst till arbetsytan.": "Manage who can access the workspace.",
  "Namn (för inbjudan)": "Name (for invitation)",
  "Befintlig användares e-post": "Existing user's email",
  "Roll": "Role",
  "Lägg till": "Add",
  "Finns kontot redan läggs användaren till direkt. Annars skickas en säker inbjudan som gäller i 48 timmar. Owner-rollen är skyddad.": "If the account already exists, the user is added immediately. Otherwise, a secure invitation valid for 48 hours is sent. The Owner role is protected.",
  "Endast arbetsytans Owner kan ändra medlemmar.": "Only the workspace Owner can manage members.",
  "Väntande inbjudningar": "Pending invitations",
  "Länkarna kan användas en gång och gäller i 48 timmar.": "Invitation links can be used once and remain valid for 48 hours.",
  "Skicka igen": "Resend",
  "Återkalla": "Revoke",
  "Du": "You",

  "Kontosäkerhet": "Account security",
  "Byt lösenord": "Change password",
  "Använd minst 8 tecken. När lösenordet ändras loggas andra enheter ut.": "Use at least 8 characters. Other signed-in devices are logged out after the password is changed.",
  "Nuvarande lösenord": "Current password",
  "Nytt lösenord": "New password",
  "Bekräfta nytt lösenord": "Confirm new password",
  "Sparar...": "Saving...",

  "Företagsprofil": "Company profile",
  "Namn, kontaktuppgifter, ort och standard CTA": "Name, contact details, city and default CTA",
  "Tjänstekatalog": "Service catalogue",
  "Notiser": "Notifications",
  "E-post, interna aviseringar och påminnelser": "Email, internal notifications and reminders",
  "AI-svar": "AI responses",
  "Ton, följdfrågor, svarsmallar och företagskunskap": "Tone, follow-up questions, response templates and company knowledge",
  "Kommande": "Coming soon",
  "Redo att fyllas i": "Ready to configure",

  "Proffera-moduler": "Proffera modules",
  "Här ser du vilka moduler som är aktiva för din arbetsyta. Betalning och ändring av plan hanteras av Proffera.": "View which modules are active for your workspace. Billing and plan changes are managed by Proffera.",
  "Onlinebokning": "Online booking",
  "Kund-CRM": "Customer CRM",
  "AI-chattassistent": "AI chat assistant",
  "Automatiska mejl": "Automated emails",
  "QR-bokning": "QR booking",
  "Låst": "Locked",
  "Planerad": "Planned",
  "Bokningsflöde för serviceföretag.": "Booking flow for service businesses.",
  "Kunder, bokningar och historik.": "Customers, bookings and history.",
  "AI-stöd för kunddialog och leadhantering.": "AI support for customer conversations and lead management.",
  "Bekräftelser, påminnelser och uppföljning.": "Confirmations, reminders and follow-up.",
  "Snabb bokning via QR-koder.": "Fast booking through QR codes.",
  "Inte aktiverad för den här arbetsytan.": "Not enabled for this workspace.",

  "Profil som används i kundflöden": "Profile used in customer flows",
  "Dessa värden visas i kontaktflöden, påverkar CTA-copy och är grunden för kommande AI-kunddialoger.": "These values appear in customer flows, influence CTA copy and form the basis for future AI customer conversations.",
  "Kundnära data": "Customer-facing data",
  "Företag": "Company",
  "Svarstid": "Response time",
  "Redigera företagsprofil": "Edit company profile",
  "Uppdatera de uppgifter som kunder och interna flöden ska se först.": "Update the information customers and internal workflows should see first.",
  "Företagsnamn": "Company name",
  "Primär ort": "Primary city",
  "Svarstid mål": "Response-time target",
  "Standard CTA": "Default CTA",
  "Marknad": "Market",
  "Kontakt e-post": "Contact email",
  "Kontakt telefon": "Contact phone",
  "Länk för onlinebokning": "Online-booking link",
  "Din länk blir proffera.se/boka/ditt-namn": "Your link will be proffera.se/boka/your-name",
  "Endast företagsprofilen uppdateras. Kunddata, leads och bokningar påverkas inte.": "Only the company profile is updated. Customer data, leads and bookings are not affected.",
  "Spara ändringar": "Save changes",

  "Bokningstider": "Booking hours",
  "Kunder kan bara skicka bokningsförfrågningar inom dessa tider. Spara tiderna för att publicera bokning.": "Customers can only submit booking requests during these hours. Save the hours to publish online booking.",
  "Kunder kan bara skicka bokningsförfrågningar inom dessa tider. Tiderna är publicerade.": "Customers can only submit booking requests during these hours. The hours are published.",
  "Öppnar": "Opens",
  "Stänger": "Closes",
  "Stängt": "Closed",
  "Publicerad": "Published",
  "Ej publicerad": "Not published",
  "Måndag": "Monday",
  "Tisdag": "Tuesday",
  "Onsdag": "Wednesday",
  "Torsdag": "Thursday",
  "Fredag": "Friday",
  "Lördag": "Saturday",
  "Söndag": "Sunday",
  "Endast öppettiderna för onlinebokning uppdateras. Befintliga kunder och bokningar ändras inte.": "Only online-booking hours are updated. Existing customers and bookings are not changed.",
  "Spara bokningstider": "Save booking hours",

  "Säker ändring:": "Safe change:",
  "Tjänster": "Services",
  "Hantera tjänstekatalog": "Manage service catalogue",
  "Lägg till, justera och sortera de tjänster som kunder kan fråga om, boka eller få offert på.": "Add, edit and sort the services customers can enquire about, book or request a quote for.",
  "Skapa ny tjänst": "Create new service",
  "Redigera tjänst": "Edit service",
  "Pris": "Price",
  "Baspris": "Base price",
  "Längd": "Duration",
  "Buffert": "Buffer",
  "Bokningsregel": "Booking rule",
  "Område": "Service area",
  "före": "before",
  "efter": "after",
  "minst": "at least",
  "max": "up to",
  "dagar framåt": "days ahead",
  "aktiva tjänster": "active services",
  "Bokningslänk": "Booking link",
  "Kopiera länk": "Copy link",
  "Kopierad": "Copied",
  "Spara": "Save",
  "Ta bort": "Remove",
  "Ej angivet": "Not provided"
};

function translateText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const exact = exactTranslations[trimmed];
  if (exact) return text.replace(trimmed, exact);

  return text
    .replace(/(\d+) medlemmar/g, "$1 members")
    .replace(/ · Du/g, " · You")
    .replace(/(\d+) aktiva av (\d+) tjänster/g, "$1 active of $2 services")
    .replace(/(\d+) aktiva tjänster/g, "$1 active services")
    .replace(/Gäller till /g, "Valid until ")
    .replace(/Nuvarande period gäller till /g, "Current period ends ")
    .replace(/Välj (Starter|Professional)/g, "Choose $1")
    .replace(/Pris: /g, "Price: ")
    .replace(/Baspris: /g, "Base price: ")
    .replace(/Längd: /g, "Duration: ")
    .replace(/Buffert: (\d+) min före \/ (\d+) min efter/g, "Buffer: $1 min before / $2 min after")
    .replace(/Bokningsregel: minst (\d+) min före, max (\d+) dagar framåt/g, "Booking rule: at least $1 min in advance, up to $2 days ahead")
    .replace(/Område: /g, "Service area: ")
    .replace(/Samla uppgifter som påverkar kundflöden, CTA-knappar, tjänster och kommande AI-svar\. Aktiv profil:/g, "Manage information that affects customer flows, CTA buttons, services and future AI responses. Active profile:")
    .replace(/Namn, kontaktuppgifter, ort och standard CTA/g, "Name, contact details, city and default CTA")
    .replace(/E-post, interna aviseringar och påminnelser/g, "Email, internal notifications and reminders")
    .replace(/Ton, följdfrågor, svarsmallar och företagskunskap/g, "Tone, follow-up questions, response templates and company knowledge");
}

export function SettingsLocaleBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname.startsWith("/dashboard/installningar") && searchParams.get("lang") === "en";
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
          node.textContent = translateText(node.textContent ?? "");
        }
        node = walker.nextNode();
      }

      root.querySelectorAll("input[placeholder]").forEach((element) => {
        const input = element as HTMLInputElement;
        if (input.placeholder === "Ej angivet") input.placeholder = "Not provided";
        if (input.placeholder === "För- och efternamn") input.placeholder = "First and last name";
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
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
