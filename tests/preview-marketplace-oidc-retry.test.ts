import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "e2e/run-marketplace-preview-lifecycle.sh");

function executable(path: string, content: string) {
  writeFileSync(path, content, { mode: 0o755 });
}

describe("Marketplace Preview OIDC retry runner", () => {
  it("mints a fresh credential for each process-level Playwright attempt", () => {
    const dir = mkdtempSync(join(tmpdir(), "proffera-preview-oidc-retry-"));
    const curlCount = join(dir, "curl-count");
    const npxCount = join(dir, "npx-count");
    const tokenLog = join(dir, "tokens");
    const argsLog = join(dir, "args");

    executable(join(dir, "curl"), `#!/usr/bin/env bash
set -euo pipefail
count=0
[ -f "$CURL_COUNT" ] && count="$(cat "$CURL_COUNT")"
count="$((count + 1))"
printf '%s' "$count" > "$CURL_COUNT"
if [ "$count" -eq 1 ]; then token='aaa.bbb.ccc1'; else token='ddd.eee.fff2'; fi
printf '{"value":"%s"}\n' "$token"
`);
    executable(join(dir, "jq"), `#!/usr/bin/env bash
set -euo pipefail
node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(0,"utf8")).value; if(typeof value!=="string"||value.length===0) process.exit(4); process.stdout.write(value);'
`);
    executable(join(dir, "npx"), `#!/usr/bin/env bash
set -euo pipefail
count=0
[ -f "$NPX_COUNT" ] && count="$(cat "$NPX_COUNT")"
count="$((count + 1))"
printf '%s' "$count" > "$NPX_COUNT"
printf '%s\n' "\${PROFFERA_PREVIEW_E2E_OIDC_TOKEN:-}" >> "$TOKEN_LOG"
printf '%s\n' "$*" >> "$ARGS_LOG"
if [ "$count" -eq 1 ]; then exit 1; fi
exit 0
`);

    const result = spawnSync("bash", [scriptPath], {
      cwd: resolve(process.cwd(), "e2e"),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com/mock?request=1",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token-must-not-leak",
        CURL_COUNT: curlCount,
        NPX_COUNT: npxCount,
        TOKEN_LOG: tokenLog,
        ARGS_LOG: argsLog,
      },
    });

    try {
      expect(result.status).toBe(0);
      expect(readFileSync(curlCount, "utf8")).toBe("2");
      expect(readFileSync(npxCount, "utf8")).toBe("2");
      expect(readFileSync(tokenLog, "utf8").trim().split("\n")).toEqual([
        "aaa.bbb.ccc1",
        "ddd.eee.fff2",
      ]);
      const invocations = readFileSync(argsLog, "utf8").trim().split("\n");
      expect(invocations).toHaveLength(2);
      for (const invocation of invocations) {
        expect(invocation).toContain("playwright test tests/marketplace-preview-lifecycle.e2e.mjs");
        expect(invocation).toContain("--retries=0");
      }
      const output = `${result.stdout}${result.stderr}`;
      expect(output).not.toContain("aaa.bbb.ccc1");
      expect(output).not.toContain("ddd.eee.fff2");
      expect(output).not.toContain("request-token-must-not-leak");
      expect(output).toContain("retrying with a fresh OIDC credential");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the exact audience in the mint request and never exports the credential", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain('readonly oidc_audience="proffera-marketplace-preview-e2e"');
    expect(source).toContain('audience=${oidc_audience}');
    expect(source).toContain('PROFFERA_PREVIEW_E2E_OIDC_TOKEN="${oidc_token}"');
    expect(source).not.toContain('echo "${oidc_token}"');
    expect(source).not.toContain("GITHUB_ENV");
    expect(source).not.toContain("GITHUB_OUTPUT");
  });
});
