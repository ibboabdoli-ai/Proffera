import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const POLICY_VERSION = 1;
const FULL_LANES = [
  "governance",
  "whitespace",
  "lint",
  "typecheck",
  "unit",
  "build",
  "e2e",
  "discovery-worker",
];

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function hasSensitivePath(file) {
  const exactOrPrefix = [
    ".github/",
    "db/",
    "migrations/",
    "src/app/api/",
    "src/app/privacy/",
    "src/app/admin/foretag/directory/",
  ];

  if (exactOrPrefix.some((prefix) => file.startsWith(prefix))) return true;

  if (
    [
      "AGENTS.md",
      "WORKER_BOOTSTRAP.md",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "vercel.json",
      "tsconfig.json",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "scripts/company-directory-discovery.py",
    ].includes(file)
  ) {
    return true;
  }

  if (/^(next\.config\.|middleware\.|src\/proxy\.)/.test(file)) return true;
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) return true;
  if (/(^|\/)privacy\//.test(file)) return true;
  if (/(^|[\/._-])(auth|authentication|authorization|authorisation|rbac|permissions?|tenant|workspace|billing|payments?|stripe|checkout|webhooks?|db|database|postgres|neon|admin)([\/._-]|$)/i.test(file)) return true;
  if (/(^|[\/._-])(privacy|integritet(?:spolicy)?|personuppgift(?:er)?|directory)([\/._-]|$)/i.test(file)) return true;
  if (/company[-_]directory/i.test(file)) return true;
  if (/(^|\/)\.env(?:\.|$)/.test(file)) return true;
  if (/^tests\/(tooling-safety-contract|proffera-standing-automerge)\.test\.ts$/.test(file)) return true;

  return false;
}

function isDocumentation(file) {
  if (file === "README.md") return true;
  return file.startsWith("docs/") || file.endsWith(".md");
}

function isUnitTest(file) {
  return file.startsWith("tests/") && !file.startsWith("tests/e2e/");
}

function isE2e(file) {
  return file.startsWith("e2e/") || file.startsWith("tests/e2e/");
}

function isPublicSurface(file) {
  return (
    file.startsWith("src/app/") ||
    file.startsWith("src/components/") ||
    file.startsWith("public/") ||
    file.startsWith("src/styles/")
  );
}

function isSource(file) {
  return file.startsWith("src/");
}

export function classifyCiScope(inputFiles) {
  const files = uniqueSorted(
    inputFiles
      .map((file) => file.trim().replace(/^\.\//, ""))
      .filter(Boolean),
  );

  if (files.length === 0) {
    return {
      policyVersion: POLICY_VERSION,
      mode: "shadow",
      classification: "conservative-full",
      reductionCandidate: false,
      fullCiStillRequired: true,
      proposedLanes: FULL_LANES,
      reasons: ["No changed files were supplied; fail conservatively to the full lane set."],
      files,
    };
  }

  const sensitive = files.filter(hasSensitivePath);
  if (sensitive.length > 0) {
    return {
      policyVersion: POLICY_VERSION,
      mode: "shadow",
      classification: "restricted-full",
      reductionCandidate: false,
      fullCiStillRequired: true,
      proposedLanes: FULL_LANES,
      reasons: sensitive.map((file) => `Sensitive/control-plane path requires full CI: ${file}`),
      files,
    };
  }

  if (files.every(isDocumentation)) {
    return {
      policyVersion: POLICY_VERSION,
      mode: "shadow",
      classification: "low-docs",
      reductionCandidate: true,
      fullCiStillRequired: true,
      proposedLanes: ["governance", "whitespace"],
      reasons: ["Documentation-only change; shadow plan would avoid runtime/build lanes."],
      files,
    };
  }

  const known = files.every(
    (file) => isDocumentation(file) || isUnitTest(file) || isE2e(file) || isPublicSurface(file) || isSource(file),
  );

  if (!known) {
    const unknown = files.filter(
      (file) => !(isDocumentation(file) || isUnitTest(file) || isE2e(file) || isPublicSurface(file) || isSource(file)),
    );
    return {
      policyVersion: POLICY_VERSION,
      mode: "shadow",
      classification: "conservative-full",
      reductionCandidate: false,
      fullCiStillRequired: true,
      proposedLanes: FULL_LANES,
      reasons: unknown.map((file) => `Unmapped path defaults to full CI: ${file}`),
      files,
    };
  }

  const lanes = new Set(["governance", "whitespace"]);
  const reasons = [];

  if (files.some((file) => isUnitTest(file))) {
    lanes.add("lint");
    lanes.add("typecheck");
    lanes.add("unit");
    reasons.push("Unit-test graph changed; include static analysis and unit tests.");
  }

  if (files.some((file) => isE2e(file))) {
    lanes.add("lint");
    lanes.add("typecheck");
    lanes.add("e2e");
    reasons.push("Browser-test graph changed; include static analysis and browser smoke.");
  }

  if (files.some((file) => isPublicSurface(file))) {
    lanes.add("lint");
    lanes.add("typecheck");
    lanes.add("unit");
    lanes.add("build");
    lanes.add("e2e");
    reasons.push("Public/app surface changed; include static, unit, build, and browser lanes.");
  } else if (files.some((file) => isSource(file))) {
    lanes.add("lint");
    lanes.add("typecheck");
    lanes.add("unit");
    lanes.add("build");
    lanes.add("e2e");
    reasons.push("Non-public source graph changed; include static, unit, build, and browser lanes.");
  }

  if (files.some((file) => isDocumentation(file)) && reasons.length === 0) {
    reasons.push("Documentation is mixed with mapped low-risk paths; retain the union of affected lanes.");
  }

  return {
    policyVersion: POLICY_VERSION,
    mode: "shadow",
    classification: "low-mapped",
    reductionCandidate: true,
    fullCiStillRequired: true,
    proposedLanes: [...lanes],
    reasons: reasons.length > 0 ? reasons : ["Mapped low-risk change; shadow plan uses only affected lanes."],
    files,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const plan = classifyCiScope(input.split(/\r?\n/));
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}
