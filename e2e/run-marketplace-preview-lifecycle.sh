#!/usr/bin/env bash
set -euo pipefail

readonly oidc_audience="proffera-marketplace-preview-e2e"
readonly max_playwright_attempts=2

if [ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] || [ -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]; then
  echo "GitHub Actions OIDC request context is unavailable." >&2
  exit 1
fi

for playwright_attempt in $(seq 1 "${max_playwright_attempts}"); do
  if ! oidc_token="$(curl --fail --silent --show-error \
    -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${oidc_audience}" \
    | jq -er '.value | strings | select(length > 0)')"; then
    if [ "${playwright_attempt}" -ge "${max_playwright_attempts}" ]; then
      echo "Unable to mint a fresh Marketplace Preview OIDC credential." >&2
      exit 1
    fi
    echo "OIDC minting failed for Marketplace Preview attempt ${playwright_attempt}; retrying." >&2
    continue
  fi

  if PROFFERA_PREVIEW_E2E_OIDC_TOKEN="${oidc_token}" \
    npx playwright test tests/marketplace-preview-lifecycle.e2e.mjs \
      --project=chromium --reporter=line --retries=0; then
    unset oidc_token
    exit 0
  fi

  unset oidc_token
  if [ "${playwright_attempt}" -ge "${max_playwright_attempts}" ]; then
    exit 1
  fi
  echo "Marketplace Preview browser attempt ${playwright_attempt} failed; retrying with a fresh OIDC credential." >&2
done
