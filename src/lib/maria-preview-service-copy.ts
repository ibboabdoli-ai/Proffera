/**
 * Customer-facing labels for Maria's known bridal packages.
 * Stored service names and customer/owner email payloads are never changed.
 * Other tenants and unrecognized service names must remain untouched.
 */
export function localizeMariaPreviewServiceName(
  name: string,
  language: "sv" | "en" | "ar",
  isMariaPreview: boolean,
): string {
  if (!isMariaPreview || language === "sv") return name;
  const match = /^Brudsmink (med prov|utan prov) (202[6-9]|203[0-6])$/.exec(name);
  if (!match) return name;
  const withTrial = match[1] === "med prov";
  const year = Number(match[2]);
  if (language === "en") {
    return `Bridal makeup ${withTrial ? "with trial" : "without trial"} ${year}`;
  }
  const arabicYear = new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(year);
  return `مكياج العروس ${withTrial ? "مع تجربة" : "بدون تجربة"} ${arabicYear}`;
}
