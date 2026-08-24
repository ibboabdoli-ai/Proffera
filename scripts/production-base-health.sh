#!/usr/bin/env bash
set -euo pipefail

: "${REPOSITORY:?REPOSITORY is required}"
: "${BASE_SHA:?BASE_SHA is required}"
HEALTH_WORKFLOW="${HEALTH_WORKFLOW:-production-health.yml}"
MAX_ATTEMPTS="${BASE_HEALTH_ATTEMPTS:-24}"
SLEEP_SECONDS="${BASE_HEALTH_SLEEP_SECONDS:-15}"

# Bootstrap exception: the PR that introduces Production health has a base
# where the health workflow does not yet exist. Every later base must have
# an exact-SHA successful Production health run.
if ! gh api "repos/$REPOSITORY/contents/.github/workflows/$HEALTH_WORKFLOW?ref=$BASE_SHA" >/dev/null 2>&1; then
  echo "Production health is not yet active on base $BASE_SHA; allowing bootstrap PR only."
  exit 0
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  runs="$(gh api "repos/$REPOSITORY/actions/workflows/$HEALTH_WORKFLOW/runs?branch=main&event=push&head_sha=$BASE_SHA&per_page=100")"
  conclusion="$(jq -r '.workflow_runs | sort_by(.created_at) | last | .conclusion // ""' <<< "$runs")"
  status="$(jq -r '.workflow_runs | sort_by(.created_at) | last | .status // ""' <<< "$runs")"

  echo "Base health attempt $attempt/$MAX_ATTEMPTS: base=$BASE_SHA status=${status:-missing} conclusion=${conclusion:-missing}"

  if [ "$status" = "completed" ] && [ "$conclusion" = "success" ]; then
    echo "Production is healthy on exact PR base $BASE_SHA."
    exit 0
  fi

  if [ "$status" = "completed" ] && [ -n "$conclusion" ] && [ "$conclusion" != "success" ]; then
    echo "::error::Production health is red on exact PR base $BASE_SHA ($conclusion). New work is blocked."
    exit 1
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    sleep "$SLEEP_SECONDS"
  fi
done

echo "::error::No successful Production health result became available for exact PR base $BASE_SHA."
exit 1
