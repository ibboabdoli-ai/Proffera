import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

export function ButtonLink({ className = "", variant = "primary", ...props }: ButtonLinkProps) {
  const baseClass =
    "inline-flex min-h-11 items-center justify-center rounded-control px-5 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2";
  const variantClass =
    variant === "primary"
      ? "bg-brand !text-white hover:bg-brand-hover hover:!text-white"
      : "border border-brand bg-surface !text-brand hover:bg-brand-tint hover:!text-brand";

  return <Link className={`${baseClass} ${variantClass} ${className}`} {...props} />;
}
