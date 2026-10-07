import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PLANNER_HUMAN_AUTH_OWNERSHIP } from "./supervisor-worker-handoff.mjs";

const PATH_RE = /^[A-Za-z0-9._/-]+$/;

function assertPlainString(value, field, maxLength) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long`);
  if (/[\u0000-\u001F\u007F]/u.test(trimmed)) throw new Error(`${field} contains control characters`);
  return trimmed;
}

function assertSafePath(value, field) {
  const path = assertPlainString(value, field, 240);
  if (!PATH_RE.test(path)) throw new Error(`${field} contains unsupported path syntax`);
  if (path.startsWith("/") || path.includes("//") || path.endsWith("/")) {
    throw new Error(`${field} is not a repository file`);
  }
  if (path.split("/").some((part) => part === "." || part === ".." || part === "")) {
    throw new Error(`${field} contains path traversal or an empty segment`);
  }
  return path;
}

function normalizeRepositoryPaths(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  if (value.length === 0) throw new Error(`${field} must not be empty`);
  if (value.length > 500) throw new Error(`${field} has too many entries`);
  const normalized = value.map((item) => assertSafePath(item, `${field}[]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} contains duplicates`);
  return normalized;
}

function pullRequestFilePaths(value) {
  if (!Array.isArray(value)) throw new Error("pull_request_files must be an array");
  if (value.length === 0) throw new Error("pull_request_files must not be empty");
  if (value.length > 3000) throw new Error("pull_request_files has too many entries");
  const paths = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("pull_request_files contains a malformed entry");
    }
    paths.push(assertSafePath(item.filename, "pull_request_files[].filename"));
    if (item.previous_filename !== undefined && item.previous_filename !== null) {
      paths.push(assertSafePath(item.previous_filename, "pull_request_files[].previous_filename"));
    }
  }
  return [...new Set(paths)];
}

function policyFileMatch(path, policyScope) {
  const kind = policyScope?.kind;
  const value = policyScope?.value;
  if (kind !== "scope" && kind !== "prefix") {
    throw new Error("Planner ownership policy has an unsupported scope kind");
  }
  if (typeof value !== "string" || !value || value.startsWith("/") || value.includes("//")) {
    throw new Error("Planner ownership policy contains a malformed scope");
  }
  if (kind === "prefix") return path.startsWith(value);
  if (value.endsWith("/")) return path.startsWith(value);
  return path === value;
}

export function evaluateProtectedRepositoryPaths(pathsInput) {
  try {
    const paths = normalizeRepositoryPaths(pathsInput, "changed_paths");
    const matches = [];
    for (const ownership of PLANNER_HUMAN_AUTH_OWNERSHIP) {
      if (!ownership || typeof ownership !== "object" || Array.isArray(ownership)
        || typeof ownership.owner !== "string" || !ownership.owner
        || !Array.isArray(ownership.scopes) || ownership.scopes.length === 0) {
        throw new Error("Planner ownership policy is malformed");
      }
      for (const policyScope of ownership.scopes) {
        for (const path of paths) {
          if (!policyFileMatch(path, policyScope)) continue;
          matches.push({
            owner: ownership.owner,
            path,
            policy_scope: policyScope.value,
            match_kind: policyScope.kind,
          });
        }
      }
    }
    const uniqueMatches = [...new Map(matches.map((match) => [
      [match.owner, match.path, match.policy_scope, match.match_kind].join("\n"),
      match,
    ])).values()];
    return {
      ok: true,
      allowed: uniqueMatches.length === 0,
      code: uniqueMatches.length === 0 ? "repository_paths_authorized" : "repository_paths_require_human",
      reason: uniqueMatches.length === 0
        ? "changed files do not intersect a human-authorization ownership boundary"
        : "changed files intersect a repository ownership boundary that requires explicit human authorization",
      matches: uniqueMatches,
    };
  } catch (error) {
    return {
      ok: false,
      allowed: false,
      code: "repository_path_policy_invalid",
      reason: error instanceof Error ? error.message : "Repository path authorization evaluation failed",
      matches: [],
    };
  }
}

export function evaluateProtectedPullRequestFiles(filesInput) {
  try {
    const paths = pullRequestFilePaths(filesInput);
    return {...evaluateProtectedRepositoryPaths(paths), paths};
  } catch (error) {
    return {
      ok: false,
      allowed: false,
      code: "repository_path_policy_invalid",
      reason: error instanceof Error ? error.message : "Pull request file authorization evaluation failed",
      matches: [],
      paths: [],
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2];
    const input = JSON.parse(readFileSync(0, "utf8"));
    const decision = mode === "evaluate-paths"
      ? evaluateProtectedRepositoryPaths(input?.paths)
      : mode === "evaluate-pull-files"
        ? evaluateProtectedPullRequestFiles(input?.files)
        : (() => { throw new Error("authorization_policy:mode"); })();
    process.stdout.write(JSON.stringify(decision) + "\n");
    if (!decision.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
