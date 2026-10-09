import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load(source: string): any };
const root = resolve(process.cwd());

function run(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 15000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe("owner-authorized publication handoff contracts", () => {
  const files = [
    "supervisor-worker-handoff.yml",
    "supervisor-review-repair.yml",
    "proffera-ci-autofix.yml",
  ];

  it.each(files)("stages an immutable owner artifact and cannot publish automatically: %s", (name) => {
    const doc = yaml.load(readFileSync(join(root, ".github", "workflows", name), "utf8"));
    const publish = doc.jobs.publish;
    expect(publish).toBeDefined();
    const raw = JSON.stringify(publish);
    expect(raw).toContain("git bundle create");
    expect(raw).toContain("git bundle verify");
    expect(raw).toContain("upload-artifact@");
    expect(raw).toContain("owner-handoff.bundle");
    expect(raw).not.toMatch(/\bgit\s+push\b/);
    expect(raw).not.toContain("gh pr create");
    expect(raw).not.toContain("gh pr merge");
    expect(raw).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(raw).not.toContain("PUSH_TOKEN:");
  });

  it("a bundled exact-child commit can be transported without moving the source branch", () => {
    const work = mkdtempSync(join(tmpdir(), "proffera-owner-handoff-"));
    try {
      const source = join(work, "source");
      const recipient = join(work, "recipient");
      mkdirSync(source);
      run(source, "init", "-q");
      run(source, "config", "user.name", "Test");
      run(source, "config", "user.email", "test@example.invalid");
      writeFileSync(join(source, "candidate.txt"), "base\n");
      run(source, "add", ".");
      run(source, "commit", "-qm", "base");
      const base = run(source, "rev-parse", "HEAD");
      run(work, "clone", "-q", source, recipient);
      writeFileSync(join(source, "candidate.txt"), "candidate\n");
      run(source, "add", ".");
      run(source, "commit", "-qm", "candidate");
      const head = run(source, "rev-parse", "HEAD");
      const tree = run(source, "rev-parse", "HEAD^{tree}");
      const bundle = join(work, "owner.bundle");
      run(source, "bundle", "create", bundle, "HEAD", "^" + base);
      run(source, "bundle", "verify", bundle);
      run(recipient, "fetch", bundle, "HEAD");
      expect(run(recipient, "rev-parse", "FETCH_HEAD")).toBe(head);
      expect(run(recipient, "rev-parse", "FETCH_HEAD^{tree}")).toBe(tree);
      expect(run(recipient, "rev-parse", "FETCH_HEAD^")).toBe(base);
      expect(run(recipient, "rev-parse", "HEAD")).toBe(base);
      expect(run(source, "rev-parse", "HEAD")).toBe(head);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
