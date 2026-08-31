#!/usr/bin/env node

import { readFileSync } from "node:fs";

function normalizePath(value) {
  return value.trim().replaceAll("\\\\", "/").replace(/^\.\//, "");
}

function readPaths() {
  const input = readFileSync(0, "utf8");
  return [...new Set(input.split(/\r?\n/).map(normalizePath).filter(Boolean))];
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => pattern.test(path));
}

const files = readPaths();
const reasons = new Set();
let reviewRisk = "low";
let humanMergeRequired = false;
let dbTestsRequired = false;
let productionImpact = false;

const controlPlanePatterns = [
  /^\.github\//,
  /^AGENTS\.md$/,
  /^WORKER_BOOTSTRAP\.md$/,
  /^scripts\/ci\/classify-pr-risk\.mjs$/,
  /^scripts\/ci\/review-gate\.sh$/,
];

const packageOrDeployPatterns = [
  /^\.env(?:\.|$)/,
  /^vercel\.json$/,
  /^next\.config\.[^/]+$/,
  /^(?:src\/)?proxy\.[^/]+$/,
  /^middleware\.[^/]+$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
];

const databasePatterns = [
  /^db\//,
  /^migrations\//,
  /^supabase\//,
  /^prisma\//,
  /(^|\/)(?:database|postgres|neon)(?:\/|[._-])/i,
];

const authTenantPatterns = [
  /(^|\/)(?:auth|rbac|permission|permissions|tenant)(?:\/|[._-])/i,
  /^src\/lib\/workspace(?:\/|[._-])/i,
  /(^|\/)tenant-isolation(?:\/|[._-])/i,
];

const financialPatterns = [
  /(^|\/)(?:billing|payment|payments|stripe|checkout|webhook|webhooks)(?:\/|[._-])/i,
];

const privacyPatterns = [
  /^src\/app\/privacy(?:\/|$)/,
  /(^|\/)(?:privacy|pii)(?:\/|[._-])/i,
];

const mediumReviewPatterns = [
  /^src\/app\/api\//,
  /company[-_]directory/i,
  /(^|\/)(?:marketplace|matching|search)(?:\/|[._-])/i,
  /^scripts\/company-directory-discovery\.py$/,
];

const dbBehaviorPatterns = [
  ...databasePatterns,
  /(^|\/)(?:transaction|locking|lock|race|idempotency|unique|uniqueness)(?:\/|[._-])/i,
  /(^|\/)(?:tenant|workspace)(?:\/|[._-])/i,
];

const productionPatterns = [
  /^src\/app\/api\//,
  /^src\/app\/(?:\(public\)\/)?/,
  /company[-_]directory/i,
  /(^|\/)(?:marketplace|search)(?:\/|[._-])/i,
  /^\.github\/workflows\//,
  /^vercel\.json$/,
  /^next\.config\.[^/]+$/,
];

for (const file of files) {
  const controlPlane = matchesAny(file, controlPlanePatterns);
  const packageOrDeploy = matchesAny(file, packageOrDeployPatterns);
  const database = matchesAny(file, databasePatterns);
  const authTenant = matchesAny(file, authTenantPatterns);
  const financial = matchesAny(file, financialPatterns);
  const privacy = matchesAny(file, privacyPatterns);

  if (controlPlane) {
    reviewRisk = "high";
    humanMergeRequired = true;
    reasons.add(`control-plane:${file}`);
  }

  if (packageOrDeploy) {
    reviewRisk = "high";
    humanMergeRequired = true;
    reasons.add(`package-or-deploy:${file}`);
  }

  if (database) {
    reviewRisk = "high";
    humanMergeRequired = true;
    dbTestsRequired = true;
    reasons.add(`database:${file}`);
  }

  if (authTenant) {
    reviewRisk = "high";
    humanMergeRequired = true;
    dbTestsRequired = true;
    reasons.add(`auth-or-tenant:${file}`);
  }

  if (financial) {
    reviewRisk = "high";
    humanMergeRequired = true;
    reasons.add(`financial:${file}`);
  }

  if (privacy) {
    reviewRisk = "high";
    humanMergeRequired = true;
    reasons.add(`privacy:${file}`);
  }

  if (file.startsWith("src/app/api/")) {
    humanMergeRequired = true;
  }

  if (reviewRisk !== "high" && matchesAny(file, mediumReviewPatterns)) {
    reviewRisk = "medium";
    reasons.add(`review-sensitive:${file}`);
  }

  if (matchesAny(file, dbBehaviorPatterns)) {
    dbTestsRequired = true;
  }

  if (matchesAny(file, productionPatterns)) {
    productionImpact = true;
  }
}

if (files.length >= 12 && reviewRisk === "low") {
  reviewRisk = "medium";
  reasons.add(`large-change:${files.length}-files`);
}

const result = {
  schemaVersion: 1,
  fileCount: files.length,
  reviewRisk,
  aiReviewRequired: reviewRisk !== "low",
  humanMergeRequired,
  dbTestsRequired,
  productionImpact,
  reasons: [...reasons].sort(),
};

process.stdout.write(`${JSON.stringify(result)}\n`);
