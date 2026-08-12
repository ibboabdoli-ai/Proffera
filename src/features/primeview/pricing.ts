export type PrimeViewServiceKey = "window" | "gutter" | "fascia_gutter" | "fascia" | "conservatory" | "solar" | "patio" | "package";

export type PrimeViewAccess = "Normal" | "Moderately difficult" | "Difficult" | "Very difficult";
export type PrimeViewCondition = "Normal" | "Dirty" | "Very dirty" | "Extreme";

export type PrimeViewPricingInput = {
  serviceKey: PrimeViewServiceKey;
  access?: PrimeViewAccess;
  condition?: PrimeViewCondition;
  multiServiceCount?: number;
  floors?: "Ground floor only" | "Ground + 1st floor" | "Ground + 2 floors" | "3rd floor or higher";
  floorCount?: "1" | "2" | "3+" | "Unknown";
  workingHeight?: "Ground floor only" | "First floor" | "Second floor+" | "Long ladder required";
  windowAccess?: "Easy access" | "Hard access" | "Skylight / Roof windows";
  cleaningScope?: "Outside only" | "Inside only" | "Inside & outside";
  standardWindows?: number;
  largeWindows?: number;
  bayWindows?: number;
  hardAccessWindows?: number;
  frequency?: "One-off" | "Every 4 weeks" | "Every 6 weeks" | "Every 8 weeks";
  firstClean?: boolean;
  propertySize?: "Small property" | "Terraced house" | "Semi-detached house" | "Detached house" | "Large property";
  heavyBlockage?: boolean;
  conservatorySize?: "Small" | "Medium" | "Large";
  solarPanels?: number;
  areaM2?: number;
  heavyDirtMoss?: boolean;
  oilTreatment?: boolean;
  weedTreatment?: boolean;
  resanding?: boolean;
  sealing?: boolean;
};

export type PrimeViewPricingLine = {
  label: string;
  amount: number;
};

export type PrimeViewPricingResult =
  | {
      kind: "price";
      total: number;
      subtotalBeforeMinimum: number;
      minimumCharge: number;
      minimumApplied: boolean;
      lines: PrimeViewPricingLine[];
      estimated: boolean;
      note: string;
      compareAtTotal?: number;
      saving?: number;
    }
  | {
      kind: "manual";
      reason: string;
      lines: PrimeViewPricingLine[];
      note: string;
    };

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function priced(subtotal: number, minimumCharge: number, lines: PrimeViewPricingLine[], note: string): PrimeViewPricingResult {
  const subtotalBeforeMinimum = roundMoney(subtotal);
  const minimumApplied = subtotalBeforeMinimum < minimumCharge;
  const resultLines = [...lines];
  if (minimumApplied) {
    resultLines.push({
      label: `Minimum charge £${minimumCharge.toFixed(2)}`,
      amount: roundMoney(minimumCharge - subtotalBeforeMinimum),
    });
  }
  return {
    kind: "price",
    total: roundMoney(Math.max(minimumCharge, subtotalBeforeMinimum)),
    subtotalBeforeMinimum,
    minimumCharge,
    minimumApplied,
    lines: resultLines,
    estimated: true,
    note,
  };
}

function manual(reason: string): PrimeViewPricingResult {
  return {
    kind: "manual",
    reason,
    lines: [],
    note: "Request a quote and PrimeView will confirm the price after reviewing the property details.",
  };
}

export function serviceKeyFromName(name: string): PrimeViewServiceKey | null {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("gutter") && normalized.includes("pressure")) return "package";
  if (normalized.includes("fascia") && normalized.includes("gutter")) return "fascia_gutter";
  if (normalized.includes("window cleaning")) return "window";
  if (normalized.includes("gutter")) return "gutter";
  if (normalized.includes("fascia") || normalized.includes("soffit")) return "fascia_gutter";
  if (normalized.includes("conservatory")) return "conservatory";
  if (normalized.includes("solar")) return "solar";
  if (normalized.includes("driveway") || normalized.includes("patio") || normalized.includes("pressure")) return "patio";
  return null;
}

export function calculatePrimeViewPrice(input: PrimeViewPricingInput): PrimeViewPricingResult {
  if (input.serviceKey === "package") {
    return manual("This previous package is no longer offered. Choose Gutter Cleaning, Fascia & Gutter Cleaning or Pressure Washing.");
  }

  if (input.serviceKey === "window") {
    const windows = Math.max(0, Math.floor(Number(input.standardWindows) || 0));
    if (!windows) return manual("Enter the number of normal-size windows.");
    const subtotal = windows * 3;
    return priced(
      subtotal,
      29.99,
      [{ label: `${windows} normal-size window${windows === 1 ? "" : "s"} × £3 outside only`, amount: subtotal }],
      "Normal-size outside-only window cleaning. No automatic access, height, dirt or first-clean surcharges are added.",
    );
  }

  if (input.serviceKey === "gutter") {
    if (input.propertySize === "Terraced house") {
      return priced(59.99, 59.99, [{ label: "Gutter Cleaning – Terraced", amount: 59.99 }], "Starting price. No automatic access, blockage, height or condition surcharges are added.");
    }
    if (input.propertySize === "Semi-detached house" || input.propertySize === "Detached house") {
      const property = input.propertySize === "Semi-detached house" ? "Semi-detached" : "Detached";
      return priced(69.99, 69.99, [{ label: `Gutter Cleaning – ${property}`, amount: 69.99 }], "Starting price. No automatic access, blockage, height or condition surcharges are added.");
    }
    return manual("For this property type, please request a Gutter Cleaning quote.");
  }

  if (input.serviceKey === "fascia_gutter" || input.serviceKey === "fascia") {
    if (input.propertySize === "Terraced house") {
      return priced(89.99, 89.99, [{ label: "Fascia & Gutter Cleaning – Terraced", amount: 89.99 }], "Starting price. No automatic access, height or condition surcharges are added.");
    }
    if (input.propertySize === "Semi-detached house" || input.propertySize === "Detached house") {
      const property = input.propertySize === "Semi-detached house" ? "Semi-detached" : "Detached";
      return priced(139.99, 139.99, [{ label: `Fascia & Gutter Cleaning – ${property}`, amount: 139.99 }], "Starting price. No automatic access, height or condition surcharges are added.");
    }
    return manual("For this property type, please request a Fascia & Gutter Cleaning quote.");
  }

  if (input.serviceKey === "conservatory") {
    return priced(89.99, 89.99, [{ label: "Conservatory Cleaning – starting price", amount: 89.99 }], "Starting price. Size, access and condition do not add automatic calculator surcharges.");
  }

  if (input.serviceKey === "solar") {
    const panels = Math.max(0, Math.floor(Number(input.solarPanels) || 0));
    if (!panels) return manual("Enter the number of solar panels.");
    if (panels > 30) return manual("30+ solar panels require a quote.");
    const subtotal = panels <= 8 ? 59.99 : panels <= 16 ? panels * 6 : panels * 5;
    const label = panels <= 8 ? "Solar Panel Cleaning – minimum" : panels <= 16 ? `${panels} panels × £6` : `${panels} panels × £5`;
    return priced(subtotal, 59.99, [{ label, amount: subtotal }], "£59.99 minimum. No automatic roof-access or condition surcharges are added.");
  }

  const area = Math.max(0, Number(input.areaM2) || 0);
  if (!area) return manual("Enter the pressure-washing area in m².");
  const subtotal = area * 9;
  return priced(
    subtotal,
    179.99,
    [{ label: `${area} m² × £9 pressure washing`, amount: subtotal }],
    "£179.99 minimum. Dirt, oil, weed, re-sanding, sealing and access surcharges are not added by the calculator.",
  );
}

export function pricingResultSummary(result: PrimeViewPricingResult) {
  if (result.kind === "manual") return `Quote required: ${result.reason}`;
  const breakdown = result.lines.map((line) => `${line.label}: ${line.amount >= 0 ? "+" : ""}£${line.amount.toFixed(2)}`).join(" | ");
  return `Starting estimate: £${result.total.toFixed(2)} | Minimum charge: £${result.minimumCharge.toFixed(2)} | ${breakdown} | ${result.note}`;
}
