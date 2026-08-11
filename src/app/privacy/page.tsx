import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { primeViewSite } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | PrimeView Window Care",
  description: "How PrimeView Window Care collects, uses and protects customer personal information.",
  alternates: { canonical: `${primeViewSite.origin}/privacy` },
  robots: { index: true, follow: true },
};

const sectionClass = "rounded-3xl border border-[#d9e4ef] bg-white p-6 shadow-[0_12px_36px_rgba(11,42,74,.06)] sm:p-8";

export default async function PrimeViewPrivacyPage() {
  const requestHeaders = await headers();
  if (!isPrimeViewHost(requestHeaders.get("host"))) notFound();

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#0b2a4a]">
      <header className="bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3 font-black text-white">
            <Image
              src="/brand/primeview-window-care-logo.jpeg"
              alt="PrimeView Window Care"
              width={56}
              height={56}
              className="h-12 w-12 rounded-xl object-cover"
            />
            <span>PrimeView Window Care</span>
          </Link>
          <Link href="/booking" className="rounded-xl bg-[#1769c2] px-4 py-3 text-sm font-black text-white hover:bg-[#2f80ed]">
            Book online
          </Link>
        </div>
      </header>

      <section className="bg-[#06183b] px-5 pb-16 pt-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-[.16em] text-[#b8ceff]">Privacy</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200">
            This notice explains how PrimeView Window Care uses personal information when you visit our website, request a quote, make or manage a booking, contact us or receive a service.
          </p>
          <p className="mt-3 text-sm text-slate-300">Last updated: 11 August 2026</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-5 px-5 py-10 sm:py-14">
        <section className={sectionClass}>
          <h2 className="text-2xl font-black">1. Who is responsible for your information?</h2>
          <p className="mt-4 leading-7 text-slate-600">
            PrimeView Window Care is the data controller for customer information collected through this website and in connection with our cleaning services.
          </p>
          <div className="mt-4 grid gap-1 text-sm font-semibold text-[#183e63]">
            <p>Email: <a className="underline" href={`mailto:${primeViewSite.email}`}>{primeViewSite.email}</a></p>
            <p>Phone: <a className="underline" href={`tel:${primeViewSite.telephone}`}>{primeViewSite.telephoneDisplay}</a></p>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">2. Information we collect</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-600">
            <li>Your name, email address and telephone number.</li>
            <li>Your service address and postcode.</li>
            <li>Booking details, preferred appointment times and the services you request.</li>
            <li>Property and access information you provide so we can price and plan the work safely.</li>
            <li>Messages, enquiries, reviews and other information you choose to send us.</li>
            <li>Limited technical and security information needed to operate and protect the website and booking service.</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">3. Why we use your information and our lawful bases</h2>
          <div className="mt-4 grid gap-4 leading-7 text-slate-600">
            <p><strong className="text-[#0b2a4a]">To provide quotes, bookings and services:</strong> processing is necessary to take steps at your request before a contract and to perform our contract with you.</p>
            <p><strong className="text-[#0b2a4a]">To communicate about your booking:</strong> we use your contact details to send verification codes, booking updates, reminders and service-related messages.</p>
            <p><strong className="text-[#0b2a4a]">To run and protect our business:</strong> we may process limited information where necessary for our legitimate interests in preventing misuse, keeping records, improving operations and resolving customer issues, provided those interests do not override your rights.</p>
            <p><strong className="text-[#0b2a4a]">To meet legal obligations:</strong> we may keep or disclose information where required by law, tax, accounting or regulatory requirements.</p>
            <p><strong className="text-[#0b2a4a]">Marketing:</strong> if we ever send optional electronic marketing that requires consent, we will ask for it and you can withdraw it at any time. Service messages are not marketing.</p>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">4. Who we share information with</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We only share personal information where needed to operate the service. This may include Proffera, which provides our booking and customer-management technology, and trusted providers used for website hosting, database services, email or SMS delivery and other essential business systems. These providers may only use the information for the services they provide to us and must protect it appropriately.
          </p>
          <p className="mt-3 leading-7 text-slate-600">
            We may also share information if required by law, to protect legal rights, or in connection with professional advisers or a business transfer.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">5. International transfers</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Some technology providers may process information outside the UK. Where UK data protection law requires safeguards for an international transfer, we use providers and transfer arrangements designed to provide the required level of protection.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">6. How long we keep information</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We keep personal information only for as long as reasonably necessary for the purpose it was collected, including providing the service, handling queries or disputes, maintaining appropriate business records and meeting legal, tax and accounting obligations. When information is no longer needed, it is deleted or anonymised where appropriate.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">7. Your data protection rights</h2>
          <p className="mt-4 leading-7 text-slate-600">Depending on the circumstances, UK data protection law gives you rights including:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-600">
            <li>access to the personal information we hold about you;</li>
            <li>correction of inaccurate or incomplete information;</li>
            <li>erasure of your information in certain circumstances;</li>
            <li>restriction of processing in certain circumstances;</li>
            <li>data portability where the right applies;</li>
            <li>objection to processing based on legitimate interests and to direct marketing; and</li>
            <li>withdrawal of consent at any time where we rely on consent.</li>
          </ul>
          <p className="mt-4 leading-7 text-slate-600">To exercise a right, contact us using the email or phone number above. We may need to verify your identity before completing a request.</p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">8. Cookies and similar technology</h2>
          <p className="mt-4 leading-7 text-slate-600">
            The website may use essential technical storage required for security, booking functionality and reliable operation. If we introduce non-essential analytics or advertising cookies that require consent, we will ask for consent before using them.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">9. Security</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We use appropriate technical and organisational measures intended to protect personal information against unauthorised access, loss, misuse or disclosure. No internet service can guarantee absolute security, so please contact us if you believe your information may have been compromised.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">10. Complaints</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Please contact PrimeView first if you have a concern about how we use your personal information. You also have the right to complain to the UK Information Commissioner's Office (ICO).
          </p>
          <a className="mt-4 inline-flex font-black text-[#0a3c8f] underline underline-offset-4" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">
            Information Commissioner's Office complaint guidance
          </a>
        </section>

        <section className={sectionClass}>
          <h2 className="text-2xl font-black">11. Changes to this policy</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We may update this notice when our services, suppliers or legal obligations change. The latest version will always be published on this page with its updated date.
          </p>
        </section>
      </div>

      <footer className="bg-[#030f28] px-5 py-8 text-sm text-slate-300">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <p>© 2026 PrimeView Window Care</p>
          <div className="flex gap-5 font-bold">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/booking" className="hover:text-white">Book online</Link>
            <Link href="/privacy" className="text-white">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
