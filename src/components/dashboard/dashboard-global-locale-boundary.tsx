"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const translations: Record<string, string> = {
  "Åtkomst saknas": "Access denied",
  "Du har inte behörighet att visa den här sidan. Kontakta Proffera om du tror att detta är fel.": "You do not have permission to view this page. Contact Proffera if you believe this is incorrect.",
  "Spara": "Save", "Sparar...": "Saving...", "Sparar…": "Saving…", "Ta bort": "Remove", "Avbryt": "Cancel", "Stäng": "Close",
  "Redigera": "Edit", "Skapa": "Create", "Lägg till": "Add", "Tillbaka": "Back", "Nästa": "Next",
  "Föregående": "Previous", "Sök": "Search", "Filtrera": "Filter", "Rensa": "Clear", "Visa": "Show",
  "Dölj": "Hide", "Aktiv": "Active", "Inaktiv": "Inactive", "Kommande": "Coming soon", "Planerad": "Planned", "Låst": "Locked",
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

  // Doni's Trattoria owner editor
  "Restaurang": "Restaurant",
  "Doni’s Trattoria · Ägarvy": "Doni’s Trattoria · Owner view",
  "Hantera restaurangen": "Manage the restaurant",
  "Redigera → Förhandsgranska → Publicera": "Edit → Preview → Publish",
  "Osparade ändringar": "Unsaved changes",
  "Utkast sparat": "Draft saved",
  "Restaurangadministration": "Restaurant administration",
  "Meny": "Menu",
  "Kategorier": "Categories",
  "Bilder": "Photos",
  "Texter": "Content",
  "Kontakt": "Contact",
  "Adress, telefon och Instagram": "Address, phone and Instagram",
  "Öppettider": "Opening hours",
  "Länkar": "Links",
  "+ Lägg till rätt": "+ Add dish",
  "← Tillbaka till menyn": "← Back to menu",
  "Rättens namn": "Dish name",
  "Pris i kronor": "Price in SEK",
  "Rättens bild": "Dish photo",
  "Bildbeskrivning inför uppladdning": "Photo description before upload",
  "Visa rätt igen": "Show dish again",
  "Dölj tillfälligt": "Hide temporarily",
  "Arkivera rätt": "Archive dish",
  "Återställ": "Restore",
  "(dold kategori)": "(hidden category)",
  "Dold": "Hidden",
  "Pris (kr)": "Price (SEK)",
  "Inga rätter än.": "No dishes yet.",
  "Arkiverade rätter": "Archived dishes",
  "Skapa en kategori för att börja med menyn.": "Create a category to start building the menu.",
  "+ Skapa kategori": "+ Create category",
  "↑ Flytta upp": "↑ Move up",
  "↓ Flytta ner": "↓ Move down",
  "Välj befintlig bild": "Choose existing photo",
  "Ingen bild": "No photo",
  "Välj bild från telefonen": "Choose photo from phone",
  "Ta ett nytt foto": "Take a new photo",
  "Ta bort bild från sidan": "Remove photo from site",
  "Huvudbild": "Hero image",
  "Ägarbild": "Owner photo",
  "Familjebild": "Family photo",
  "Galleri": "Gallery",
  "+ Lägg till från mediabiblioteket": "+ Add from media library",
  "Interiör": "Interior",
  "Exteriör": "Exterior",
  "Stämning": "Atmosphere",
  "Mat": "Food",
  "Familj/team": "Family/team",
  "Webbplatstexter": "Website content",
  "Huvudrubrik": "Hero heading",
  "Inledning": "Introduction",
  "Om oss-rubrik": "About heading",
  "Restaurangens berättelse": "Restaurant story",
  "Presentation av ägaren": "Owner introduction",
  "Gästfrihet": "Hospitality",
  "Menyrubrik": "Menu heading",
  "Menyinledning": "Menu introduction",
  "Gallerirubrik": "Gallery heading",
  "Galleriinledning": "Gallery introduction",
  "Kontaktrubrik": "Contact heading",
  "Kontakttext": "Contact text",
  "Grundat år (om bekräftat)": "Founded year (if confirmed)",
  "Kontrollera tiderna innan du publicerar dem.": "Check the opening hours before publishing.",
  "Kontaktuppgifter": "Contact details",
  "De här uppgifterna används direkt i Demo 2 när utkastet publiceras.": "These details are used directly in Demo 2 when the draft is published.",
  "Restaurangnamn": "Restaurant name",
  "Gatuadress": "Street address",
  "Postnummer": "Postal code",
  "Instagram-namn": "Instagram handle",
  "Instagram-länk": "Instagram URL",
  "Organisationsnummer": "Organisation number",
  "Kartlänk / Hitta hit": "Map URL / Directions",
  "På webbplatsen: Kontakt / Hitta hit / Footer": "On the website: Contact / Directions / Footer",
  "Rättens namn SV": "Dish name SV",
  "Bokning och beställning": "Booking and ordering",
  "Bokningslänken ska öppna själva bokningsflödet, inte en kart-sökning. Lämna tom tills den är bekräftad.": "The booking link must open the actual booking flow, not a map search. Leave it empty until confirmed.",
  "Direkt bokningsadress": "Direct booking URL",
  "Beställningsadress": "Ordering URL",
  "Spara utkast": "Save draft",
  "Förhandsgranska →": "Preview →",
  "Ingen restaurangwebbplats är kopplad till den här arbetsytan. Kontakta Proffera för att koppla ägarens arbetsyta.": "No restaurant website is connected to this workspace. Contact Proffera to connect the owner workspace.",
  "Öppna restaurangens webbplats": "Open restaurant website",
  "Öppna restaurangens webbplats ↗": "Open restaurant website ↗",
  "Öppna webbplats ↗": "Open site ↗",
  "Språk": "Language",
  "Hantera meny, bilder, texter och öppettider från samma vy.": "Manage menu, photos, content and opening hours from one place.",

  // Doni editor notices
  "Skapa en kategori först.": "Create a category first.",
  "Utkast sparat. Förhandsgranska före publicering.": "Draft saved. Preview it before publishing.",
  "Det gick inte att spara. Försök igen.": "Could not save. Please try again.",
  "Skriv bildens alt-text innan du laddar upp.": "Enter the photo alt text before uploading.",
  "Uppladdningen misslyckades.": "Upload failed.",
  "Bilden uppladdad. Spara utkastet och publicera för att visa ändringen.": "Photo uploaded. Save the draft and publish to show the change.",
  "Alla bilder finns redan i galleriet. Ladda upp en ny bild.": "All photos are already in the gallery. Upload a new photo.",
  "Ladda upp en bild först.": "Upload a photo first.",
  "Bilden finns redan i galleriet. Välj en annan bild.": "This photo is already in the gallery. Choose another photo.",
  "Ingen behörighet.": "No permission.",
  "En bild eller version är ogiltig.": "A photo or version is invalid.",
  "En annan ändring sparades. Ladda om sidan innan du fortsätter.": "Another change was saved. Reload the page before continuing.",
  "Spara ett utkast först.": "Save a draft first.",
  "Utkastet ändrades. Ladda om sidan.": "The draft changed. Reload the page.",
  "Alla synliga rätter behöver ett pris före publicering.": "All visible dishes need a price before publishing.",
  "En bild finns inte längre i mediabiblioteket.": "A photo is no longer available in the media library.",
  "Kontrollera fälten och försök igen.": "Check the fields and try again.",
  "Menyn eller öppettiderna innehåller ogiltiga referenser.": "The menu or opening hours contain invalid references.",
  "Bokningslänken måste gå direkt till bokningsflödet, inte till en karta.": "The booking link must open the booking flow directly, not a map.",
  "Startinnehållet från demosidan är inlagt för redigering. Kontrollera priser, texter och bilder, ladda upp restaurangens egna bilder och spara utkastet.": "The demo content is loaded as an editable starting point. Check prices, text and photos, upload the restaurant’s own photos and save the draft.",
  "Referensbild från nuvarande demosida. Ladda upp en ny bild för att ersätta den.": "Reference photo from the current demo. Upload a new photo to replace it.",
  "Rätter och priser": "Dishes and prices",
  "Rubriker i menyn": "Menu headings",
  "Hero, galleri och matbilder": "Hero, gallery and food photos",
  "Hero och Om oss": "Hero and About",
  "Kontaktsektionen": "Contact section",
  "Qopla och bokning": "Qopla and booking",
  "På webbplatsen: Meny": "On the website: Menu",
  "På webbplatsen: rubriker i Meny": "On the website: Menu headings",
  "På webbplatsen: Hero, galleri och maträtter": "On the website: Hero, gallery and dishes",
  "På webbplatsen: Hero och Om oss": "On the website: Hero and About",
  "På webbplatsen: Kontakt / Öppettider": "On the website: Contact / Opening hours",
  "På webbplatsen: Boka bord / Beställ online": "On the website: Book a table / Order online",
  "Demo 2 som innehållsmall": "Demo 2 content template",
  "Demo 2-innehållet är inlagt för redigering. Kontrollera priser, texter och bilder och spara utkastet.": "Demo 2 content is loaded for editing. Review prices, text and photos, then save the draft.",
  "Den publicerade sidan ligger kvar tills du publicerar igen. Du kan ladda Demo 2-innehållet i utkastet och sedan anpassa det.": "The published site stays live until you publish again. You can load Demo 2 content into the draft and then customize it.",
  "Nuvarande utkast kan ersättas med samma innehåll som används i Demo 2.": "The current draft can be replaced with the same content used in Demo 2.",
  "Ladda Demo 2-innehåll": "Load Demo 2 content",
  "Exempel från demosidan": "Examples from the demo",
  "Startinnehållet från demosidan är inlagt för redigering. Kontrollera priser, texter och bilder och spara utkastet.": "The demo starter content is loaded for editing. Check prices, text and photos, then save the draft.",
  "Nuvarande utkast innehåller egna eller tidigare teständringar. Du kan ersätta det med samma exempel som visas på demosidan.": "The current draft contains custom or previous test changes. You can replace it with the same examples shown on the demo.",
  "Ladda demosidans exempel": "Load demo examples",
  "Demosidans exempel är inlästa. Fyll i riktiga priser, kontrollera texterna och ersätt referensbilder innan publicering.": "Demo examples loaded. Enter real prices, review the text and replace reference photos before publishing.",
  "Referensbilder från demosidan": "Reference photos from the demo",
  "De här bilderna visas som referens. Ladda upp restaurangens egna bilder nedan för att ersätta dem.": "These photos are shown as references. Upload the restaurant’s own photos below to replace them.",
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
    .replace(/ · Återställ\b/g, " · Restore")
    .replace(/^Pris (.+)$/g, "Price $1")
    .replace(/^Visa (.+)$/g, "Show $1")
    .replace(/^Dölj (.+)$/g, "Hide $1")
    .replace(/^Flytta upp (.+)$/g, "Move up $1")
    .replace(/^Flytta ner (.+)$/g, "Move down $1")
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
      root.querySelectorAll("[aria-label], [title]").forEach((element) => {
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) element.setAttribute("aria-label", translateText(ariaLabel));
        const title = element.getAttribute("title");
        if (title) element.setAttribute("title", translateText(title));
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
