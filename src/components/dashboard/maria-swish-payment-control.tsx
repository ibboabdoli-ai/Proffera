import { mariaBookingNumber } from "@/lib/maria-deposit";
import { MariaBookingReferenceCopy } from "@/components/dashboard/maria-booking-reference-copy";
import type { ManualSwishEntry } from "@/lib/maria-manual-swish";
import { recordMariaSwishPaymentAction } from "@/app/dashboard/maria/payment-actions";

type Props = {
  bookingId: string;
  bookingStatus: string;
  readOk: boolean;
  entry?: ManualSwishEntry;
  returnTo: "list" | "detail";
  isEnglish: boolean;
};

/** Maria Preview only. Parent pages must check the Maria workspace before rendering. */
export function MariaSwishPaymentControl({ bookingId, bookingStatus, readOk, entry, returnTo, isEnglish }: Props) {
  const paid = entry?.state === "paid";
  // A failed status read cannot prove which payment reference was persisted.
  const reference = readOk ? mariaBookingNumber(bookingId, entry?.reference) : null;
  const canMarkPaid = bookingStatus === "confirmed" || bookingStatus === "completed";
  return (
    <section className="min-w-0 rounded-xl border border-[#e9d6df] bg-[#fff9f8] p-3 sm:p-4">
      {reference ? (
        <>
          <p className="text-sm font-semibold text-[#704858]">{isEnglish ? "Booking number · Swish" : "Bokningsnummer · Swish"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all break-all font-mono text-sm font-semibold text-[#49313c]">
              {reference}
            </code>
            <MariaBookingReferenceCopy key={bookingId} reference={reference} isEnglish={isEnglish} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#76545f]">
            {isEnglish
              ? "Compare this booking number with the Swish payment message."
              : "Jämför bokningsnumret med Meddelande i Swish."}
          </p>
        </>
      ) : null}
      {!readOk ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#a33b2f]">
          {isEnglish ? "Cannot read payment status. Try again later." : "Betalningsstatus kunde inte läsas. Försök igen."}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm font-bold text-[#704858]">
            {isEnglish ? "Deposit: " : "Handpenning: "}
            <span className={paid ? "text-[#176a48]" : "text-[#90672a]"}>
              {paid
                ? isEnglish ? "Paid · manually verified" : "Betald · manuellt kontrollerad"
                : isEnglish ? "Not marked as paid" : "Ej markerad som betald"}
            </span>
          </p>
          {paid || canMarkPaid ? (
            <form action={recordMariaSwishPaymentAction.bind(null, bookingId)} className="mt-3 flex flex-col items-start gap-2">
              <input type="hidden" name="payment_state" value={paid ? "unverified" : "paid"} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
              {!paid ? (
                <label className="flex items-start gap-2 text-xs leading-5 text-[#684956]">
                  <input className="mt-1 h-4 w-4 accent-[#845363]" type="checkbox" name="swish_checked" required />
                  {isEnglish ? "I have checked the Swish payment myself." : "Jag har kontrollerat betalningen i Swish."}
                </label>
              ) : null}
              <button type="submit" className="min-h-10 rounded-lg border border-[#845363] bg-white px-4 py-2 text-xs font-bold text-[#704858] hover:bg-[#fcf0f4]">
                {paid
                  ? isEnglish ? "Undo payment mark" : "Ångra betalningsmarkering"
                  : isEnglish ? "Mark as paid" : "Markera som betald"}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-[#76545f]">
              {isEnglish ? "Confirm the booking before recording the deposit." : "Bekräfta bokningen innan du markerar handpenningen som betald."}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-[#76545f]">
            {isEnglish
              ? "Manual record only. No automatic Swish payment verification or email."
              : "Endast manuell registrering. Ingen automatisk Swish-kontroll eller e-post skickas."}
          </p>
        </>
      )}
    </section>
  );
}
