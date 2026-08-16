import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public shell performance contract", () => {
  it("defers the Proffera marketing chat widget until after the page load settles", () => {
    const widget = source("src/components/service-ai-chat-widget.tsx");

    expect(widget).toContain('id="proffera-chat-widget"');
    expect(widget).toContain('strategy="lazyOnload"');
    expect(widget).toContain('strategy="afterInteractive"');
  });

  it("registers the global service worker during browser idle time", () => {
    const serviceWorker = source("src/components/pwa-service-worker.tsx");

    expect(serviceWorker).toContain("requestIdleCallback");
    expect(serviceWorker).toContain("setTimeout(register, 1500)");
    expect(serviceWorker).toContain('navigator.serviceWorker.register("/sw.js", { scope: "/" })');
  });
});
