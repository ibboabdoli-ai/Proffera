export type VercelCustomDomainState =
  | "unconfigured"
  | "missing"
  | "verification"
  | "dns"
  | "connected"
  | "conflict"
  | "error";

export type VercelVerificationRecord = {
  type: string;
  domain: string;
  value: string;
};

export type VercelCustomDomainStatus = {
  state: VercelCustomDomainState;
  automationConfigured: boolean;
  projectAttached: boolean;
  verified: boolean;
  misconfigured: boolean | null;
  verificationRecords: VercelVerificationRecord[];
  recommendedCNAME: string[];
  recommendedIPv4: string[];
};

function boundedText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].slice(0, 10);
}

export function extractVercelRecommendedValues(value: unknown) {
  if (!Array.isArray(value)) return [];

  const values = value.flatMap((entry) => {
    if (typeof entry === "string") return [boundedText(entry, 255)];
    if (!entry || typeof entry !== "object") return [];

    const record = entry as Record<string, unknown>;
    for (const key of ["value", "recommendedValue", "hostname", "target"]) {
      const candidate = boundedText(record[key], 255);
      if (candidate) return [candidate];
    }
    return [];
  });

  return unique(values);
}

export function extractVercelVerificationRecords(value: unknown): VercelVerificationRecord[] {
  if (!Array.isArray(value)) return [];

  const records = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const type = boundedText(record.type, 32).toUpperCase();
    const domain = boundedText(record.domain ?? record.name, 255);
    const verificationValue = boundedText(record.value, 500);
    if (!type || !verificationValue) return [];
    return [{ type, domain, value: verificationValue }];
  });

  return records.slice(0, 10);
}

export function deriveVercelCustomDomainState(input: {
  projectAttached: boolean;
  verified: boolean;
  misconfigured: boolean | null;
}): VercelCustomDomainState {
  if (!input.projectAttached) return "missing";
  if (!input.verified) return "verification";
  if (input.misconfigured !== false) return "dns";
  return "connected";
}

export function createUnconfiguredVercelCustomDomainStatus(): VercelCustomDomainStatus {
  return {
    state: "unconfigured",
    automationConfigured: false,
    projectAttached: false,
    verified: false,
    misconfigured: null,
    verificationRecords: [],
    recommendedCNAME: [],
    recommendedIPv4: [],
  };
}
