import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workerPath = resolve(process.cwd(), "scripts/company-directory-discovery.py");
const resolverProbe = `
import importlib.util
import sys

spec = importlib.util.spec_from_file_location("company_directory_discovery", sys.argv[1])
if spec is None or spec.loader is None:
    raise RuntimeError("resolver import failed")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(module.resolve_bulk_url(sys.argv[2]))
`;

function resolveBulkUrl(override: string) {
  const result = spawnSync("python3", ["-c", resolverProbe, workerPath, override], {
    encoding: "utf8",
  });

  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  return result.stdout.trim();
}

describe("company directory discovery source resolution", () => {
  it("uses and trims an explicit official SCB bulk override at runtime", () => {
    const expected = "https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip";

    expect(resolveBulkUrl(`  ${expected}  `)).toBe(expected);
  });
});
