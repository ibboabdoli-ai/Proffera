"use client";

import Link from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";

export const NAVIGATION_PREFETCH_STORAGE_KEY = "proffera.navigation-prefetch.enabled";
const NAVIGATION_PREFETCH_CHANGE_EVENT = "proffera:navigation-prefetch-change";

type NavigationPrefetchStorage = Pick<Storage, "getItem" | "setItem">;

export function navigationPrefetchPreferenceEnabled(value: string | null) {
  return value === "on";
}

export function navigationPrefetchProp(enabled: boolean) {
  return enabled ? undefined : false;
}

export function createNavigationPrefetchPreferenceStore(getStorage: () => NavigationPrefetchStorage) {
  let forceDisabled = false;

  return {
    read() {
      if (forceDisabled) return false;
      try {
        return navigationPrefetchPreferenceEnabled(getStorage().getItem(NAVIGATION_PREFETCH_STORAGE_KEY));
      } catch {
        return false;
      }
    },
    write(enabled: boolean) {
      try {
        getStorage().setItem(NAVIGATION_PREFETCH_STORAGE_KEY, enabled ? "on" : "off");
        forceDisabled = false;
      } catch {
        forceDisabled = true;
      }
    },
    handleStorageEventKey(key: string | null) {
      if (key !== NAVIGATION_PREFETCH_STORAGE_KEY && key !== null) return false;
      forceDisabled = false;
      return true;
    },
  };
}

const browserNavigationPrefetchStore = createNavigationPrefetchPreferenceStore(() => window.localStorage);

function readNavigationPrefetchEnabled() {
  if (typeof window === "undefined") return false;
  return browserNavigationPrefetchStore.read();
}

function subscribeToNavigationPrefetch(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (browserNavigationPrefetchStore.handleStorageEventKey(event.key)) onStoreChange();
  }
  function handleLocalChange() {
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(NAVIGATION_PREFETCH_CHANGE_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(NAVIGATION_PREFETCH_CHANGE_EVENT, handleLocalChange);
  };
}

export function useNavigationPrefetchEnabled() {
  return useSyncExternalStore(
    subscribeToNavigationPrefetch,
    readNavigationPrefetchEnabled,
    () => false,
  );
}

function setNavigationPrefetchEnabled(enabled: boolean) {
  browserNavigationPrefetchStore.write(enabled);
  window.dispatchEvent(new Event(NAVIGATION_PREFETCH_CHANGE_EVENT));
}

type NavigationPrefetchLinkProps = ComponentProps<typeof Link>;

export function NavigationPrefetchLink(props: NavigationPrefetchLinkProps) {
  const enabled = useNavigationPrefetchEnabled();
  return <Link {...props} prefetch={navigationPrefetchProp(enabled)} />;
}

export function NavigationPrefetchControl() {
  const enabled = useNavigationPrefetchEnabled();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => setNavigationPrefetchEnabled(!enabled)}
      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900"
      title="Styr automatisk navigationsförladdning i den här webbläsaren. Av minskar spekulativa server- och databasanrop."
    >
      Auto prefetch: {enabled ? "På" : "Av"}
    </button>
  );
}
