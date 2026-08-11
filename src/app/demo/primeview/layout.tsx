import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

import { PrimeViewGalleryNavigation } from "./gallery-navigation";

export default function PrimeViewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <a
        href="/booking"
        className="fixed bottom-5 right-5 z-[60] inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0a3c8f] px-5 py-3 text-sm font-black !text-white shadow-[0_14px_35px_rgba(2,13,38,.32)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[#061b42] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8ceff] motion-reduce:transform-none motion-reduce:transition-none sm:bottom-7 sm:right-7"
        aria-label="Book PrimeView Window Care online"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        Book Online
      </a>
      <PrimeViewGalleryNavigation />
    </>
  );
}
