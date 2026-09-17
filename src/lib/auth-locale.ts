export type AuthLocale = "sv" | "en";
export type AuthSearchParamValue = string | string[] | undefined;
export type AuthSearchParams = Record<string, AuthSearchParamValue>;

export function firstAuthSearchParam(value: AuthSearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveAuthLocale(searchParams?: AuthSearchParams): AuthLocale {
  return firstAuthSearchParam(searchParams?.lang) === "en" ? "en" : "sv";
}

export function toAuthSearchParams(searchParams?: AuthSearchParams, omit: readonly string[] = []) {
  const omitted = new Set(omit);
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams ?? {})) {
    if (omitted.has(key) || rawValue === undefined) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) params.append(key, value);
  }

  return params;
}

export function authLocaleHref(pathname: string, searchParams: AuthSearchParams | undefined, locale: AuthLocale) {
  const params = toAuthSearchParams(searchParams);
  params.set("lang", locale);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function authRedirectQuery(searchParams?: AuthSearchParams, omit: readonly string[] = []) {
  return toAuthSearchParams(searchParams, omit).toString();
}

export function authRedirectHref(
  pathname: string,
  rawQuery: string,
  locale: AuthLocale,
  overrides: Record<string, string | null | undefined> = {},
) {
  const params = new URLSearchParams(rawQuery.slice(0, 4096));
  params.set("lang", locale);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
