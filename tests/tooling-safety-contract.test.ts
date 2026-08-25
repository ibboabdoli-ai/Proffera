import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function runSonarValidation(overrides: Record<string, string>) {
  return spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/validate-sonarqube-config.mjs")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SONAR_TOKEN: "test-token",
        SONAR_PROJECT_KEY: "test-project",
        SONAR_HOST_URL: "",
        SONAR_ORGANIZATION: "",
        ...overrides,
      },
    },
  );
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
    const sonarActionRefs = [
      ...sonar.matchAll(/uses:\s*SonarSource\/sonarqube-scan-action@([^\s#]+)/g),
    ].map((match) => match[1]);
    expect(sonarActionRefs.length).toBeGreaterThan(0);
    for (const ref of sonarActionRefs) {
      expect(ref).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(sonar).not.toMatch(/SonarSource\/sonarqube-scan-action@v\d+/);
  });

  it("keeps SonarQube opt-in, credential-safe, and advisory", () => {
    const sonar = source(".github/workflows/sonarqube.yml");
    const project = source("sonar-project.properties");

    expect(sonar).toContain("vars.SONARQUBE_ENABLED == 'true'");
    expect(sonar).toContain("github.actor != 'dependabot[bot]'");
    expect(sonar).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(sonar).toContain("secrets.SONAR_TOKEN");
    expect(sonar).toContain("vars.SONAR_PROJECT_KEY");
    expect(sonar).toContain("vars.SONAR_HOST_URL");
    expect(sonar).toContain("vars.SONAR_ORGANIZATION");
    expect(sonar).toContain("fetch-depth: 0");
    expect(sonar).toContain("persist-credentials: false");
    expect(sonar).toContain("-Dsonar.qualitygate.wait=false");
    expect(sonar).toContain("node scripts/validate-sonarqube-config.mjs");
    expect(sonar).not.toContain("SONAR_TOKEN=");

    expect(project).toContain("sonar.sources=src,scripts");
    expect(project).toContain("sonar.tests=tests,e2e/tests");
    expect(project).toContain("graphify-out/**");
    expect(project).not.toContain("SONAR_TOKEN");
  });

  it("accepts exactly one SonarQube deployment mode and fails closed otherwise", () => {
    const serverOnly = runSonarValidation({ SONAR_HOST_URL: "https://sonar.example.com" });
    expect(serverOnly.status).toBe(0);

    const cloudOnly = runSonarValidation({ SONAR_ORGANIZATION: "proffera" });
    expect(cloudOnly.status).toBe(0);

    const neither = runSonarValidation({});
    expect(neither.status).toBe(1);
    expect(neither.stderr).toContain("configure SONAR_HOST_URL for SonarQube Server or SONAR_ORGANIZATION for SonarQube Cloud");

    const both = runSonarValidation({
      SONAR_HOST_URL: "https://sonar.example.com",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(both.status).toBe(1);
    expect(both.stderr).toContain("configure either SonarQube Server or SonarQube Cloud mode, not both");

    const missingToken = runSonarValidation({
      SONAR_TOKEN: "",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(missingToken.status).toBe(1);
    expect(missingToken.stderr).toContain("SONAR_TOKEN is required when SONARQUBE_ENABLED=true");

    const missingProjectKey = runSonarValidation({
      SONAR_PROJECT_KEY: "",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(missingProjectKey.status).toBe(1);
    expect(missingProjectKey.stderr).toContain("SONAR_PROJECT_KEY is required when SONARQUBE_ENABLED=true");

    for (const result of [serverOnly, cloudOnly, neither, both, missingToken, missingProjectKey]) {
      expect(`${result.stdout}${result.stderr}`).not.toContain("test-token");
    }
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
