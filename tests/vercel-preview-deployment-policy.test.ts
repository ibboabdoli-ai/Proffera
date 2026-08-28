import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Vercel preview deployment policy", () => {
  it("allows automatic Git deployments only for main and explicit preview branches", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      git?: {
        deploymentEnabled?: Record<string, boolean>;
      };
    };

    // Vercel evaluates overlapping minimatch rules so an explicit true keeps
    // Production main and intentional preview/* branches deployable.
    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      main: true,
      "preview/*": true,
    });
  });
});
