import type { ReactNode } from "react";

export default function PrimeViewBookingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="border-t border-[#d9e4ef] bg-[#eef3f9] px-5 py-4 text-center text-xs text-[#667b91]">
        Your personal information is handled in accordance with the{" "}
        <a href="/privacy" className="font-bold text-[#0a3c8f] underline underline-offset-3">
          PrimeView Privacy Policy
        </a>.
      </div>
    </>
  );
}
