# P23T - Test data setup plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23T documents the need for safe test data before dashboard login and workspace access smoke testing.

## Current finding

Production database verification showed:

- users: 0
- workspaces: 0
- memberships: 0
- roles: []

Because the database has no Better Auth users and no workspace memberships, production dashboard login and workspace access cannot be smoke tested yet.

## Required test data

- One Better Auth email/password test user.
- One active or trial workspace.
- One workspace membership connecting the test user to the workspace.
- A role from the allowed set: owner, admin, staff, or viewer.

## Safety rules

Test user creation must use Better Auth-compatible password hashing.
Do not manually insert plaintext passwords into the database.
Do not commit secrets or test passwords to the repository.
Do not remove Basic Auth during test data setup.
Do not deploy in this phase.
Do not change database schema.

## Future setup phase

A separate P23U phase should create a safe one-time setup method for test data.
That phase must be minimal, explicit, and reversible.
It must not expose public signup or weaken dashboard protection.

## Validation for this documentation phase

- git diff --check
- content checks for empty database finding and Basic Auth safety

## Conclusion

P23T records that smoke testing is blocked until safe Better Auth-compatible test data exists.
No runtime behavior is changed in this phase.
