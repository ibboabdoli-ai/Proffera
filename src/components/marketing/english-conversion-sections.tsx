import { CheckCircle2, Quote, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

const trustItems = [
  "Built for service businesses in Sweden",
  "A secure customer portal, developed step by step",
  "Demo-ready lead and email workflow",
  "Email delivery powered by Brevo",
] as const;

const testimonials = [
  {
    quote: "Proffera brings together what would otherwise end up in email, forms and manual lists.",
    name: "Pilot customer in local services",
  },
  {
    quote: "The clearest value is one shared workflow for leads, follow-ups and customer dialogue.",
    name: "Small-business owner in the Stockholm area",
  },
] as const;

const faqs = [
  {
    question: "Is Proffera a quote marketplace or a SaaS platform?",
    answer: "Proffera is a SaaS platform for bookings, leads, customer records and follow-up. AI support is a separate, planned module.",
  },
  {
    question: "Which businesses is Proffera for?",
    answer: "Small service businesses in cleaning, maintenance, moving, repairs and other local services where leads and bookings need better follow-up.",
  },
  {
    question: "Is everything already available?",
    answer: "The booking flow, customer management, leads and email notifications can be shown in the demo. Access is enabled after an agreed installation and plan.",
  },
  {
    question: "Can Proffera be adapted for different industries?",
    answer: "Yes. Services, booking flows, notifications and the company profile can be adapted to the needs of each business.",
  },
] as const;

export function EnglishConversionSections() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Why Proffera</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Turn more enquiries into real customer conversations.</h2>
            <p className="mt-4 text-sm leading-7 text-[#5b665f]">
              Small businesses often lose opportunities because leads land in the wrong channel, lack structure or are not followed up in time. Proffera creates a clearer path from first contact to booking.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#17452f]" aria-hidden="true" />
                <span className="text-sm font-medium text-[#17201a]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-3xl bg-[#f7f7f4] p-6 ring-1 ring-[#dfe5dd] lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Example workflow</p>
              <h2 className="mt-2 text-2xl font-bold text-[#17201a]">From manual lead handling to one structured flow.</h2>
              <p className="mt-3 text-sm leading-7 text-[#5b665f]">
                A local service business can use Proffera to receive enquiries, keep customer information together, send email and follow each status in the customer portal.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#344139]">
                {["Enquiry received", "Booking", "Email notification", "Follow-up"].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#17452f]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <div className="grid gap-6 lg:col-span-2 md:grid-cols-2">
              {testimonials.map((item) => (
                <article key={item.name} className="rounded-3xl border border-[#dfe5dd] p-6">
                  <Quote className="h-7 w-7 text-[#17452f]" aria-hidden="true" />
                  <p className="mt-4 text-sm leading-7 text-[#344139]">“{item.quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-[#17201a]">{item.name}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">FAQ</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Questions before a demo.</h2>
            <p className="mt-4 text-sm leading-7 text-[#5b665f]">
              Proffera is developed step by step. Demos and pilot customers help validate the right capabilities before a wider launch.
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((item) => (
              <article key={item.question} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
                <h3 className="font-semibold text-[#17201a]">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd] md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Next step</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Start with a demo, not a long project.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5b665f]">
              We review your business flow, the leads you want to capture and the automation that will have the greatest impact first.
            </p>
          </div>
          <div className="mt-6 flex gap-3 md:mt-0">
            <ButtonLink href="/en/demo">Book a demo</ButtonLink>
            <ButtonLink href="/en/contact" variant="secondary">Contact us</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
