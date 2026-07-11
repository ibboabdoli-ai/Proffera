import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

export function ButtonLink({ className = "", variant = "primary", ...props }: ButtonLinkProps) {
  const baseClass =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClass =
    variant === "primary"
      ? "bg-[#17452f] !text-white hover:bg-[#0e2e1e] hover:!text-white focus:ring-[#17452f]"
      : "border border-[#17452f] bg-white !text-[#17452f] hover:bg-[#eef5ef] hover:!text-[#17452f] focus:ring-[#17452f]";

  return <Link className={`${baseClass} ${variantClass} ${className}`} {...props} />;
}
