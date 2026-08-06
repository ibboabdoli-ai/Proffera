import { BadgeCheck, ShieldCheck } from "lucide-react";

type PrimeViewReviewFormProps = {
  serviceOptions: readonly string[];
};

export function PrimeViewReviewForm({ serviceOptions }: PrimeViewReviewFormProps) {
  void serviceOptions;

  return (
    <section className="rounded-2xl border border-[#cbd9ef] bg-[#f6f9ff] p-6 text-[#29436f]">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#0a3c8f]">
        <BadgeCheck className="size-5" aria-hidden="true" />
        Verified customers only
      </div>
      <h3 className="mt-4 text-2xl font-black tracking-tight text-[#071b42]">
        Reviews are connected to completed services
      </h3>
      <p className="mt-3 text-sm leading-7">
        After a service is completed, PrimeView can send the customer a secure
        single-use review invitation. Anonymous website submissions are no longer
        accepted.
      </p>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-white p-4 text-sm font-semibold text-[#243a63]">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        The invitation expires automatically and cannot be used twice.
      </p>
    </section>
  );
}
