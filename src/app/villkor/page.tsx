import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Villkor",
  description: "Preliminära användarvillkor för Proffera.",
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Juridiskt"
      title="Villkor"
      description="Den här sidan är en placeholder för kommande villkor för kunder och företag. Villkoren måste granskas innan publik lansering."
    />
  );
}
