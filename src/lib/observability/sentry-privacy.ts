import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const PRIVATE_PATH_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z0-9_-]{24,})$/iu;

function scrubPath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => PRIVATE_PATH_SEGMENT.test(segment) ? "[redacted]" : segment)
    .join("/");
}

function withoutQueryOrFragment(value: unknown) {
  if (typeof value !== "string" || !value) return value;

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

export function scrubSentryEvent(event: ErrorEvent) {
  event.user = undefined;

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

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb) {
  if (!breadcrumb.data || typeof breadcrumb.data.url !== "string") return breadcrumb;

  return {
    ...breadcrumb,
    data: {
      ...breadcrumb.data,
      url: withoutQueryOrFragment(breadcrumb.data.url),
    },
  };
}

export function scrubSentrySpan<T extends {
  data: Record<string, unknown>;
  description?: string;
}>(span: T): T {
  const data = { ...span.data };
  for (const key of ["http.url", "url.full", "url.path", "url.query"]) {
    delete data[key];
  }

  return {
    ...span,
    data,
    description: withoutQueryOrFragment(span.description) as string | undefined,
  } as T;
}
