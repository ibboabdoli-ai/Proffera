const primeViewHosts = new Set([
  "primeviewwindowcare.co.uk",
  "www.primeviewwindowcare.co.uk",
]);

const platformHosts = new Set([
  "proffera.se",
  "www.proffera.se",
  "chat.proffera.se",
  "localhost",
  "127.0.0.1",
  "::1",
]);

const hostnameLabel = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function hostnameFromHostHeader(host: string | null | undefined) {
  const value = (host ?? "").trim().toLowerCase();
  if (!value) return "";

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    return closingBracket > 0 ? value.slice(1, closingBracket) : value;
  }

  return value.split(":", 1)[0].replace(/\.$/, "");
}

export function isPrimeViewHost(host: string | null | undefined) {
  return primeViewHosts.has(hostnameFromHostHeader(host));
}

export function isPlatformHost(host: string | null | undefined) {
  const hostname = hostnameFromHostHeader(host);
  return platformHosts.has(hostname) || hostname.endsWith(".vercel.app");
}

export function normalizeCustomDomainInput(input: string | null | undefined) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password || url.port || url.search || url.hash) return "";
    if (url.pathname && url.pathname !== "/") return "";

    const hostname = hostnameFromHostHeader(url.hostname);
    if (!hostname || hostname.length > 253 || !hostname.includes(".")) return "";
    if (isPlatformHost(hostname) || isPrimeViewHost(hostname)) return hostname;

    const labels = hostname.split(".");
    if (labels.some((label) => !hostnameLabel.test(label))) return "";
    if (labels.every((label) => /^\d+$/.test(label))) return "";
    return hostname;
  } catch {
    return "";
  }
}
