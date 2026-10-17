import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const activeFolders: string[] = [];
const digest = "sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea";

function preloadScript() {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replace(/\r\n/g, "\n");
  const marker = "      - name: Preload pinned official PostgreSQL test image with registry fallback\n";
  const begin = workflow.indexOf(marker);
  expect(begin).toBeGreaterThanOrEqual(0);
  const end = workflow.indexOf("\n      - name: Test\n", begin);
  expect(end).toBeGreaterThan(begin);
  const section = workflow.slice(begin, end);
  const runIndex = section.indexOf("        run: |\n");
  expect(runIndex).toBeGreaterThanOrEqual(0);
  return section.slice(runIndex + "        run: |\n".length)
    .split("\n").map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

function execute(mode: "primary-ok" | "primary-fails" | "both-fail" | "tag-mismatch") {
  const root = mkdtempSync(join(tmpdir(), "proffera-ci-postgres-"));
  activeFolders.push(root);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const calls = join(root, "calls.txt");
  const docker = join(bin, "docker");
  writeFileSync(docker, [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'printf "%s\\n" "$*" >> "$DOCKER_CALLS"',
    'if [ "$1" = "pull" ]; then',
    '  if [ "$TEST_MODE" = "both-fail" ]; then exit 1; fi',
    '  if [ "$TEST_MODE" = "primary-fails" ] && [[ "$2" == docker.io/* ]]; then exit 1; fi',
    'fi',
    'if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then',
    '  if [ "$TEST_MODE" = "tag-mismatch" ] && [ "$3" = "postgres:16-alpine" ]; then',
    '    echo "sha256:wrong"',
    '  else',
    '    echo "sha256:verified"',
    '  fi',
    'fi',
  ].join("\n") + "\n");
  chmodSync(docker, 0o755);
  const sleep = join(bin, "sleep");
  writeFileSync(sleep, "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(sleep, 0o755);
  const result = spawnSync("bash", ["-c", preloadScript()], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15000,
    env: { ...process.env, PATH: bin + delimiter + process.env.PATH, TEST_MODE: mode, DOCKER_CALLS: calls },
  });
  return { result, calls: readFileSync(calls, "utf8").trim().split("\n") };
}

afterEach(() => {
  for (const folder of activeFolders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("pinned PostgreSQL CI image registry fallback", () => {
  it("loads the exact pinned image from Docker Hub without contacting fallback", () => {
    const { result, calls } = execute("primary-ok");
    expect(result.status, result.stderr).toBe(0);
    expect(calls).toContain("pull docker.io/library/postgres@" + digest);
    expect(calls.some((call) => call.startsWith("pull public.ecr.aws/"))).toBe(false);
    expect(calls).toContain("tag docker.io/library/postgres@" + digest + " postgres:16-alpine");
  });

  it("falls back to the same digest on public ECR after primary rate limits", () => {
    const { result, calls } = execute("primary-fails");
    expect(result.status, result.stderr).toBe(0);
    expect(calls.filter((call) => call === "pull docker.io/library/postgres@" + digest)).toHaveLength(2);
    expect(calls).toContain("pull public.ecr.aws/docker/library/postgres@" + digest);
    expect(calls).toContain("tag public.ecr.aws/docker/library/postgres@" + digest + " postgres:16-alpine");
  });

  it("fails closed and never tags or skips when both registries are unavailable", () => {
    const { result, calls } = execute("both-fail");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("refusing to skip integration tests");
    expect(calls.filter((call) => call.startsWith("pull "))).toHaveLength(4);
    expect(calls.some((call) => call.startsWith("tag "))).toBe(false);
  });

  it("rejects an unexpected retagged image identity", () => {
    const { result, calls } = execute("tag-mismatch");
    expect(result.status).not.toBe(0);
    expect(calls).toContain("tag docker.io/library/postgres@" + digest + " postgres:16-alpine");
  });
});
