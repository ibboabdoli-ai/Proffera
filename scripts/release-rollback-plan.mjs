const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DATABASE_CHANGE_VALUES = new Set(["none", "additive", "destructive", "unknown"]);

export function validateRollbackPlan(input) {
  const errors = [];
  const currentSha = String(input?.currentSha ?? "").trim().toLowerCase();
  const targetSha = String(input?.targetSha ?? "").trim().toLowerCase();
  const targetDeploymentUrl = String(input?.targetDeploymentUrl ?? "").trim();
  const databaseChange = String(input?.databaseChange ?? "unknown").trim().toLowerCase();

  if (!SHA_PATTERN.test(currentSha)) errors.push("currentSha must be a 40-character commit SHA");
  if (!SHA_PATTERN.test(targetSha)) errors.push("targetSha must be a 40-character commit SHA");
  if (currentSha && targetSha && currentSha === targetSha) errors.push("targetSha must differ from currentSha");
  if (!DATABASE_CHANGE_VALUES.has(databaseChange)) errors.push("databaseChange must be none, additive, destructive, or unknown");

  let deploymentHost = "";
  try {
    const parsed = new URL(targetDeploymentUrl);
    deploymentHost = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") errors.push("targetDeploymentUrl must use https");
    if (!deploymentHost.endsWith(".vercel.app")) errors.push("targetDeploymentUrl must be an exact vercel.app deployment URL");
    if (parsed.search || parsed.hash) errors.push("targetDeploymentUrl must not contain query or fragment data");
  } catch {
    errors.push("targetDeploymentUrl must be a valid URL");
  }

  const requiresSeparateDatabaseApproval = databaseChange === "destructive" || databaseChange === "unknown";
  if (requiresSeparateDatabaseApproval) {
    errors.push("database impact blocks the standard application rollback path");
  }

  return {
    ok: errors.length === 0,
    mode: "dry-run",
    currentSha,
    targetSha,
    targetDeploymentUrl,
    deploymentHost,
    databaseChange,
    requiresOwnerApproval: true,
    requiresSeparateDatabaseApproval,
    automaticMutation: false,
    databaseRollback: false,
    healthVerification: "exact-sha-required",
    errors,
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(process.argv[2] ?? "");
  } catch {
    console.error(JSON.stringify({ ok: false, mode: "dry-run", errors: ["Pass one JSON rollback plan argument."] }));
    process.exitCode = 1;
    return;
  }

  const result = validateRollbackPlan(input);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
