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
        className={`grid ${sizeClass} shrink-0 place-items-center rounded-xl border-4 border-white bg-[#0a2e63] font-black tracking-[-0.02em] text-white shadow-sm`}
        aria-label={name}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-white bg-white p-1 shadow-sm`}>
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
      <div className="relative grid h-full min-h-40 place-items-center overflow-hidden bg-[#eef4fb]">
        <div className="absolute -right-8 -top-8 size-32 rounded-full border border-[#cddbea] bg-white/55" aria-hidden="true" />
        <div className="absolute -bottom-10 -left-10 size-36 rounded-full border border-[#cddbea] bg-white/45" aria-hidden="true" />
        <div className="relative grid place-items-center gap-2 text-[#0a2e63]">
          <span className="grid size-12 place-items-center rounded-xl bg-white shadow-sm">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <span className="max-w-44 text-center text-xs font-bold">{name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-40 overflow-hidden bg-[#f6f9fd]">
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
