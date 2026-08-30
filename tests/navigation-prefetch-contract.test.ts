import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, prefetch, children }: { href: unknown; prefetch?: boolean; children?: ReactNode }) => ReactModule.createElement(
      "a",
      {
        "data-test-href": String(href),
        "data-prefetch": prefetch === false ? "false" : "default",
      },
      children,
    ),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/dashboard/workspace-actions", () => ({
  switchWorkspaceAction: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

import { AdminNavigation } from "../src/components/admin/admin-navigation";
import { DashboardShell } from "../src/components/dashboard/dashboard-shell";
import {
  createNavigationPrefetchPreferenceStore,
  navigationPrefetchPreferenceEnabled,
  navigationPrefetchProp,
} from "../src/components/performance/navigation-prefetch-control";

function fakeStorage(initialValue: string | null = null) {
  let value = initialValue;
  let failRead = false;
  let failWrite = false;

  return {
    storage: {
      getItem(key: string) {
        void key;
        if (failRead) throw new Error("read unavailable");
        return value;
      },
      setItem(key: string, nextValue: string) {
        void key;
        if (failWrite) throw new Error("write unavailable");
        value = nextValue;
      },
    },
    setValue(nextValue: string | null) {
      value = nextValue;
    },
    setFailRead(nextValue: boolean) {
      failRead = nextValue;
    },
    setFailWrite(nextValue: boolean) {
      failWrite = nextValue;
    },
  };
}

describe("authenticated navigation prefetch contract", () => {
  it("defaults off, supports explicit opt-in, and maps the preference to Link prefetch", () => {
    expect(navigationPrefetchPreferenceEnabled(null)).toBe(false);
    expect(navigationPrefetchPreferenceEnabled("off")).toBe(false);
    expect(navigationPrefetchPreferenceEnabled("on")).toBe(true);

    const fake = fakeStorage();
    const store = createNavigationPrefetchPreferenceStore(() => fake.storage);
    expect(store.read()).toBe(false);
    expect(navigationPrefetchProp(store.read())).toBe(false);

    store.write(true);
    expect(store.read()).toBe(true);
    expect(navigationPrefetchProp(store.read())).toBeUndefined();

    store.write(false);
    expect(store.read()).toBe(false);
    expect(navigationPrefetchProp(store.read())).toBe(false);
  });

  it("fails closed when browser storage reads or writes fail", () => {
    const fake = fakeStorage("on");
    const store = createNavigationPrefetchPreferenceStore(() => fake.storage);
    expect(store.read()).toBe(true);

    fake.setFailWrite(true);
    store.write(false);
    expect(store.read()).toBe(false);

    fake.setFailWrite(false);
    store.write(true);
    expect(store.read()).toBe(true);

    fake.setFailRead(true);
    expect(store.read()).toBe(false);
  });

  it("treats localStorage.clear as a preference change and ignores unrelated keys", () => {
    const fake = fakeStorage("on");
    const store = createNavigationPrefetchPreferenceStore(() => fake.storage);
    expect(store.read()).toBe(true);
    expect(store.handleStorageEventKey("unrelated-key")).toBe(false);

    fake.setValue(null);
    expect(store.handleStorageEventKey(null)).toBe(true);
    expect(store.read()).toBe(false);
  });

  it("renders Dashboard and Platform Admin navigation with prefetch disabled by default", () => {
    const dashboard = renderToStaticMarkup(React.createElement(DashboardShell, {
      canManageSettings: true,
      children: React.createElement("div", null, "Dashboard content"),
    }));
    const admin = renderToStaticMarkup(React.createElement(AdminNavigation, {
      role: "super_admin",
      email: "admin@example.test",
    }));

    expect(dashboard).toContain('data-test-href="/dashboard/leads" data-prefetch="false"');
    expect(dashboard).toContain('data-test-href="/dashboard/bokningar" data-prefetch="false"');
    expect(admin).toContain('data-test-href="/admin/saas" data-prefetch="false"');
    expect(admin).toContain('data-test-href="/admin/foretag" data-prefetch="false"');
    expect(admin).toContain("Auto prefetch: Av");
  });
});
