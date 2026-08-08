type DynamicAuthBaseUrl = {
  allowedHosts: string[];
  protocol: "https";
};

export type AuthOriginConfig = {
  baseURL: DynamicAuthBaseUrl;
  trustedOrigins: string[];
};

function normalizeVercelHost(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !hostname.endsWith(".vercel.app")
    ) {
      return null;
    }

    return hostname;
  } catch {
    return null;
  }
}

export function resolvePreviewAuthOriginConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthOriginConfig | null {
  if (env.VERCEL_ENV !== "preview") {
    return null;
  }

  const hosts = Array.from(
    new Set(
      [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
        .map(normalizeVercelHost)
        .filter((host): host is string => Boolean(host)),
    ),
  );

  if (hosts.length === 0) {
    throw new Error(
      "VERCEL_URL or VERCEL_BRANCH_URL is required to initialize Proffera auth in Preview.",
    );
  }

  return {
    baseURL: {
      allowedHosts: hosts,
      protocol: "https",
    },
    trustedOrigins: hosts.map((host) => `https://${host}`),
  };
}
