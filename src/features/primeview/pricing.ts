export type PrimeViewServiceKey = "window" | "gutter" | "fascia" | "conservatory" | "solar" | "patio" | "package";

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
const pctLine = (label: string, base: number, pct: number): PrimeViewPricingLine => ({ label, amount: roundMoney(base * pct) });

function accessMultiplier(access: PrimeViewAccess | undefined) {
  if (access === "Moderately difficult") return 0.1;
  if (access === "Difficult") return 0.2;
  return 0;
}

function conditionMultiplier(condition: PrimeViewCondition | undefined) {
  if (condition === "Dirty") return 0.15;
  if (condition === "Very dirty") return 0.25;
  return 0;
}

function multiServiceDiscount(count = 1) {
  if (count >= 3) return 0.1;
  if (count === 2) return 0.05;
  return 0;
}

function finalize(input: {
  subtotal: number;
  minimumCharge: number;
  lines: PrimeViewPricingLine[];
  multiServiceCount?: number;
  estimated?: boolean;
}) : PrimeViewPricingResult {
  let subtotal = roundMoney(input.subtotal);
  const discount = multiServiceDiscount(input.multiServiceCount);
  if (discount > 0) {
    const amount = roundMoney(subtotal * discount);
    input.lines.push({ label: input.multiServiceCount && input.multiServiceCount >= 3 ? "3+ services discount -10%" : "2 services discount -5%", amount: -amount });
    subtotal = roundMoney(subtotal - amount);
  }

  const minimumApplied = subtotal < input.minimumCharge;
  if (minimumApplied) {
    input.lines.push({ label: `Minimum charge £${input.minimumCharge}`, amount: roundMoney(input.minimumCharge - subtotal) });
  }
  const total = roundMoney(Math.max(input.minimumCharge, subtotal));

  return {
    kind: "price",
    total,
    subtotalBeforeMinimum: subtotal,
    minimumCharge: input.minimumCharge,
    minimumApplied,
    lines: input.lines,
    estimated: Boolean(input.estimated),
    note: input.estimated
      ? "Estimated price – final price confirmed after the property and job details are reviewed."
      : "Calculated from the details provided. PrimeView confirms the final job details before attendance.",
  };
}

function manual(reason: string, lines: PrimeViewPricingLine[] = []): PrimeViewPricingResult {
  return {
    kind: "manual",
    reason,
    lines,
    note: "Estimated price – final price confirmed after the property and job details are reviewed.",
  };
}

export function serviceKeyFromName(name: string): PrimeViewServiceKey | null {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("gutter") && normalized.includes("pressure")) return "package";
  if (normalized.includes("window cleaning")) return "window";
  if (normalized.includes("gutter")) return "gutter";
  if (normalized.includes("fascia") || normalized.includes("soffit")) return "fascia";
  if (normalized.includes("conservatory")) return "conservatory";
  if (normalized.includes("solar")) return "solar";
  if (normalized.includes("driveway") || normalized.includes("patio") || normalized.includes("pressure")) return "patio";
  return null;
}

function windowMinimum(propertySize: PrimeViewPricingInput["propertySize"]) {
  if (propertySize === "Terraced house") return 30;
  if (propertySize === "Semi-detached house") return 39;
  if (propertySize === "Detached house") return 45;
  return 40;
}

function calculatePackagePrice(input: PrimeViewPricingInput): PrimeViewPricingResult {
  const gutter = calculatePrimeViewPrice({ ...input, serviceKey: "gutter", multiServiceCount: 1 });
  if (gutter.kind === "manual") return manual(`Gutter part: ${gutter.reason}`);

  const pressure = calculatePrimeViewPrice({ ...input, serviceKey: "patio", multiServiceCount: 1 });
  if (pressure.kind === "manual") return manual(`Pressure washing part: ${pressure.reason}`);

  const separateTotal = roundMoney(gutter.total + pressure.total);
  const saving = Math.min(separateTotal - 1, Math.max(5, Math.round((separateTotal * 0.1) / 5) * 5));
  const total = roundMoney(separateTotal - saving);
  const lines: PrimeViewPricingLine[] = [
    { label: "Gutter Cleaning", amount: gutter.total },
    { label: "Pressure Washing", amount: pressure.total },
    { label: `Package saving – Save £${saving.toFixed(0)}`, amount: -saving },
  ];

  return {
    kind: "price",
    total,
    subtotalBeforeMinimum: total,
    minimumCharge: 0,
    minimumApplied: false,
    lines,
    estimated: gutter.estimated || pressure.estimated,
    compareAtTotal: separateTotal,
    saving,
    note: "Package price includes both Gutter Cleaning and Pressure Washing. The package is only applied when this package is selected.",
  };
}

export function calculatePrimeViewPrice(input: PrimeViewPricingInput): PrimeViewPricingResult {
  if (input.access === "Very difficult" || input.condition === "Extreme") {
    return manual(input.access === "Very difficult" ? "Very difficult access / special equipment requires a manual quote." : "Extreme property condition requires a manual quote.");
  }

  if (input.serviceKey === "package") return calculatePackagePrice(input);

  if (input.serviceKey === "window") {
    const standard = Math.max(0, Math.floor(Number(input.standardWindows) || 0));
    const large = Math.max(0, Math.floor(Number(input.largeWindows) || 0));
    const bay = Math.max(0, Math.floor(Number(input.bayWindows) || 0));
    const hard = Math.max(0, Math.floor(Number(input.hardAccessWindows) || 0));
    const count = standard + large + bay;
    if (!count || !input.cleaningScope) return manual("Enter the window quantities and cleaning type to calculate a price.");
    if (hard > count) return manual("Hard-access window count cannot be greater than the total window count.");

    const detachedNeedsQuote = input.propertySize === "Detached house" && (
      count >= 30
      || input.floorCount === "3+"
      || input.workingHeight === "Second floor+"
      || input.workingHeight === "Long ladder required"
    );
    if (input.propertySize === "Large property" || detachedNeedsQuote) {
      return manual("Large or high detached properties require a custom quote.");
    }

    const insideOnly = input.cleaningScope === "Inside only";
    const both = input.cleaningScope === "Inside & outside";
    const lines: PrimeViewPricingLine[] = [];
    const standardRate = both ? 5.5 : 3;
    const largeRate = insideOnly ? 3 : both ? 7.5 : 6;
    const bayRate = insideOnly ? 3 : both ? 9 : 8;
    if (standard) lines.push({ label: `${standard} standard window${standard === 1 ? "" : "s"} × £${standardRate}`, amount: standard * standardRate });
    if (large) lines.push({ label: `${large} large window${large === 1 ? "" : "s"} × £${largeRate}`, amount: large * largeRate });
    if (bay) lines.push({ label: `${bay} very large / bay window${bay === 1 ? "" : "s"} × £${bayRate}`, amount: bay * bayRate });
    if (hard) lines.push({ label: `${hard} hard-access window${hard === 1 ? "" : "s"} × £3`, amount: hard * 3 });

    let subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    if (input.floorCount === "3+" || input.floors === "3rd floor or higher") {
      const line = pctLine("3+ floors / 3rd floor or higher +25%", subtotal, 0.25);
      lines.push(line); subtotal += line.amount;
    }

    const accessPct = accessMultiplier(input.access);
    if (accessPct) {
      const line = pctLine(`${input.access} access +${Math.round(accessPct * 100)}%`, subtotal, accessPct);
      lines.push(line); subtotal += line.amount;
    }

    const conditionPct = Math.max(conditionMultiplier(input.condition), input.firstClean ? 0.25 : 0);
    if (conditionPct) {
      const label = input.firstClean && conditionPct === 0.25 ? "First clean / very dirty +25%" : `${input.condition} condition +${Math.round(conditionPct * 100)}%`;
      const line = pctLine(label, subtotal, conditionPct);
      lines.push(line); subtotal += line.amount;
    }

    const recurringDiscount = input.frequency === "Every 4 weeks" ? 0.15 : input.frequency === "Every 6 weeks" ? 0.1 : input.frequency === "Every 8 weeks" ? 0.05 : 0;
    if (recurringDiscount) {
      const amount = roundMoney(subtotal * recurringDiscount);
      lines.push({ label: `${input.frequency} discount -${Math.round(recurringDiscount * 100)}%`, amount: -amount });
      subtotal -= amount;
    }

    return finalize({
      subtotal,
      minimumCharge: windowMinimum(input.propertySize),
      lines,
      multiServiceCount: input.multiServiceCount,
      estimated: (large + bay > 0 && input.cleaningScope !== "Outside only")
        || input.access === "Difficult"
        || input.floorCount === "Unknown"
        || input.workingHeight === "Long ladder required"
        || (input.windowAccess !== undefined && input.windowAccess !== "Easy access"),
    });
  }

  if (input.serviceKey === "gutter") {
    const baseByProperty: Partial<Record<NonNullable<PrimeViewPricingInput["propertySize"]>, number>> = {
      "Small property": 69,
      "Terraced house": 79,
      "Semi-detached house": 99,
      "Detached house": 129,
    };
    if (input.propertySize === "Large property") return manual("Large properties require a custom gutter-cleaning quote.");
    const base = input.propertySize ? baseByProperty[input.propertySize] : undefined;
    if (!base) return manual("Choose the property type to calculate gutter cleaning.");
    const lines: PrimeViewPricingLine[] = [{ label: `Gutter cleaning – ${input.propertySize}`, amount: base }];
    let subtotal = base;

    const difficultSpecific = input.floorCount === "3+" || input.floors === "3rd floor or higher" || input.access === "Difficult";
    if (difficultSpecific) {
      const line = pctLine("3rd floor / difficult access +25%", subtotal, 0.25); lines.push(line); subtotal += line.amount;
    } else if (input.access === "Moderately difficult") {
      const line = pctLine("Moderately difficult access +10%", subtotal, 0.1); lines.push(line); subtotal += line.amount;
    }
    if (input.heavyBlockage) {
      const line = pctLine("Heavy blockage +20%", subtotal, 0.2); lines.push(line); subtotal += line.amount;
    }
    const conditionPct = conditionMultiplier(input.condition);
    if (conditionPct) {
      const line = pctLine(`${input.condition} condition +${Math.round(conditionPct * 100)}%`, subtotal, conditionPct); lines.push(line); subtotal += line.amount;
    }
    return finalize({ subtotal, minimumCharge: 69, lines, multiServiceCount: input.multiServiceCount, estimated: difficultSpecific || Boolean(input.heavyBlockage) });
  }

  if (input.serviceKey === "fascia") {
    const baseByProperty: Partial<Record<NonNullable<PrimeViewPricingInput["propertySize"]>, number>> = {
      "Small property": 80,
      "Terraced house": 100,
      "Semi-detached house": 120,
      "Detached house": 150,
    };
    const base = input.propertySize ? baseByProperty[input.propertySize] : undefined;
    if (!base) return manual(input.propertySize === "Large property" ? "Large fascia & soffit properties require a manual quote." : "Choose the property size to calculate fascia & soffit cleaning.");
    const lines: PrimeViewPricingLine[] = [{ label: `Fascia & soffit – ${input.propertySize}`, amount: base }];
    let subtotal = base;
    const accessPct = accessMultiplier(input.access);
    if (accessPct) { const line = pctLine(`${input.access} access +${Math.round(accessPct * 100)}%`, subtotal, accessPct); lines.push(line); subtotal += line.amount; }
    const conditionPct = input.condition === "Very dirty" ? 0.2 : input.condition === "Dirty" ? 0.15 : 0;
    if (conditionPct) { const line = pctLine(`${input.condition} +${Math.round(conditionPct * 100)}%`, subtotal, conditionPct); lines.push(line); subtotal += line.amount; }
    return finalize({ subtotal, minimumCharge: 80, lines, multiServiceCount: input.multiServiceCount, estimated: input.condition === "Very dirty" || input.access === "Difficult" });
  }

  if (input.serviceKey === "conservatory") {
    const baseBySize = { Small: 90, Medium: 120, Large: 160 } as const;
    const base = input.conservatorySize ? baseBySize[input.conservatorySize] : undefined;
    if (!base) return manual("Choose the conservatory size to calculate a price.");
    const lines: PrimeViewPricingLine[] = [{ label: `${input.conservatorySize} conservatory roof`, amount: base }];
    let subtotal = base;
    const accessPct = accessMultiplier(input.access);
    if (accessPct) { const line = pctLine(`${input.access} access +${Math.round(accessPct * 100)}%`, subtotal, accessPct); lines.push(line); subtotal += line.amount; }
    const conditionPct = input.condition === "Very dirty" ? 0.2 : input.condition === "Dirty" ? 0.15 : 0;
    if (conditionPct) { const line = pctLine(`${input.condition} / algae +${Math.round(conditionPct * 100)}%`, subtotal, conditionPct); lines.push(line); subtotal += line.amount; }
    return finalize({ subtotal, minimumCharge: 90, lines, multiServiceCount: input.multiServiceCount, estimated: input.condition === "Very dirty" || input.access === "Difficult" });
  }

  if (input.serviceKey === "solar") {
    const panels = Math.max(0, Math.floor(Number(input.solarPanels) || 0));
    if (!panels) return manual("Enter the number of solar panels to calculate a price.");
    if (panels > 30) return manual("30+ solar panels require a custom quote.");
    const base = panels <= 8 ? 60 : panels <= 16 ? panels * 6 : panels * 5;
    const rateLabel = panels <= 8 ? "1–8 panels minimum" : panels <= 16 ? `${panels} panels × £6` : `${panels} panels × £5`;
    const lines: PrimeViewPricingLine[] = [{ label: rateLabel, amount: base }];
    let subtotal = base;
    const accessPct = input.access === "Difficult" ? 0.2 : input.access === "Moderately difficult" ? 0.1 : 0;
    if (accessPct) { const line = pctLine(`Roof access +${Math.round(accessPct * 100)}%`, subtotal, accessPct); lines.push(line); subtotal += line.amount; }
    const conditionPct = conditionMultiplier(input.condition);
    if (conditionPct) { const line = pctLine(`${input.condition} condition +${Math.round(conditionPct * 100)}%`, subtotal, conditionPct); lines.push(line); subtotal += line.amount; }
    return finalize({ subtotal, minimumCharge: 60, lines, multiServiceCount: input.multiServiceCount, estimated: input.access === "Difficult" || input.condition === "Very dirty" });
  }

  const area = Math.max(0, Number(input.areaM2) || 0);
  if (!area) return manual("Enter the pressure-washing area in m² to calculate a price.");
  if (input.sealing) return manual("Sealing is priced manually after inspection.");
  const baseRate = input.heavyDirtMoss ? 11 : 9;
  const lines: PrimeViewPricingLine[] = [{ label: `${area} m² × £${baseRate}${input.heavyDirtMoss ? " heavy dirt / moss" : " standard pressure washing"}`, amount: area * baseRate }];
  if (input.oilTreatment) lines.push({ label: `Oil / stain treatment ${area} m² × £3`, amount: area * 3 });
  if (input.weedTreatment) lines.push({ label: `Weed treatment ${area} m² × £2`, amount: area * 2 });
  if (input.resanding) lines.push({ label: `Re-sanding ${area} m² × £4`, amount: area * 4 });
  let subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const accessPct = accessMultiplier(input.access);
  if (accessPct) { const line = pctLine(`${input.access} access +${Math.round(accessPct * 100)}%`, subtotal, accessPct); lines.push(line); subtotal += line.amount; }
  return finalize({ subtotal, minimumCharge: 180, lines, multiServiceCount: input.multiServiceCount, estimated: Boolean(input.heavyDirtMoss || input.oilTreatment || input.access === "Difficult") });
}

export function pricingResultSummary(result: PrimeViewPricingResult) {
  if (result.kind === "manual") return `Manual quote required: ${result.reason}`;
  const breakdown = result.lines.map((line) => `${line.label}: ${line.amount >= 0 ? "+" : ""}£${line.amount.toFixed(2)}`).join(" | ");
  const saving = result.saving ? ` | Package saving: £${result.saving.toFixed(2)}` : "";
  return `Calculated estimate: £${result.total.toFixed(2)} | Minimum charge: £${result.minimumCharge.toFixed(2)}${saving} | ${breakdown} | ${result.note}`;
}
