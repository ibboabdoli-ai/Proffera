"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toLocaleUpperCase("sv-SE"))
    .join("") || "P";
}

export function MarketplaceCompanyLogo({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "sm" ? "size-11 text-xs" : "size-14 text-sm";

  if (!url || failed) {
    return (
      <span
        className={`grid ${sizeClass} shrink-0 place-items-center rounded-full border border-line bg-brand-deep font-black tracking-[-0.02em] text-white shadow-sm`}
        aria-label={name}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white p-1.5 shadow-sm`}>
      {/* Company logos can live on tenant-specific Blob/CDN hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${name} logotyp`}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function MarketplaceCompanyCover({
  name,
  url,
  illustration = false,
}: {
  name: string;
  url?: string | null;
  illustration?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="relative grid h-full min-h-40 place-items-center overflow-hidden bg-brand-tint">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_25%_25%,rgba(23,69,47,.14),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(23,69,47,.09),transparent_38%)]" />
        <div className="relative grid place-items-center gap-2 text-brand-deep">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/90 shadow-sm">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <span className="max-w-44 text-center text-xs font-bold">{name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-40 overflow-hidden bg-surface-subtle">
      {/* Published profile media can live on tenant-specific Blob/CDN hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={illustration ? "" : `${name} företagsbild`}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
