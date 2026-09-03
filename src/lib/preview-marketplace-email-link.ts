const BREVO_TRACKING_SUFFIXES = [
  "brevolinks.com",
  "brevosend.com",
  "mailinblue.com",
  "mailin.fr",
  "sender-sib.com",
  "t-sender-sib.com",
  "sendib.com",
  "sendibm0.com",
  "sendibm1.com",
  "sendibm2.com",
  "sendibm3.com",
  "sendibm4.com",
  "sendibt1.com",
  "sendibt2.com",
  "sendibt3.com",
  "sendibt4.com",
  "sp1-brevo.net",
  "sp2-brevo.net",
  "sp3-brevo.net",
  "sp9-brevo.net",
  "tsp1-brevo.net",
] as const;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_TRACKING_CANDIDATES = 4;
const MAX_REDIRECT_HOPS = 2;
const TRACKING_FETCH_TIMEOUT_MS = 5_000;

export type PreviewMarketplaceEmailKind = "guest" | "customer" | "review";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const pathByKind: Record<PreviewMarketplaceEmailKind, string> = {
  guest: "/offert/svara/",
  customer: "/offert/jamfor/",
  review: "/review/marketplace/",
};

function decodeHtmlUrl(value: string) {
  return value.replace(/&(amp|#38|quot|#39);/giu, (entity) => {
    switch (entity.toLowerCase()) {
      case "&amp;":
      case "&#38;":
        return "&";
      case "&quot;":
        return '"';
      case "&#39;":
        return "'";
      default:
        return entity;
    }
  });
}

function normalizedHttpsUrl(value: string) {
  try {
    const url = new URL(decodeHtmlUrl(value));
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function previewMarketplaceEmailOrigin(requestUrl: string) {
  const url = normalizedHttpsUrl(requestUrl);
  if (!url) return null;
  const host = url.hostname.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.vercel\.app$/.test(host)) return null;
  return url.origin;
}

export function isApprovedBrevoTrackingHost(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/u, "");
  if (!host || host === "proffera.se" || host.endsWith(".vercel.app")) return false;

  // Brevo's current default click domain is r.brevolinks.com. Legacy Brevo
  // infrastructure domains are retained here because older accounts can still
  // emit tracking redirects through those owned domains.
  if (BREVO_TRACKING_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return true;
  }

  // A Brevo branded tracking subdomain for Proffera is still controlled by the
  // Proffera DNS zone. Restrict it to an r.* hostname and never treat arbitrary
  // Proffera application hosts as redirectors.
  return /^r(?:\.[a-z0-9-]+)*\.proffera\.se$/u.test(host);
}

function controlledPreviewUrl(value: string, kind: PreviewMarketplaceEmailKind, origin: string) {
  const url = normalizedHttpsUrl(value);
  if (!url || url.origin !== origin) return null;
  if (!url.pathname.startsWith(pathByKind[kind])) return null;
  return url.toString();
}

export function previewMarketplaceEmailLinkCandidates(body: string) {
  const links = body.match(/https:\/\/[^\s"'<>]+/gu) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of links) {
    const url = normalizedHttpsUrl(raw);
    if (!url) continue;
    const value = url.toString();
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
    if (unique.length >= 16) break;
  }
  return unique;
}

async function resolveTrackingCandidate(
  initialUrl: string,
  kind: PreviewMarketplaceEmailKind,
  origin: string,
  fetchImpl: FetchLike,
) {
  let current = normalizedHttpsUrl(initialUrl);
  if (!current || !isApprovedBrevoTrackingHost(current.hostname)) return null;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TRACKING_FETCH_TIMEOUT_MS),
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      return null;
    }

    if (!REDIRECT_STATUSES.has(response.status)) return null;
    const location = response.headers.get("location")?.trim() ?? "";
    if (!location) return null;

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    if (next.protocol !== "https:") return null;

    const controlled = controlledPreviewUrl(next.toString(), kind, origin);
    if (controlled) return controlled;
    if (!isApprovedBrevoTrackingHost(next.hostname)) return null;
    current = next;
  }

  return null;
}

export async function resolvePreviewMarketplaceEmailLink(input: {
  body: string;
  kind: PreviewMarketplaceEmailKind;
  origin: string;
  fetchImpl?: FetchLike;
}) {
  const candidates = previewMarketplaceEmailLinkCandidates(input.body);
  for (const candidate of candidates) {
    const direct = controlledPreviewUrl(candidate, input.kind, input.origin);
    if (direct) return direct;
  }

  const trackingCandidates = candidates
    .filter((candidate) => {
      const url = normalizedHttpsUrl(candidate);
      return Boolean(url && isApprovedBrevoTrackingHost(url.hostname));
    })
    .slice(0, MAX_TRACKING_CANDIDATES);

  const fetchImpl = input.fetchImpl ?? fetch;
  for (const candidate of trackingCandidates) {
    const resolved = await resolveTrackingCandidate(candidate, input.kind, input.origin, fetchImpl);
    if (resolved) return resolved;
  }
  return null;
}
