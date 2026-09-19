import * as Sentry from "@sentry/nextjs";

import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubSentrySpan,
  scrubSentryTransaction,
} from "@/lib/observability/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  tracesSampleRate: dsn ? 0.02 : 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryTransaction,
  beforeBreadcrumb: scrubSentryBreadcrumb,
  beforeSendSpan: scrubSentrySpan,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
