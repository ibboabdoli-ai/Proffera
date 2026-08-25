const productionBookingHosts = new Set(["proffera.se", "www.proffera.se"]);

export function resolveBookingUrlForLocation(url: string, isPreview: boolean, origin: string) {
  if (!isPreview) return url;

  try {
    const target = new URL(url);
    const isProductionBookingUrl = productionBookingHosts.has(target.hostname) && target.pathname.startsWith("/boka/");
    if (!isProductionBookingUrl) return url;

    return new URL(`${target.pathname}${target.search}${target.hash}`, origin).toString();
  } catch {
    return url;
  }
}
