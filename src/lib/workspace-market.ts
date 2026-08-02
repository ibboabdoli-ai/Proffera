export const workspaceBillingCurrencies = ["SEK", "EUR", "GBP"] as const;

export type WorkspaceBillingCurrency = (typeof workspaceBillingCurrencies)[number];

export type WorkspaceMarketCountry = {
  code: string;
  currency: WorkspaceBillingCurrency;
  defaultTimeZone: WorkspaceTimeZone;
  labelSv: string;
  labelEn: string;
};

export const workspaceTimeZones = [
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Lisbon",
  "Europe/Ljubljana",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Nicosia",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Warsaw",
  "Europe/Zagreb",
] as const;

export type WorkspaceTimeZone = (typeof workspaceTimeZones)[number];

export const DEFAULT_WORKSPACE_MARKET = {
  countryCode: "SE",
  timeZone: "Europe/Stockholm",
  billingCurrency: "SEK",
} as const;

export const workspaceMarketCountries: readonly WorkspaceMarketCountry[] = [
  { code: "SE", currency: "SEK", defaultTimeZone: "Europe/Stockholm", labelSv: "Sverige", labelEn: "Sweden" },
  { code: "AT", currency: "EUR", defaultTimeZone: "Europe/Vienna", labelSv: "Österrike", labelEn: "Austria" },
  { code: "BE", currency: "EUR", defaultTimeZone: "Europe/Brussels", labelSv: "Belgien", labelEn: "Belgium" },
  { code: "BG", currency: "EUR", defaultTimeZone: "Europe/Sofia", labelSv: "Bulgarien", labelEn: "Bulgaria" },
  { code: "HR", currency: "EUR", defaultTimeZone: "Europe/Zagreb", labelSv: "Kroatien", labelEn: "Croatia" },
  { code: "CY", currency: "EUR", defaultTimeZone: "Europe/Nicosia", labelSv: "Cypern", labelEn: "Cyprus" },
  { code: "CZ", currency: "EUR", defaultTimeZone: "Europe/Prague", labelSv: "Tjeckien", labelEn: "Czechia" },
  { code: "DK", currency: "EUR", defaultTimeZone: "Europe/Copenhagen", labelSv: "Danmark", labelEn: "Denmark" },
  { code: "EE", currency: "EUR", defaultTimeZone: "Europe/Tallinn", labelSv: "Estland", labelEn: "Estonia" },
  { code: "FI", currency: "EUR", defaultTimeZone: "Europe/Helsinki", labelSv: "Finland", labelEn: "Finland" },
  { code: "FR", currency: "EUR", defaultTimeZone: "Europe/Paris", labelSv: "Frankrike", labelEn: "France" },
  { code: "DE", currency: "EUR", defaultTimeZone: "Europe/Berlin", labelSv: "Tyskland", labelEn: "Germany" },
  { code: "GR", currency: "EUR", defaultTimeZone: "Europe/Athens", labelSv: "Grekland", labelEn: "Greece" },
  { code: "HU", currency: "EUR", defaultTimeZone: "Europe/Budapest", labelSv: "Ungern", labelEn: "Hungary" },
  { code: "IE", currency: "EUR", defaultTimeZone: "Europe/Dublin", labelSv: "Irland", labelEn: "Ireland" },
  { code: "IT", currency: "EUR", defaultTimeZone: "Europe/Rome", labelSv: "Italien", labelEn: "Italy" },
  { code: "LV", currency: "EUR", defaultTimeZone: "Europe/Riga", labelSv: "Lettland", labelEn: "Latvia" },
  { code: "LT", currency: "EUR", defaultTimeZone: "Europe/Vilnius", labelSv: "Litauen", labelEn: "Lithuania" },
  { code: "LU", currency: "EUR", defaultTimeZone: "Europe/Luxembourg", labelSv: "Luxemburg", labelEn: "Luxembourg" },
  { code: "MT", currency: "EUR", defaultTimeZone: "Europe/Malta", labelSv: "Malta", labelEn: "Malta" },
  { code: "NL", currency: "EUR", defaultTimeZone: "Europe/Amsterdam", labelSv: "Nederländerna", labelEn: "Netherlands" },
  { code: "PL", currency: "EUR", defaultTimeZone: "Europe/Warsaw", labelSv: "Polen", labelEn: "Poland" },
  { code: "PT", currency: "EUR", defaultTimeZone: "Europe/Lisbon", labelSv: "Portugal", labelEn: "Portugal" },
  { code: "RO", currency: "EUR", defaultTimeZone: "Europe/Bucharest", labelSv: "Rumänien", labelEn: "Romania" },
  { code: "SK", currency: "EUR", defaultTimeZone: "Europe/Bratislava", labelSv: "Slovakien", labelEn: "Slovakia" },
  { code: "SI", currency: "EUR", defaultTimeZone: "Europe/Ljubljana", labelSv: "Slovenien", labelEn: "Slovenia" },
  { code: "ES", currency: "EUR", defaultTimeZone: "Europe/Madrid", labelSv: "Spanien", labelEn: "Spain" },
  { code: "GB", currency: "GBP", defaultTimeZone: "Europe/London", labelSv: "Storbritannien", labelEn: "United Kingdom" },
] as const;

export function getWorkspaceMarketCountry(value: string) {
  return workspaceMarketCountries.find((country) => country.code === value) ?? null;
}

export function isWorkspaceTimeZone(value: unknown): value is WorkspaceTimeZone {
  return typeof value === "string" && workspaceTimeZones.includes(value as WorkspaceTimeZone);
}

export function isWorkspaceBillingCurrency(value: unknown): value is WorkspaceBillingCurrency {
  return typeof value === "string" && workspaceBillingCurrencies.includes(value as WorkspaceBillingCurrency);
}

export function resolveWorkspaceMarket(input: {
  countryCode?: unknown;
  timeZone?: unknown;
  billingCurrency?: unknown;
}) {
  const country = getWorkspaceMarketCountry(String(input.countryCode ?? ""));
  if (!country || !isWorkspaceTimeZone(input.timeZone) || !isWorkspaceBillingCurrency(input.billingCurrency)) {
    return null;
  }

  if (country.currency !== input.billingCurrency) {
    return null;
  }

  return {
    countryCode: country.code,
    timeZone: input.timeZone,
    billingCurrency: input.billingCurrency,
  } as const;
}

export function getWorkspaceMarketLabel(countryCode: string, locale: "sv" | "en") {
  const country = getWorkspaceMarketCountry(countryCode);
  if (!country) return countryCode;
  return locale === "en" ? country.labelEn : country.labelSv;
}
