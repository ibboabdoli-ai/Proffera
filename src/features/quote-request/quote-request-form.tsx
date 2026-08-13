"use client";

import type { PublicLocale } from "@/lib/public-locale";
import { LocalizedQuoteRequestForm } from "./localized-quote-request-form";

export function QuoteRequestForm({ locale = "sv" }: { locale?: PublicLocale }) {
  return <LocalizedQuoteRequestForm locale={locale} />;
}
