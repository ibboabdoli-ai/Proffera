export function normalizeSwedishCompanyIdentityName(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/(^|[^\p{L}\p{N}])aktiebolag(?:et)?(?=$|[^\p{L}\p{N}])/gu, "$1 ab ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function swedishCompanyNamesEquivalent(left: unknown, right: unknown) {
  const normalizedLeft = normalizeSwedishCompanyIdentityName(left);
  const normalizedRight = normalizeSwedishCompanyIdentityName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
