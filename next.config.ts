import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

import { SECURITY_RESPONSE_HEADERS } from "./src/lib/security-response-headers";

const sentryEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_RESPONSE_HEADERS.map(({ key, value }) => ({ key, value })),
      },
    ];
  },
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: sentryEnvironment,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
