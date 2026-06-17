#!/usr/bin/env node
"use strict";

/**
 * P22K production migration runner template.
 *
 * IMPORTANT:
 * This file is a template only.
 * It must not connect to the database.
 * It must not read DATABASE_URL.
 * It must not execute SQL.
 * It must not run migrations.
 *
 * A real runner may only be created in a later approved P22K phase.
 *
 * Required future approval phrase:
 * Execute P22K production migration.
 */

const REQUIRED_FLAG = "--execute-p22k-production-migration";
const REQUIRED_CONFIRMATION =
  "Execute P22K production migration";

const MIGRATION_FILES = [
  "db/migrations/20260616_0001_better_auth_core_schema.sql",
  "db/migrations/20260616_0002_proffera_workspace_schema.sql",
];

function printTemplateSummary() {
  console.log("P22K production migration runner template");
  console.log("");
  console.log("Status: template only");
  console.log("Database connection: disabled");
  console.log("SQL execution: disabled");
  console.log("Migration execution: disabled");
  console.log("");
  console.log("Required future flag:");
  console.log(`  ${REQUIRED_FLAG}`);
  console.log("");
  console.log("Required future confirmation value:");
  console.log(`  ${REQUIRED_CONFIRMATION}`);
  console.log("");
  console.log("Future migration order:");
  for (const file of MIGRATION_FILES) {
    console.log(`  - ${file}`);
  }
}

function exitTemplateOnly() {
  console.error("");
  console.error("Refusing to run.");
  console.error("This is a template-only file from P22J-E.");
  console.error("It must not be used to connect to the database or execute migrations.");
  console.error("");
  console.error("A real runner requires a later P22K phase and explicit approval:");
  console.error(`  ${REQUIRED_CONFIRMATION}`);
  process.exit(1);
}

printTemplateSummary();
exitTemplateOnly();
