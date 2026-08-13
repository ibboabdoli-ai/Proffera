import type { PublicLocale } from "@/lib/public-locale";
import type { QuoteRequestErrors, QuoteRequestField, QuoteRequestInput } from "./schema";

export type QuoteFormStepProps = {
  locale: PublicLocale;
  data: QuoteRequestInput;
  errors: QuoteRequestErrors;
  update: <Field extends QuoteRequestField>(field: Field, value: QuoteRequestInput[Field]) => void;
};

export function FieldError({ value }: { value?: string }) {
  return value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;
}
