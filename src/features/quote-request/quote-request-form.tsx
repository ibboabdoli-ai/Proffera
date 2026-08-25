"use client";

import type { PublicLocale } from "@/lib/public-locale";
import { LocalizedQuoteRequestForm } from "./localized-quote-request-form";
import type { QuoteRequestPrefill } from "./schema";

export type QuoteTargetCompanyInput = {
  slug: string;
  companyName: string;
};

export function QuoteRequestForm({
  locale = "sv",
  initialValues,
  targetCompany,
  alternateLocaleHref,
  alternateLocaleLabel,
}: {
  locale?: PublicLocale;
  initialValues?: QuoteRequestPrefill;
  targetCompany?: QuoteTargetCompanyInput;
  alternateLocaleHref?: string;
  alternateLocaleLabel?: string;
}) {
  return <LocalizedQuoteRequestForm
    locale={locale}
    initialValues={initialValues}
    targetCompany={targetCompany}
    alternateLocaleHref={alternateLocaleHref}
    alternateLocaleLabel={alternateLocaleLabel}
  />;
}
