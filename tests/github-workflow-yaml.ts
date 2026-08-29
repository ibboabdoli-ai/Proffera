import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as {
  load: (source: string) => unknown;
};

type YamlRecord = Record<string, unknown>;

function isRecord(value: unknown): value is YamlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a GitHub Actions workflow and return its top-level trigger mapping. */
export function workflowTriggers(source: string) {
  const parsed = parseYaml(source);
  if (!isRecord(parsed) || !isRecord(parsed.on)) {
    throw new Error("GitHub workflow must define an 'on' trigger mapping");
  }
  return parsed.on;
}

/** Return the active cron expressions declared under the workflow's top-level on.schedule. */
export function workflowCronExpressions(source: string) {
  const schedule = workflowTriggers(source).schedule;
  if (schedule === undefined) return [];
  if (!Array.isArray(schedule)) {
    throw new Error("GitHub workflow on.schedule must be an array");
  }

  return schedule.map((entry) => {
    if (!isRecord(entry) || typeof entry.cron !== "string") {
      throw new Error("GitHub workflow schedule entries must contain a cron string");
    }
    return entry.cron;
  });
}
