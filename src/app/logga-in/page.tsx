import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Logga in",
  description: "Inloggningssida för Proffera, byggs ut i auth-fasen.",
};

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Logga in"
      title="Inloggning byggs i en senare fas."
      description="Kund-, företags- och admininloggning läggs till när auth och roller implementeras."
    />
  );
}
