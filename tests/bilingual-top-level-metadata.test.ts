import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createEnglishMetadata, createSwedishMetadata } from "../src/lib/english-metadata";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("bilingual top-level metadata", () => {
  it("builds Swedish canonical, hreflang, OpenGraph and Twitter metadata", () => {
    const metadata = createSwedishMetadata({
      title: "Svensk titel | Proffera",
      description: "Svensk beskrivning",
      swedishPath: "/tjanster",
      englishPath: "/en/services",
    });

    expect(metadata).toMatchObject({
      title: { absolute: "Svensk titel | Proffera" },
      description: "Svensk beskrivning",
      alternates: {
        canonical: "/tjanster",
        languages: {
          "sv-SE": "/tjanster",
          en: "/en/services",
        },
      },
      openGraph: {
        title: "Svensk titel | Proffera",
        description: "Svensk beskrivning",
        url: "/tjanster",
        siteName: "Proffera",
        locale: "sv_SE",
        type: "website",
        images: ["/og"],
      },
      twitter: {
        card: "summary_large_image",
        title: "Svensk titel | Proffera",
        description: "Svensk beskrivning",
        images: ["/og"],
      },
    });
  });

  it("keeps English canonical/hreflang and supplies locale-correct Twitter metadata", () => {
    const metadata = createEnglishMetadata({
      title: "English title",
      description: "English description",
      swedishPath: "/priser",
      englishPath: "/en/pricing",
    });

    expect(metadata).toMatchObject({
      title: "English title",
      description: "English description",
      alternates: {
        canonical: "/en/pricing",
        languages: {
          "sv-SE": "/priser",
          en: "/en/pricing",
        },
      },
      openGraph: {
        title: "English title | Proffera",
        description: "English description",
        url: "/en/pricing",
        siteName: "Proffera",
        locale: "en_US",
        type: "website",
        images: ["/og"],
      },
      twitter: {
        card: "summary_large_image",
        title: "English title | Proffera",
        description: "English description",
        images: ["/og"],
      },
    });
  });

  it.each([
    ["src/app/page.tsx", "/", "/en"],
    ["src/app/for-foretag/page.tsx", "/for-foretag", "/en/for-business"],
    ["src/app/tjanster/page.tsx", "/tjanster", "/en/services"],
    ["src/app/priser/page.tsx", "/priser", "/en/pricing"],
  ])("wires %s to the Swedish metadata contract", (path, swedishPath, englishPath) => {
    const code = source(path);

    expect(code).toContain("createSwedishMetadata");
    expect(code).toContain(`swedishPath: "${swedishPath}"`);
    expect(code).toContain(`englishPath: "${englishPath}"`);
  });
});
