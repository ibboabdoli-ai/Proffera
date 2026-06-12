import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";

export const metadata: Metadata = {
  title: "Få offert",
  description: "Beskriv ditt uppdrag i Profferas flerstegsformulär.",
};

export default function QuotePage() {
  return (
    <PageShell
      eyebrow="Få offert"
      title="Beskriv ditt uppdrag steg för steg."
      description="Fyll i tjänst, plats, beskrivning och kontaktuppgifter. Formuläret validerar uppgifterna både i flödet och på serversidan."
    >
      <QuoteRequestForm />
    </PageShell>
  );
}
