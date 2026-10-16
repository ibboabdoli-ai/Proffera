import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type WorkflowPermissions = Record<string, string> | string;
type WorkflowJob = {
  permissions?: WorkflowPermissions;
  env?: unknown;
  steps: Array<{name?: string; run?: string; env?: unknown; with?: unknown}>;
};
type WorkflowDocument = {
  permissions?: WorkflowPermissions;
  env?: unknown;
  jobs: Record<string, WorkflowJob>;
};
const yaml = require("js-yaml") as { load(source: string): WorkflowDocument };
const root = resolve(process.cwd());

// Bash removes unquoted backslash-newline continuations BEFORE parsing
// commands, including continuations inside a command name or API path.
const bashLogicalLines = (source: string) => source.replace(/\\\r?\n/g, "");
function assertNoUnapprovedPublication(workflowName: string, jobName: string,
  job: WorkflowJob, workflowPermissions?: WorkflowPermissions, workflowEnv?: unknown) {
  // A job inherits workflow-level permissions unless it defines its own.
  // Issue/PR comment write is allowed for audit records and review routing;
  // code, Actions, security, deployment and other write scopes are not.
  const effective = job.permissions ?? workflowPermissions;
  if (effective == null) {
    throw new Error(`${workflowName} ${jobName} must declare explicit token permissions`);
  }
  expect(effective, `${workflowName} ${jobName} cannot grant write-all`).not.toBe("write-all");
  if (typeof effective === "string") {
    expect(effective, `${workflowName} ${jobName} permissions must be read-all`).toBe("read-all");
  } else {
    for (const [scope, access] of Object.entries(effective)) {
      if (scope !== "issues" && scope !== "pull-requests") {
        expect(access, `${workflowName} ${jobName} cannot write ${scope}`).not.toBe("write");
      }
    }
  }
  const inheritedOptions = JSON.stringify({workflowEnv: workflowEnv ?? null, jobEnv: job.env ?? null});
  expect(inheritedOptions, `${workflowName} ${jobName} cannot inherit push credentials`)
    .not.toMatch(/(?:PROFFERA_AUTOFIX_PUSH_TOKEN|PUSH_TOKEN)/i);
  for (const step of job.steps ?? []) {
    const stepOptions = JSON.stringify({env: step.env ?? null, with: step.with ?? null});
    expect(stepOptions, `${workflowName} ${jobName} cannot use push credentials`)
      .not.toMatch(/(?:PROFFERA_AUTOFIX_PUSH_TOKEN|PUSH_TOKEN)/i);
    // Conservative shell-word scan: adjacent quoted/escaped fragments are
    // concatenated by Bash (e.g. g''it, gi"t" and g\\it all invoke git).
    const script = bashLogicalLines(String(step.run ?? ""))
      .replace(/\\(?=[A-Za-z])/g, "")
      .replace(/["']/g, "");
    expect(script, `${workflowName} ${jobName} cannot create or merge PRs`)
      .not.toMatch(/(?<![\w./-])gh\b[^\r\n;|&]*?\bpr\b[^\r\n;|&]*?\b(?:create|merge)\b/i);
    // Keep the existing fail-closed PR-closing PATCH permitted; prohibit
    // PR creation and merge through the equivalent gh api endpoints.
    for (const apiCommand of script.match(/(?<![\w./-])gh\b[^\r\n;|&]*?\bapi\b[^\r\n;|&]*/gi) ?? []) {
      if (/\bgraphql\b/i.test(apiCommand)) {
        const graphqlEvidence = JSON.stringify({
          apiCommand, workflowEnv, jobEnv: job.env ?? null, stepEnv: step.env ?? null,
        });
        expect(graphqlEvidence, `${workflowName} ${jobName} cannot publish PRs via GraphQL`)
          .not.toMatch(/\b(?:createPullRequest|mergePullRequest)\b/i);
        expect(apiCommand, `${workflowName} ${jobName} cannot use a dynamic GraphQL query`)
          .not.toMatch(/(?:^|\s)(?:-f|-F|--field|--raw-field)(?:=|\s+)query=(?:\$|@)|(?:^|\s)--input(?:=|\s+)/i);
      }
      const writeMethod = /(?:--method(?:=|\s+)|-X(?:=|\s+))(?:POST|PUT|PATCH|DELETE)\b/i;
      const explicitGet = /(?:--method(?:=|\s+)|-X(?:=|\s+))GET\b/i;
      const implicitPost = /(?:^|\s)(?:-f|-F|--field|--raw-field)(?:=|\s+)/i;
      if (!writeMethod.test(apiCommand) && (explicitGet.test(apiCommand) || !implicitPost.test(apiCommand))) continue;
      const repository = String.raw`repos\/(?:\$\{\{[^}]+\}\}|\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|[^/\s]+\/[^/\s]+)`;
      expect(apiCommand, `${workflowName} ${jobName} cannot create PRs via API`)
        .not.toMatch(new RegExp(repository + String.raw`\/pulls(?=[\s?#]|$)`, "i"));
      expect(apiCommand, `${workflowName} ${jobName} cannot merge PRs via API`)
        .not.toMatch(new RegExp(repository + String.raw`\/pulls\/(?:\$\{[^}]+\}|[^/\s]+)\/merge(?=[\s?#]|$)`, "i"));
    }
    // Fail closed for Git global options (e.g. `git -c key=value push`).
    // Keep the search within one Bash logical command line; a literal `.git`
    // path must not be mistaken for the Git executable.
    expect(script, `${workflowName} ${jobName} must not push`)
      .not.toMatch(/(?<![\w./-])git\b[^\r\n;|&]*?\bpush\b/i);
    expect(script, `${workflowName} ${jobName} must not mutate refs via GitHub API`)
      .not.toMatch(/(?<![\w./-])gh\b[^\r\n;|&]*?\bapi\b[^\r\n;|&]*?\/git\/["']*refs["']*(?:\/|\b)/i);
    expect(script, `${workflowName} ${jobName} must not use a push token`)
      .not.toMatch(/(?:PROFFERA_AUTOFIX_PUSH_TOKEN|PUSH_TOKEN\s*[:=])/);
  }
}

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
    for (const [jobName, job] of Object.entries(doc.jobs)) {
      assertNoUnapprovedPublication(name, jobName, job, doc.permissions, doc.env);
    }
  });

  it.each([
    {name:"inherited workflow-level write", workflowPermissions:{contents:"write"}, job:{steps:[]}},
    {name:"inherited workflow-level write-all", workflowPermissions:"write-all", job:{steps:[]}},
    {name:"explicit job write-all", job:{permissions:"write-all",steps:[]}},
    {name:"explicit non-comment job write", job:{permissions:{actions:"write"},steps:[]}},
    {name:"push token in another job environment", job:{steps:[{env:{GH_TOKEN:"${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}"} }]}},
    {name:"push token in checkout with options", job:{steps:[{with:{token:"${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}"} }]}},
    {name:"PR creation in a non-publish job", job:{steps:[{run:"gh pr create --title unsafe"}]}},
    {name:"PR merge in a non-publish job", job:{steps:[{run:"gh pr merge 941 --squash"}]}},
  ])("rejects publication authority outside the publish job: $name", ({job,workflowPermissions}) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml","audit",job,workflowPermissions ?? {contents:"read"}))
      .toThrow();
  });

  it("rejects missing job and workflow token permissions", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      steps: [{run: "echo safe"}],
    })).toThrow(/must declare explicit token permissions/);
  });

  it.each([
    {name: "workflow-level push token", workflowEnv: {GH_TOKEN: "${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}"}, jobEnv: undefined},
    {name: "job-level push token", workflowEnv: undefined, jobEnv: {GH_TOKEN: "${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}"}},
  ])("rejects $name inherited by a job", ({workflowEnv, jobEnv}) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      permissions: {contents:"read"}, env:jobEnv, steps:[{run:"echo safe"}],
    }, undefined, workflowEnv)).toThrow(/cannot inherit push credentials/);
  });

  it.each([
    ["explicit POST create", "gh api --method POST repos/OWNER/REPO/pulls"],
    ["implicit POST create", "gh api repos/OWNER/REPO/pulls -f title=unsafe"],
    ["GitHub Actions expression POST create", 'gh api --method POST "repos/${{ github.repository }}/pulls" -f title=unsafe'],
    ["shell-variable POST create", "gh api -X POST repos/$GITHUB_REPOSITORY/pulls -f title=unsafe -f head=topic -f base=main"],
    ["PUT merge", "gh api -X PUT repos/OWNER/REPO/pulls/941/merge"],
  ])("rejects PR publication through GitHub API: %s", (_name, command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      permissions: {contents:"read", "pull-requests":"write"}, steps:[{run:command}],
    })).toThrow(/cannot (?:create|merge) PRs via API/);
  });

  it.each([
    ["create", "gh api graphql -f query='mutation { createPullRequest(input: {}) { pullRequest { id } } }'"],
    ["merge", "gh api graphql -f query='mutation { mergePullRequest(input: {}) { pullRequest { id } } }'"],
  ])("rejects GraphQL PR %s mutation", (_name, command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      permissions:{contents:"read", "pull-requests":"write"}, steps:[{run:command}],
    })).toThrow(/cannot publish PRs via GraphQL/);
  });

  it("rejects GraphQL mutations inherited from step environment", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      permissions:{contents:"read", "pull-requests":"write"},
      steps:[{
        env:{QUERY:"mutation { mergePullRequest(input: {}) { pullRequest { id } } }"},
        run:'gh api graphql -f query="$QUERY"',
      }],
    })).toThrow(/cannot publish PRs via GraphQL/);
  });

  it("rejects an uninspectable GraphQL query even without an explicit mutation", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "audit", {
      permissions:{contents:"read", "pull-requests":"write"},
      steps:[{run:'gh api graphql -f query="$QUERY"'}],
    })).toThrow(/cannot use a dynamic GraphQL query/);
  });

  it("permits the existing fail-closed PR close API and read-only PR lookup", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml","audit",{
      permissions:{contents:"read", "pull-requests":"write"},
      steps:[
        {run:"gh api --method PATCH repos/${REPOSITORY}/pulls/${PR_NUMBER} -f state=closed"},
        {run:"gh api repos/OWNER/REPO/pulls/941"},
        {run:"gh api -X GET repos/OWNER/REPO/pulls -f state=open"},
        {run:"gh api graphql -f query='query { viewer { login } }'"},
      ],
    })).not.toThrow();
  });

  it("allows the narrow issue/PR comment permissions without publication commands", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml","audit",{
      steps:[{run:"gh pr view 941 --json title"}],
    },{issues:"write","pull-requests":"write",contents:"read"})).not.toThrow();
  });

  it.each([
    "git \\\n push origin HEAD:main",
    "git pu\\\nsh origin HEAD:main",
    "gh api \\\n --method PATCH \\\n repos/ibboabdoli-ai/Proffera/git/refs/heads/main",
    "gh api repos/ibboabdoli-ai/Proffera/git/\\\nrefs/heads/main",
  ])("rejects valid Bash-continuation publication commands: %s", (command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "publish", {
      permissions:{contents:"read"},steps:[{run:command}]
    })).toThrow();
  });

  it.each([
    "git -c core.hooksPath=/dev/null push origin HEAD:main",
    "git -C . push origin HEAD:main",
    "git --git-dir=.git push origin HEAD:main",
    "git --no-pager push origin HEAD:main",
    "git -c core.hooksPath=/dev/null \\\n push origin HEAD:main",
  ])("rejects Git push with global options: %s", (command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "publish", {
      permissions:{contents:"read"},steps:[{run:command}]
    })).toThrow();
  });

  it.each([
    `gh api --method PATCH "repos/ibboabdoli-ai/Proffera/git/"'refs/heads/main'`,
    `gh api --method PATCH repos/ibboabdoli-ai/Proffera/git/"refs"/heads/main`,
    "gh api --method PATCH repos/ibboabdoli-ai/Proffera/git/ref\\\ns/heads/main",
  ])("rejects valid Bash-concatenated GitHub ref writes: %s", (command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "publish", {
      permissions:{contents:"read"},steps:[{run:command}]
    })).toThrow();
  });

  it.each([
    "g''it push origin HEAD:main",
    "git pus''h origin HEAD:main",
    'gi"t" push origin HEAD:main',
    "g\\it push origin HEAD:main",
    "gh a''pi --method PATCH repos/ibboabdoli-ai/Proffera/git/refs/heads/main",
    "gh api --method PATCH repos/ibboabdoli-ai/Proffera/git/re''fs/heads/main",
    'gh api --method PATCH repos/ibboabdoli-ai/Proffera/g"it"/refs/heads/main',
  ])("rejects valid shell-quoted publication commands: %s", (command) => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "publish", {
      permissions:{contents:"read"},steps:[{run:command}]
    })).toThrow();
  });

  it("allows read-only Git commands and literal .git text", () => {
    expect(() => assertNoUnapprovedPublication("fixture.yml", "publish", {
      permissions:{contents:"read"},
      steps:[{run:"git status --porcelain\necho '.git push is documentation, not a command'"}]
    })).not.toThrow();
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
    // Run the actual recovery shell segment in both authenticated ZIP layouts;
    // mock only external transport/validation and require Git bundle verification
    // before FETCH_HEAD can be read. No source-order assertions can substitute.
    const start = source.indexOf('archive_entries="$(unzip -Z1 "$archive"');
    const finishMarker = "label=RECOVERABLE";
    const finish = source.indexOf(finishMarker, start);
    expect(start).toBeGreaterThan(0);
    expect(finish).toBeGreaterThan(start);
    const actualShell = source.slice(start, finish + finishMarker.length);
    const recovery = "{}\n";
    const bundle = "fixture-bundle";
    const digest = (s: string) => createHash("sha256").update(s).digest("hex");
    const work = mkdtempSync(join(tmpdir(), "proffera-recovery-execution-"));
    const bashPath = (path: string) => path.replace(/^([A-Za-z]):\\/, (_match, drive: string) =>
      "/" + drive.toLowerCase() + "/").replaceAll("\\", "/");
    const mock = [
      "set -euo pipefail",
      "unzip() {",
      '  if [ "$1" = "-Z1" ]; then printf "%s\\n" "$ZIP_NAMES"; return; fi',
      '  case "$3" in',
      '    proffera-publication-artifact.json) printf "{}\\n";;',
      '    proffera-owner-handoff.bundle) printf "fixture-bundle";;',
      '    proffera-owner-handoff.bundle.sha256) printf "%s  proffera-owner-handoff.bundle\\n" "$BUNDLE_SHA";;',
      '    proffera-owner-handoff.json) printf "{}\\n";;',
      '    proffera-worker-pr-body.md) printf "frozen-owner-body";;',
      '    *) return 1;;',
      '  esac',
      "}",
      "jq() {",
      '  case "$1" in',
      '    -e) return 0;;',
      '    -n) printf \'{"ok":true,"target_head":"%s","target_tree_sha":"%s","run_id":"%s","paths":[]}\\n\' "$head_sha" "$target_tree_sha" "$RUN_ID";;',
      '    -r) case "$2" in',
      '      ".ok // false") echo true;;',
      '      ".target_head // \\\"\\\"") echo "$head_sha";;',
      '      ".target_tree_sha // \\\"\\\"") echo "$target_tree_sha";;',
      '      ".run_id // \\\"\\\"") echo "$RUN_ID";;',
      '      *) return 1;;',
      '    esac;;',
      '    -c) if [ "$2" = ".paths | sort" ]; then echo "[]"; else',
      '      [ "$2" = "--arg" ] && [ "$3" = "state" ] && [ "$4" = "RECOVERABLE" ] || return 1',
      '      [[ "$*" == *\'.state=$state | .recovery={kind:"artifact",digest:$digest,expires_at:$expires}\'* ]] || return 1',
      '      printf \'{"state":"%s","recovery":{"kind":"artifact"}}\\n\' "$4";',
      '    fi;;',
      '    *) return 1;;',
      '  esac',
      "}",
      'node() { [ "$2" = "validate-publication" ] && cat; }',
      'gh() { [ "$1" = "api" ] && printf "%s\\n" "$BASE_SHA"; }',
      "git() {",
      '  printf "%s\\n" "$*" >> "$EVENTS"',
      '  case "$*" in',
      '    "bundle verify "*) return 0;;',
      '    "bundle list-heads "*) printf "%s HEAD\\n" "$head_sha";;',
      '    "-c core.hooksPath=/dev/null fetch "*)',
      '       grep -q "^bundle verify " "$EVENTS" || return 1',
      '       printf "%s\\n" "$head_sha" > "$FETCHED_HEAD";;',
      '    "rev-parse FETCH_HEAD")',
      '       test -s "$FETCHED_HEAD" || return 1',
      '       cat "$FETCHED_HEAD";;',
      '    "rev-parse FETCH_HEAD^{tree}")',
      '       test "$(cat "$FETCHED_HEAD")" = "$head_sha" || return 1',
      '       printf "%s\\n" "$target_tree_sha";;',
      '    "rev-parse FETCH_HEAD^")',
      '       test "$(cat "$FETCHED_HEAD")" = "$head_sha" || return 1',
      '       printf "%s\\n" "$BASE_SHA";;',
      '    *) return 1;;',
      '  esac',
      "}",
    ].join("\n");
    const ownerEntries = ["proffera-publication-artifact.json", "proffera-owner-handoff.bundle",
      "proffera-owner-handoff.bundle.sha256", "proffera-owner-handoff.json", "proffera-worker-pr-body.md"];
    try {
      for (const layout of ["owner", "legacy"] as const) {
        const events = join(work, layout + "-git-calls");
        writeFileSync(events, "");
        const fetchedHead = join(work, layout + "-fetched-head");
        const result = spawnSync("bash", ["-c", mock + "\n" + actualShell +
          '\nprintf "LAYOUT=%s LABEL=%s PAYLOAD=%s\\n" "$archive_layout" "$label" "$payload"'], {
          encoding: "utf8", timeout: 15000,
          env: {...process.env, EVENTS:bashPath(events), FETCHED_HEAD:bashPath(fetchedHead), ZIP_NAMES:(layout === "owner" ? ownerEntries : [ownerEntries[0]]).join("\n"),
            BUNDLE_SHA:digest(bundle), RUNNER_TEMP:bashPath(work), archive:"fixture.zip",
            recovery_artifact:bashPath(join(work, layout + "-recovery.json")),recovery_digest:digest(recovery),
            REPOSITORY:"ibboabdoli-ai/Proffera",BRANCH:"work/proffera-test",
            TASK_ID:"SUP-TEST",BASE_SHA:"a".repeat(40),head_sha:"b".repeat(40),
            target_tree_sha:"c".repeat(40),RUN_ID:"51",packet:"{}",helper:"mock-helper",
            payload:"{}",reserved_paths:"[]"},
        });
        expect(result.status, JSON.stringify(result)).toBe(0);
        expect(result.stdout).toContain("LAYOUT=" + layout + " LABEL=RECOVERABLE");
        expect(result.stdout).toContain('"state":"RECOVERABLE"');
        const calls = readFileSync(events,"utf8");
        if (layout === "owner") {
          const history = calls.trim().split(/\r?\n/);
          expect(history).toHaveLength(6);
          expect(history[0]).toMatch(/^bundle verify /);
          expect(history[1]).toMatch(/^bundle list-heads /);
          expect(history[2]).toContain("-c core.hooksPath=/dev/null fetch ");
          expect(history.slice(3)).toEqual([
            "rev-parse FETCH_HEAD", "rev-parse FETCH_HEAD^{tree}", "rev-parse FETCH_HEAD^",
          ]);
          expect(readFileSync(fetchedHead,"utf8").trim()).toBe("b".repeat(40));
        } else expect(calls).toBe("");
      }

      // Mutation probes: these must be rejected by the same behavioral oracle
      // used above. In particular, a fake jq result or detached FETCH_HEAD
      // would otherwise allow all four broken variants to pass.
      const mutations = [
        {name:"missing-fetch",
          original: String.raw`git -c core.hooksPath=/dev/null fetch --no-tags "$owner_bundle" HEAD >/dev/null`,
          broken:":"},
        {name:"missing-tree",
          original: String.raw`test "$(git rev-parse 'FETCH_HEAD^{tree}')" = "$target_tree_sha"`,
          broken:":"},
        {name:"missing-parent",
          original: String.raw`test "$(git rev-parse 'FETCH_HEAD^')" = "$BASE_SHA"`,
          broken:":"},
        {name:"released-state",original:'.state=$state | .recovery={kind:"artifact",digest:$digest,expires_at:$expires}',
          broken:'.state="RELEASED" | .recovery={kind:"artifact",digest:$digest,expires_at:$expires}'},
      ];
      for (const mutation of mutations) {
        expect(actualShell).toContain(mutation.original);
        const changed = actualShell.replace(mutation.original, mutation.broken);
        const events = join(work, mutation.name + "-git-calls");
        const fetchedHead = join(work, mutation.name + "-fetched-head");
        writeFileSync(events, "");
        const result = spawnSync("bash", ["-c", mock + "\n" + changed +
          '\nprintf "LAYOUT=%s LABEL=%s PAYLOAD=%s\\n" "$archive_layout" "$label" "$payload"'], {
          encoding:"utf8",timeout:15000,
          env:{...process.env, EVENTS:bashPath(events), FETCHED_HEAD:bashPath(fetchedHead),
            ZIP_NAMES:ownerEntries.join("\n"), BUNDLE_SHA:digest(bundle), RUNNER_TEMP:bashPath(work),
            archive:"fixture.zip", recovery_artifact:bashPath(join(work, mutation.name + "-recovery.json")),
            recovery_digest:digest(recovery), REPOSITORY:"ibboabdoli-ai/Proffera",
            BRANCH:"work/proffera-test",TASK_ID:"SUP-TEST",BASE_SHA:"a".repeat(40),
            head_sha:"b".repeat(40),target_tree_sha:"c".repeat(40),RUN_ID:"51",
            packet:"{}",helper:"mock-helper",payload:"{}",reserved_paths:"[]"},
        });
        const history = readFileSync(events,"utf8").trim().split(/\r?\n/);
        const safe = result.status === 0 &&
          result.stdout.includes("LAYOUT=owner LABEL=RECOVERABLE") &&
          result.stdout.includes('"state":"RECOVERABLE"') &&
          history.length === 6 &&
          history[0].startsWith("bundle verify ") &&
          history[1].startsWith("bundle list-heads ") &&
          history[2].startsWith("-c core.hooksPath=/dev/null fetch ") &&
          JSON.stringify(history.slice(3)) === JSON.stringify([
            "rev-parse FETCH_HEAD","rev-parse FETCH_HEAD^{tree}","rev-parse FETCH_HEAD^",
          ]);
        expect(safe, mutation.name + " must be rejected").toBe(false);
      }
    } finally { rmSync(work, {recursive:true,force:true}); }
  }, 30000);

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
    const ownerEntries = ["proffera-publication-artifact.json", "proffera-owner-handoff.bundle",
      "proffera-owner-handoff.bundle.sha256", "proffera-owner-handoff.json", "proffera-worker-pr-body.md"];
    const trials = [
      {names: ownerEntries, accepted: true},
      {names: [...ownerEntries].reverse(), accepted: true},
      {names: ["proffera-publication-artifact.json"], accepted: true}, // historical recovery
      {names: [...ownerEntries, "untrusted.sh"], accepted: false},
      {names: [...ownerEntries, "proffera-owner-handoff.json"], accepted: false},
      {names: [...ownerEntries.slice(0, 3), "../escape"], accepted: false},
      {names: ownerEntries.slice(0, 4), accepted: false}, // missing frozen PR body
      {names: ["proffera-publication-artifact.json", "junk"], accepted: false},
    ];
    const work = mkdtempSync(join(tmpdir(), "proffera-owner-zip-inventory-"));
    try {
      for (let i = 0; i < trials.length; i++) {
        const trial = trials[i];
        const archive = join(work, "artifact-" + i + ".zip");
        const fixture = spawnSync("python3", ["-c",
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
        "proffera-owner-handoff.bundle.sha256", "proffera-owner-handoff.json",
        "proffera-worker-pr-body.md"];
      const result = spawnSync("python3", ["-c",
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
      const prBody = "## Frozen Worker PR body\n\nOwner publication requires exact bytes.\n";
      const prBodyDigest = sha(prBody);
      writeFileSync(join(payloadDir, "proffera-publication-artifact.json"), recovery);
      writeFileSync(join(payloadDir, "proffera-worker-pr-body.md"), prBody);
      writeFileSync(join(payloadDir, "proffera-owner-handoff.bundle.sha256"),
        bundleDigest + "  proffera-owner-handoff.bundle\n");
      const valid = {
        state:"OWNER_PUSH_REQUIRED",published:false,repository:"ibboabdoli-ai/Proffera",
        branch:"work/proffera-test",task_id:"SUP-TEST",base_sha:base,parent_sha:base,
        head_sha:head,tree_sha:tree,bundle_sha256:bundleDigest,
        recovery_sha256:recoveryDigest,pr_body_sha256:prBodyDigest,run_id:51,run_attempt:1,
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
        {...valid, pr_body_sha256:"0".repeat(64)},
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
