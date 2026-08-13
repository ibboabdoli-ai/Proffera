import { ExternalLink } from "lucide-react";

const GEOTORGET_PRODUCT_URL = "https://geotorget.lantmateriet.se/geodataprodukter/belagenhetsadress-direkt-api";

const PURPOSE_TEXT = `Proffera använder Belägenhetsadress Direkt för att geokoda verifierade företagsadresser i en svensk företagskatalog. Koordinaterna används för lokal sökning, avståndsberäkning och funktionen ”Nära mig”. Den första piloten omfattar endast ett begränsat antal aktiebolag och endast företagsadresser som redan finns i vår officiellt verifierade företagsprofil. Osäkra eller tvetydiga adresser lagras inte som koordinater och personuppgifter används inte för profilering eller direktmarknadsföring genom denna geokodningsfunktion.`;

export function GeotorgetAccessHelp() {
  return (
    <div className="mt-5 rounded-2xl border border-[#dce4df] bg-[#f8faf8] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Nästa externa steg</p>
          <h3 className="mt-1 text-base font-black text-[#17201a]">Beställ Belägenhetsadress Direkt i Geotorget</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657068]">
            Produkten är avgiftsfri men kräver konto, systemkonto och juridisk prövning. När behörigheten är klar läggs systemkontots uppgifter som server-side secrets och pilotknappen kan aktiveras.
          </p>
        </div>
        <a
          href={GEOTORGET_PRODUCT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#173e2b] bg-white px-4 text-sm font-black text-[#173e2b]"
        >
          Öppna Geotorget <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <ol className="mt-5 grid gap-2 text-sm text-[#4f5e54] sm:grid-cols-3">
        <li className="rounded-xl bg-white p-4 ring-1 ring-black/5"><strong className="block text-[#17201a]">1. Organisationskonto</strong>Skapa/logga in med organisationens konto.</li>
        <li className="rounded-xl bg-white p-4 ring-1 ring-black/5"><strong className="block text-[#17201a]">2. Systemkonto</strong>Skapa ett systemkonto för Proffera PROD.</li>
        <li className="rounded-xl bg-white p-4 ring-1 ring-black/5"><strong className="block text-[#17201a]">3. Behörighet</strong>Beställ Belägenhetsadress Direkt för systemkontot.</li>
      </ol>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Förslag på ändamålsbeskrivning</p>
        <div className="mt-2 rounded-xl bg-white p-4 text-sm leading-6 text-[#435047] ring-1 ring-black/5">
          {PURPOSE_TEXT}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-[#728078]">
        Efter godkännande behövs endast systemkontots användarnamn och lösenord. Lägg aldrig dessa i Git eller i klientkod.
      </p>
    </div>
  );
}
