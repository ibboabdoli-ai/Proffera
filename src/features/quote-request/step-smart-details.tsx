import { quoteFormCopy } from "./form-copy";
import type { SmartQuoteAnswers, SmartQuoteQuestion } from "./smart-quote-questions";
import type { PublicLocale } from "@/lib/public-locale";

export function QuoteSmartDetailsStep({
  locale,
  questions,
  answers,
  errors,
  onChange,
}: {
  locale: PublicLocale;
  questions: SmartQuoteQuestion[];
  answers: SmartQuoteAnswers;
  errors: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
}) {
  const t = quoteFormCopy[locale];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#17201a]">{t.detailsTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-[#5b665f]">{t.detailsLead}</p>
      </div>

      {questions.map((question) => {
        const value = answers[question.id] ?? "";
        const error = errors[question.id];

        return (
          <fieldset key={question.id} className="rounded-2xl border border-[#dfe5dd] p-4 sm:p-5">
            <legend className="px-1 text-sm font-bold text-[#17201a]">
              {question.label}{question.required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
            </legend>
            {question.help ? <p className="mt-1 text-sm text-[#5b665f]">{question.help}</p> : null}

            {question.type === "single" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(question.options ?? []).map((option) => {
                  const selected = value === option.value;
                  return (
                    <label key={option.value} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition ${selected ? "border-[#17452f] bg-[#eef5ef] text-[#17452f]" : "border-[#dfe5dd] bg-white text-[#334039] hover:border-[#9eaea3]"}`}>
                      <input
                        type="radio"
                        name={`smart-${question.id}`}
                        value={option.value}
                        checked={selected}
                        onChange={(event) => onChange(question.id, event.target.value)}
                        className="mr-2 accent-[#17452f]"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type={question.type === "number" ? "number" : "text"}
                  min={question.type === "number" ? 0 : undefined}
                  inputMode={question.type === "number" ? "decimal" : undefined}
                  value={value}
                  placeholder={question.placeholder}
                  onChange={(event) => onChange(question.id, event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[#cfd8cf] bg-white px-4 py-3 text-sm text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `smart-${question.id}-error` : undefined}
                />
                {question.suffix ? <span className="shrink-0 text-sm font-semibold text-[#5b665f]">{question.suffix}</span> : null}
              </div>
            )}

            {error ? <p id={`smart-${question.id}-error`} className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
          </fieldset>
        );
      })}
    </div>
  );
}
