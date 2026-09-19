import type { Metadata } from "next";

import { SwedishLegalPage } from "@/components/marketing/swedish-legal-page";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description: "Integritetspolicy för Proffera och hur personuppgifter hanteras i plattformen.",
};

const sections = [
  { title: "1. Personuppgiftsansvarig", text: "Den som driver Proffera ansvarar för hur personuppgifter behandlas i tjänsten. För frågor om personuppgifter eller för att utöva dina rättigheter, kontakta leads@proffera.se." },
  { title: "2. Vilka uppgifter vi kan behandla", text: "Vi kan behandla namn, e-postadress, telefonnummer, företagsnamn, organisationsnummer, stad, serviceområde, tjänstekategori, meddelanden, offertförfrågningar, bokningsinformation och teknisk information som behövs för drift och säkerhet." },
  { title: "3. Varför uppgifterna behandlas", text: "Uppgifter används för att ta emot förfrågningar, hantera bokningar och företagsregistreringar, skicka e-postnotiser, tillhandahålla kundportalen, förbättra tjänsten och skydda plattformen mot missbruk." },
  { title: "4. Rättslig grund", text: "Behandlingen kan baseras på avtal eller förberedelse inför avtal, berättigat intresse för drift och säkerhet, samtycke där det krävs samt rättslig skyldighet om sådan uppstår." },
  { title: "5. Delning med tredje part", text: "Personuppgifter kan delas med tekniska leverantörer som behövs för drift, databas, hosting och e-postleverans. Proffera säljer inte personuppgifter till tredje part." },
  { title: "6. Lagringstid", text: "Uppgifter sparas bara så länge de behövs för ändamålet, exempelvis för att hantera leads, leveranslogg, support, säkerhet och bokförings- eller avtalsrelaterade skyldigheter." },
  { title: "7. Dina rättigheter", text: "Du kan begära information om vilka personuppgifter som behandlas, begära rättelse, radering, begränsning eller invända mot viss behandling. Kontakta Proffera via leads@proffera.se." },
  { title: "8. Säkerhet", text: "Administrativa delar skyddas med åtkomstkontroll. Miljövariabler och API-nycklar ska inte exponeras publikt. Driftmiljön ska hanteras med minsta möjliga åtkomst." },
  { title: "9. Uppdateringar", text: "Denna policy kan uppdateras när Proffera utvecklas eller personuppgiftsbehandlingen förändras. Den senaste versionen publiceras på denna sida." },
] as const;

export default function PrivacyPage() {
  return <SwedishLegalPage title="Integritetspolicy" introduction="Den här policyn beskriver hur Proffera behandlar personuppgifter i samband med leads, bokningar, företagsregistreringar och kommunikation." sections={sections} englishHref="/en/privacy" notice="Kundspecifika personuppgiftsbiträdesavtal kan komplettera denna policy." />;
}
