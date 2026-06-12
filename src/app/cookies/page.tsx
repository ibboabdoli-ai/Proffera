import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Preliminär cookieinformation för Proffera.",
};

export default function CookiesPage() {
  return (
    <PageShell
      eyebrow="Juridiskt"
      title="Cookies"
      description="Den här sidan är en placeholder för kommande cookieinformation. Cookiehantering och samtycke byggs först när analytics eller andra verktyg införs."
    />
  );
}
