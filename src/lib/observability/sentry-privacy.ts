import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

type TransactionEvent = Omit<ErrorEvent, "type"> & { type: "transaction" };

const PRIVATE_PATH_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z0-9._~-]{24,})$/iu;
const HTTP_TRANSACTION_NAME = /^(CONNECT|DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT|TRACE)\s+(.+)$/u;

function scrubPath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => PRIVATE_PATH_SEGMENT.test(segment) ? "[redacted]" : segment)
    .join("/");
}

function withoutQueryOrFragment(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;

  const transactionName = value.match(HTTP_TRANSACTION_NAME);
  if (transactionName) {
    return `${transactionName[1]} ${withoutQueryOrFragment(transactionName[2])}`;
  }

  try {
    const url = new URL(value, "https://proffera.invalid");
    const pathname = scrubPath(url.pathname);
    return url.origin === "https://proffera.invalid"
      ? pathname
      : `${url.origin}${pathname}`;
  } catch {
    return scrubPath(value.split(/[?#]/u, 1)[0]);
  }
}

function scrubSentryEnvelope<T extends ErrorEvent | TransactionEvent>(event: T): T {
  event.user = undefined;
  event.message = undefined;
  event.logentry = undefined;
  event.extra = undefined;
  event.transaction = withoutQueryOrFragment(event.transaction) as string | undefined;

  if (event.request) {
    event.request = {
      ...event.request,
      url: withoutQueryOrFragment(event.request.url) as string | undefined,
      cookies: undefined,
      data: undefined,
      headers: undefined,
      query_string: undefined,
    };
  }

  event.breadcrumbs = event.breadcrumbs?.map(scrubSentryBreadcrumb);

  return event;
}

export function scrubSentryEvent(event: ErrorEvent) {
  scrubSentryEnvelope(event);

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.type ?? "Application error",
      stacktrace: exception.stacktrace ? {
        ...exception.stacktrace,
        frames: exception.stacktrace.frames?.map((frame) => ({
          ...frame,
          vars: undefined,
        })),
      } : undefined,
    }));
  }

  return event;
}

export function scrubSentryTransaction(event: TransactionEvent) {
  scrubSentryEnvelope(event);
  event.spans = event.spans?.map(scrubSentrySpan);

  if (event.contexts?.trace?.data) {
    event.contexts.trace.data = scrubSentrySpan({
      data: event.contexts.trace.data,
    }).data;
  }

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb) {
  const safeData: Record<string, unknown> = {};
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"] as const) {
      if (typeof breadcrumb.data[key] === "string") {
        safeData[key] = withoutQueryOrFragment(breadcrumb.data[key]);
      }
    }
    for (const key of ["method", "status_code"] as const) {
      if (typeof breadcrumb.data[key] === "string" || typeof breadcrumb.data[key] === "number") {
        safeData[key] = breadcrumb.data[key];
      }
    }
  }

  return {
    ...breadcrumb,
    message: undefined,
    data: Object.keys(safeData).length > 0 ? safeData : undefined,
  };
}

export function scrubSentrySpan<T extends {
  data: Record<string, unknown>;
  description?: string;
}>(span: T): T {
  const data: Record<string, unknown> = {};
  for (const key of ["http.method", "http.request.method", "http.status_code", "http.response.status_code"]) {
    if (typeof span.data[key] === "string" || typeof span.data[key] === "number") {
      data[key] = span.data[key];
    }
  }

  return {
    ...span,
    data,
    description: withoutQueryOrFragment(span.description) as string | undefined,
  } as T;
}
