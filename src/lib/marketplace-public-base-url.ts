const PRODUCTION_ORIGIN = "https://www.proffera.se";

function trustedOrigin(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
    if (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveMarketplacePublicBaseUrl() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    const previewOrigin = trustedOrigin(`https://${process.env.VERCEL_URL}`);
    if (previewOrigin) return previewOrigin;
  }

  return trustedOrigin(process.env.NEXT_PUBLIC_APP_URL)
    ?? trustedOrigin(process.env.APP_URL)
    ?? PRODUCTION_ORIGIN;
}
