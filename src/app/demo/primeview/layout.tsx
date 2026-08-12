import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

import { PrimeViewGalleryNavigation } from "./gallery-navigation";

export default function PrimeViewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="border-t border-white/10 bg-[#020b1d] px-5 py-4 text-center text-xs text-slate-400">
        <a href="/privacy" className="font-bold text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white">
          Privacy Policy
        </a>
        <span className="mx-2" aria-hidden="true">·</span>
        <span>UK customer privacy information</span>
      </div>
      <a
        href="/booking"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[60] inline-flex size-14 items-center justify-center rounded-full bg-[#0a3c8f] text-sm font-black !text-white shadow-[0_14px_35px_rgba(2,13,38,.32)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[#061b42] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8ceff] motion-reduce:transform-none motion-reduce:transition-none sm:bottom-7 sm:right-7 sm:size-auto sm:min-h-12 sm:gap-2 sm:px-5 sm:py-3"
        aria-label="Book PrimeView Window Care online"
      >
        <CalendarDays className="size-5 sm:size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Book Online</span>
      </a>
      <PrimeViewGalleryNavigation />
    </>
  );
}
