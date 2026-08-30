"use client";

import Link from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";

export const NAVIGATION_PREFETCH_STORAGE_KEY = "proffera.navigation-prefetch.enabled";
const NAVIGATION_PREFETCH_CHANGE_EVENT = "proffera:navigation-prefetch-change";
let forceNavigationPrefetchDisabled = false;

export function navigationPrefetchPreferenceEnabled(value: string | null) {
  return value === "on";
}

function readNavigationPrefetchEnabled() {
  if (typeof window === "undefined" || forceNavigationPrefetchDisabled) return false;
  try {
    return navigationPrefetchPreferenceEnabled(window.localStorage.getItem(NAVIGATION_PREFETCH_STORAGE_KEY));
  } catch {
    return false;
  }
}

function subscribeToNavigationPrefetch(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key !== NAVIGATION_PREFETCH_STORAGE_KEY) return;
    forceNavigationPrefetchDisabled = false;
    onStoreChange();
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
  try {
    window.localStorage.setItem(NAVIGATION_PREFETCH_STORAGE_KEY, enabled ? "on" : "off");
    forceNavigationPrefetchDisabled = false;
  } catch {
    forceNavigationPrefetchDisabled = true;
  }
  window.dispatchEvent(new Event(NAVIGATION_PREFETCH_CHANGE_EVENT));
}

type NavigationPrefetchLinkProps = ComponentProps<typeof Link>;

export function NavigationPrefetchLink(props: NavigationPrefetchLinkProps) {
  const enabled = useNavigationPrefetchEnabled();
  return <Link {...props} prefetch={enabled ? undefined : false} />;
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
