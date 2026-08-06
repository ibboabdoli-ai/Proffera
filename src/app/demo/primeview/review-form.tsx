import { BadgeCheck, ShieldCheck } from "lucide-react";

type PrimeViewReviewFormProps = {
  serviceOptions: readonly string[];
};

export function PrimeViewReviewForm({
  serviceOptions,
}: PrimeViewReviewFormProps) {
  return (
    <div className="rounded-2xl border border-[#d9e4f7] bg-[#f6f9ff] p-5 text-sm leading-6 text-[#29436f]">
      <p className="flex items-center gap-2 font-black text-[#071b42]">
        <BadgeCheck className="size-5 text-[#0a3c8f]" aria-hidden="true" />
        Verified customers only
      </p>
      <p className="mt-3">
        After one of our {serviceOptions.length} service types is completed,
        PrimeView can send the customer a secure, single-use review link.
      </p>
      <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-[#315997]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        The link expires, cannot be reused and never asks for payment details or
        an account password.
      </p>
    </div>
  );
}
