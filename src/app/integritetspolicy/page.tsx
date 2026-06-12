import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description: "Preliminär integritetssida för Proffera.",
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Juridiskt"
      title="Integritetspolicy"
      description="Den här sidan är en preliminär placeholder. Fullständig integritetspolicy ska tas fram innan lansering och innan personuppgifter behandlas i produktion."
    />
  );
}
