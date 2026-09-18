"use client";

import {
  Building2,
  Hammer,
  House,
  PaintRoller,
  Scissors,
  Snowflake,
  Sparkles,
  Sprout,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

function serviceIcon(serviceSlug?: string | null): LucideIcon {
  switch ((serviceSlug ?? "").toLowerCase()) {
    case "frisor":
      return Scissors;
    case "vvs":
    case "avloppsrensning":
    case "vattenlacka":
      return Wrench;
    case "elinstallation":
    case "felsokning-el":
    case "laddbox":
    case "elcentral":
      return Zap;
    case "lokalvard":
    case "hemstadning":
    case "kontorsstadning":
    case "flyttstadning":
    case "fonsterputsning":
      return Sparkles;
    case "flytthjalp":
      return Truck;
    case "malning":
      return PaintRoller;
    case "snickeri":
      return Hammer;
    case "tradgardshjalp":
      return Sprout;
    case "varmepump":
      return Snowflake;
    case "hemservice":
      return House;
    default:
      return Building2;
  }
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
  serviceSlug,
}: {
  name: string;
  url?: string | null;
  illustration?: boolean;
  serviceSlug?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = serviceIcon(serviceSlug);
  const showIllustration = illustration || !url || failed;

  if (showIllustration) {
    return (
      <div
        className="relative grid h-full min-h-40 place-items-center overflow-hidden bg-[#eef5ff]"
        role="img"
        aria-label={`Illustration för ${name}`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[#d7e4f3]" aria-hidden="true" />
        <div className="absolute -right-10 -top-12 size-36 rounded-full border border-[#c8d9ec] bg-white/55" aria-hidden="true" />
        <div className="absolute -bottom-14 -left-8 size-40 rounded-full border border-[#c8d9ec] bg-white/45" aria-hidden="true" />
        <div className="absolute left-[18%] top-[24%] h-px w-[64%] rotate-[-8deg] bg-[#c9d9eb]" aria-hidden="true" />
        <div className="relative grid size-20 place-items-center rounded-2xl border border-[#c9d9eb] bg-white text-[#1469d8] shadow-[0_12px_30px_rgba(10,46,99,.08)]">
          <Icon className="size-9" strokeWidth={1.8} aria-hidden="true" />
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
        alt={`${name} företagsbild`}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
