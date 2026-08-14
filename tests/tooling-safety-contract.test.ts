import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("tooling safety contract", () => {
  it("enforces the pinned Graphify release even when graphify is already installed", () => {
    const skill = source(".codex/skills/graphify/SKILL.md");

    expect(skill).toContain('GRAPHIFY_VERSION="0.9.42"');
    expect(skill).toContain("graphify --version 2>&1 | grep -Eq");
    expect(skill).toContain('uv tool install --force "graphifyy==$GRAPHIFY_VERSION"');
    expect(skill).toContain('python3 -m pip install --upgrade "graphifyy==$GRAPHIFY_VERSION"');
    expect(skill).toContain("the active graphify executable does not match");
    expect(skill).toContain("exit 1");
  });

  it("pins GitHub Actions to immutable commit SHAs", () => {
    const ci = source(".github/workflows/ci.yml");
    const codeql = source(".github/workflows/codeql.yml");

    expect(ci).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(ci).toMatch(/actions\/setup-node@[0-9a-f]{40} # v7/);
    expect(ci).not.toMatch(/actions\/(checkout|setup-node)@v\d+/);

    expect(codeql).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(codeql).toMatch(/github\/codeql-action\/init@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/autobuild@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/analyze@[0-9a-f]{40} # v4/);
    expect(codeql).not.toMatch(/github\/codeql-action\/(init|autobuild|analyze)@v\d+/);
  });

  it("keeps Playwright off known production hosts and aligns local navigation with its dev server", () => {
    const config = source("e2e/playwright.config.mjs");

    expect(config).toContain('"chat.proffera.se"');
    expect(config).toContain("Local Playwright targets must include an explicit port.");
    expect(config).toContain("const localServerUrl = parsedBaseUrl.origin;");
    expect(config).toContain("--hostname ${localServerHost} --port ${localServerPort}");
    expect(config).toContain("url: localServerUrl");
    expect(config).not.toContain("url: localBaseUrl");
  });
});