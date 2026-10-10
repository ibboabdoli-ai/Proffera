import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load(source: string): { jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }> } };
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

describe("Worker fallback recovery ZIP inventory", () => {
  it("preserves cleanup bash syntax and validates the bundle before recording RECOVERABLE", () => {
    const doc = yaml.load(readFileSync(join(root, ".github/workflows/supervisor-worker-handoff.yml"), "utf8"));
    const source = String(doc.jobs.cleanup.steps.find((item: {name?: string}) =>
      item.name === "Reconcile exact stranded reservation after publish setup failure")?.run);
    const syntax = spawnSync("bash", ["-n"], {input:source, encoding:"utf8", timeout:10000});
    expect(syntax.status, syntax.stderr).toBe(0);
    expect(source.indexOf('test "$(git rev-parse FETCH_HEAD)" = "$head_sha"'))
      .toBeGreaterThan(source.indexOf('git bundle verify "$owner_bundle"'));
    expect(source.indexOf('.recovery={kind:"artifact",digest:$digest,expires_at:$expires}'))
      .toBeGreaterThan(source.indexOf('test "$(git rev-parse FETCH_HEAD)" = "$head_sha"'));
    expect(source).toContain('if [ "$archive_entries" = "$owner_entries" ]; then');
    expect(source).toContain('elif [ "$archive_entries" = "$legacy_entries" ]; then');
  });

  it("accepts only authenticated recovery archive layouts and rejects injected or duplicated entries", () => {
    const doc = yaml.load(readFileSync(join(root, ".github/workflows/supervisor-worker-handoff.yml"), "utf8"));
    const step = doc.jobs.cleanup.steps.find((item: {name?: string}) =>
      item.name === "Reconcile exact stranded reservation after publish setup failure");
    expect(step?.run).toBeTruthy();
    const source = String(step?.run);
    const start = source.indexOf('archive_entries="$(unzip -Z1 "$archive"');
    const end = source.indexOf('unzip -p "$archive" proffera-publication-artifact.json', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const verifyInventory = source.slice(start, end);
    const four = ["proffera-publication-artifact.json", "proffera-owner-handoff.bundle",
      "proffera-owner-handoff.bundle.sha256", "proffera-owner-handoff.json"];
    const trials = [
      {names: four, accepted: true},
      {names: [...four].reverse(), accepted: true},
      {names: ["proffera-publication-artifact.json"], accepted: true}, // historical recovery
      {names: [...four, "untrusted.sh"], accepted: false},
      {names: [...four, "proffera-owner-handoff.json"], accepted: false},
      {names: [...four.slice(0, 3), "../escape"], accepted: false},
      {names: four.slice(0, 3), accepted: false},
      {names: ["proffera-publication-artifact.json", "junk"], accepted: false},
    ];
    const work = mkdtempSync(join(tmpdir(), "proffera-owner-zip-inventory-"));
    try {
      for (let i = 0; i < trials.length; i++) {
        const trial = trials[i];
        const archive = join(work, "artifact-" + i + ".zip");
        const fixture = spawnSync("python", ["-c",
          "import json,sys,zipfile; names=json.loads(sys.argv[2]); z=zipfile.ZipFile(sys.argv[1],'w'); [z.writestr(n,'fixture') for n in names]; z.close()",
          archive, JSON.stringify(trial.names)], {encoding:"utf8",timeout:10000});
        expect(fixture.status, fixture.stderr).toBe(0);
        const result = spawnSync("bash", ["-c", "set -euo pipefail\n" + verifyInventory], {
          env: {...process.env, archive}, encoding:"utf8",timeout:10000});
        expect(result.status, JSON.stringify({names:trial.names,stderr:result.stderr,stdout:result.stdout}))
          .toBe(trial.accepted ? 0 : 1);
      }
    } finally {
      rmSync(work,{recursive:true,force:true});
    }
  });
});

describe("Worker owner archive integrity and ancestry", () => {
  it("validates real owner bundle parent/tree and fails closed on altered metadata or checksum", () => {
    const doc = yaml.load(readFileSync(join(root, ".github/workflows/supervisor-worker-handoff.yml"), "utf8"));
    const source = String(doc.jobs.cleanup.steps.find((item: {name?: string}) =>
      item.name === "Reconcile exact stranded reservation after publish setup failure")?.run);
    const start = source.indexOf('if [ "$archive_layout" = "owner" ]; then');
    const end = source.indexOf('live_source="$(gh api', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const check = source.slice(start, end);
    const work = mkdtempSync(join(tmpdir(), "proffera-owner-bundle-check-"));
    const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
    const zip = (folder: string, target: string) => {
      const names = ["proffera-publication-artifact.json", "proffera-owner-handoff.bundle",
        "proffera-owner-handoff.bundle.sha256", "proffera-owner-handoff.json"];
      const result = spawnSync("python", ["-c",
        "import sys,zipfile,os; p=sys.argv[1]; z=zipfile.ZipFile(sys.argv[2],'w'); [z.write(os.path.join(p,n),n) for n in sys.argv[3:]]; z.close()",
        folder, target, ...names], {encoding:"utf8",timeout:10000});
      expect(result.status, result.stderr).toBe(0);
    };
    try {
      const sourceRepo = join(work, "source");
      const checkRepo = join(work, "check");
      const payloadDir = join(work, "payload");
      mkdirSync(sourceRepo); mkdirSync(payloadDir);
      run(sourceRepo, "init", "-q");
      run(sourceRepo, "config", "user.name", "Fixture");
      run(sourceRepo, "config", "user.email", "fixture@example.invalid");
      writeFileSync(join(sourceRepo, "source.txt"), "parent\n");
      run(sourceRepo, "add", ".");
      run(sourceRepo, "commit", "-qm", "base");
      const base = run(sourceRepo, "rev-parse", "HEAD");
      run(work, "clone", "-q", sourceRepo, checkRepo);
      writeFileSync(join(sourceRepo, "source.txt"), "child\n");
      run(sourceRepo, "add", ".");
      run(sourceRepo, "commit", "-qm", "candidate");
      const head = run(sourceRepo, "rev-parse", "HEAD");
      const tree = run(sourceRepo, "rev-parse", "HEAD^{tree}");
      const bundle = join(payloadDir, "proffera-owner-handoff.bundle");
      run(sourceRepo, "bundle", "create", bundle, "HEAD", "^" + base);
      const bundleDigest = sha(readFileSync(bundle));
      const recovery = "{}\n";
      const recoveryDigest = sha(recovery);
      writeFileSync(join(payloadDir, "proffera-publication-artifact.json"), recovery);
      writeFileSync(join(payloadDir, "proffera-owner-handoff.bundle.sha256"),
        bundleDigest + "  proffera-owner-handoff.bundle\n");
      const valid = {
        state:"OWNER_PUSH_REQUIRED",published:false,repository:"ibboabdoli-ai/Proffera",
        branch:"work/proffera-test",task_id:"SUP-TEST",base_sha:base,parent_sha:base,
        head_sha:head,tree_sha:tree,bundle_sha256:bundleDigest,
        recovery_sha256:recoveryDigest,run_id:51,run_attempt:1,
      };
      const manifestPath = join(payloadDir, "proffera-owner-handoff.json");
      const archive = join(work, "archive.zip");
      const execute = (manifest: Record<string, unknown>, damage = false) => {
        writeFileSync(manifestPath, JSON.stringify(manifest));
        if (damage) writeFileSync(join(payloadDir, "proffera-owner-handoff.bundle.sha256"),
          "0".repeat(64) + "  proffera-owner-handoff.bundle\n");
        else writeFileSync(join(payloadDir, "proffera-owner-handoff.bundle.sha256"),
          bundleDigest + "  proffera-owner-handoff.bundle\n");
        zip(payloadDir, archive);
        return spawnSync("bash", ["-c", "set -euo pipefail\n" + check], {
          cwd:checkRepo,encoding:"utf8",timeout:15000,
          env:{...process.env,
            RUNNER_TEMP:work.replaceAll("\\","/"),archive:archive.replaceAll("\\","/"),archive_layout:"owner",REPOSITORY:"ibboabdoli-ai/Proffera",
            BRANCH:"work/proffera-test",TASK_ID:"SUP-TEST",BASE_SHA:base,head_sha:head,
            target_tree_sha:tree,recovery_digest:recoveryDigest,RUN_ID:"51"},
        });
      };
      const good = execute(valid);
      expect(good.status, JSON.stringify(good)).toBe(0);
      expect(run(checkRepo, "rev-parse", "FETCH_HEAD")).toBe(head);
      for(const bad of [
        {...valid, run_id:52}, {...valid, tree_sha:"a".repeat(40)},
        {...valid, published:true}, {...valid, state:"PUBLISHED"},
        {...valid, branch:"work/proffera-else"}, {...valid, run_attempt:0},
      ]) {
        const result=execute(bad);
        expect(result.status, JSON.stringify({bad,stderr:result.stderr})).not.toBe(0);
      }
      const damage=execute(valid,true);
      expect(damage.status).not.toBe(0);
    } finally {
      rmSync(work,{recursive:true,force:true});
    }
  }, 25000);
});
