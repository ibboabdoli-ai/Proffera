import { CheckCircle2, CreditCard } from "lucide-react";
import { notFound } from "next/navigation";

import { getPublicServiceJobPayment } from "@/lib/workspace-service-job-payments";

export const dynamic = "force-dynamic";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(amount / 100);
}

export default async function PublicPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payment = await getPublicServiceJobPayment(token);
  if (!payment) notFound();
  const paid = payment.status === "paid";
  return (
    <main className="min-h-screen bg-[#f4f6f2] px-4 py-10 text-[#17201a]">
      <section className="mx-auto max-w-xl rounded-[28px] border border-[#dde5dc] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">{payment.companyName}</p>
        <h1 className="mt-2 text-3xl font-black">Betalning</h1>
        <p className="mt-3 text-sm leading-6 text-[#5c675f]">{payment.title}</p>
        <div className="mt-6 rounded-2xl bg-[#f7f9f6] p-5"><p className="text-xs font-black uppercase tracking-wide text-[#788279]">Att betala</p><p className="mt-2 text-3xl font-black">{money(payment.amountMinor, payment.currency)}</p></div>
        {paid ? <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#e9f2ec] p-4 font-bold text-[#17452f]"><CheckCircle2 className="h-5 w-5" />Betalningen är mottagen.</div> : payment.accountReady ? <form method="post" action="/api/public/payments/checkout" className="mt-6"><input type="hidden" name="token" value={token} /><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 py-3 font-bold text-white"><CreditCard className="h-5 w-5" />Betala säkert med Stripe</button></form> : <p className="mt-6 rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b]">Betalningen är tillfälligt otillgänglig. Kontakta företaget.</p>}
        <p className="mt-6 text-xs leading-5 text-[#788279]">Betalningen hanteras av Stripe. Proffera lagrar inte dina kortuppgifter.</p>
      </section>
    </main>
  );
}
