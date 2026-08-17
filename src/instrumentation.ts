import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { buildPreviewSafeBrevoRequestInit } from "@/lib/preview-email-egress";

const PREVIEW_FETCH_GUARD = Symbol.for("proffera.preview-email-fetch-guard");

type GuardedFetch = typeof fetch & {
  [PREVIEW_FETCH_GUARD]?: true;
};

export async function register() {
  if (process.env.VERCEL_ENV !== "preview") return;

  const previewEnv: NodeJS.ProcessEnv = { ...process.env };
  const previewBrevoApiKey = resolveBrevoApiKey(previewEnv);
  if (previewBrevoApiKey) {
    process.env.BREVO_API_KEY = previewBrevoApiKey;
  } else {
    delete process.env.BREVO_API_KEY;
  }

  const currentFetch = globalThis.fetch as GuardedFetch;
  if (currentFetch[PREVIEW_FETCH_GUARD]) return;

  const originalFetch = currentFetch.bind(globalThis);
  const guardedFetch: GuardedFetch = async (input, init) => {
    const safeInit = buildPreviewSafeBrevoRequestInit(input, init, previewEnv);
    return originalFetch(input, safeInit);
  };
  guardedFetch[PREVIEW_FETCH_GUARD] = true;
  globalThis.fetch = guardedFetch;
}
