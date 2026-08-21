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
    const sonar = source(".github/workflows/sonarqube.yml");

    expect(ci).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(ci).toMatch(/actions\/setup-node@[0-9a-f]{40} # v7/);
    expect(ci).not.toMatch(/actions\/(checkout|setup-node)@v\d+/);

    expect(codeql).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(codeql).toMatch(/github\/codeql-action\/init@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/autobuild@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/analyze@[0-9a-f]{40} # v4/);
    expect(codeql).not.toMatch(/github\/codeql-action\/(init|autobuild|analyze)@v\d+/);

    expect(sonar).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(sonar).toContain(
      "SonarSource/sonarqube-scan-action@22918119ff8e1ca75a623e15c8296b6ea4fbe28f # v8.2.1",
    );
    expect(sonar).not.toMatch(/SonarSource\/sonarqube-scan-action@v\d+/);
  });

  it("keeps SonarQube opt-in, credential-safe, and advisory at first", () => {
    const sonar = source(".github/workflows/sonarqube.yml");
    const project = source("sonar-project.properties");

    expect(sonar).toContain("vars.SONARQUBE_ENABLED == 'true'");
    expect(sonar).toContain("secrets.SONAR_TOKEN");
    expect(sonar).toContain("vars.SONAR_PROJECT_KEY");
    expect(sonar).toContain("vars.SONAR_HOST_URL");
    expect(sonar).toContain("vars.SONAR_ORGANIZATION");
    expect(sonar).toContain("fetch-depth: 0");
    expect(sonar).toContain("persist-credentials: false");
    expect(sonar).toContain("-Dsonar.qualitygate.wait=false");
    expect(sonar).not.toContain("SONAR_TOKEN=");

    expect(project).toContain("sonar.sources=src,scripts");
    expect(project).toContain("sonar.tests=tests,e2e/tests");
    expect(project).toContain("graphify-out/**");
    expect(project).not.toContain("SONAR_TOKEN");
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