const primeViewHosts = new Set([
  "primeviewwindowcare.co.uk",
  "www.primeviewwindowcare.co.uk",
]);

export function hostnameFromHostHeader(host: string | null | undefined) {
  return (host ?? "").trim().toLowerCase().split(":", 1)[0];
}

export function isPrimeViewHost(host: string | null | undefined) {
  return primeViewHosts.has(hostnameFromHostHeader(host));
}
