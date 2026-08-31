#!/usr/bin/env bash
set -euo pipefail

: "${REPOSITORY:?REPOSITORY is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"

MODE="${REVIEW_GATE_MODE:-wait}"
MAX_ATTEMPTS="${REVIEW_GATE_MAX_ATTEMPTS:-40}"
FALLBACK_ATTEMPT="${REVIEW_GATE_FALLBACK_ATTEMPT:-20}"
SLEEP_SECONDS="${REVIEW_GATE_SLEEP_SECONDS:-15}"

if ! [[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Refused: invalid PR number '$PR_NUMBER'." >&2
  exit 1
fi
if ! [[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Refused: invalid head SHA '$HEAD_SHA'." >&2
  exit 1
fi

codex_marker="<!-- proffera-codex-final-review-request:${HEAD_SHA} -->"
coderabbit_marker="<!-- proffera-coderabbit-fallback-review-request:${HEAD_SHA} -->"

comments_json='[]'
reviews_json='[]'
inline_json='[]'
CODEX_REQUEST_ID=""
CODEX_REQUEST_TIME=""
CODERABBIT_REQUEST_TIME=""
EVAL_STATUS="pending"
EVAL_REASON="no accepted current-head review yet"
CODEX_UNAVAILABLE="false"
CODERABBIT_UNAVAILABLE="false"
HEAD_COMMIT_TIME=""

refresh_head() {
  local current_head
  current_head="$(gh api "repos/${REPOSITORY}/pulls/${PR_NUMBER}" --jq '.head.sha')"
  if [ "$current_head" != "$HEAD_SHA" ]; then
    echo "Refused: review evidence is stale; gate head is $HEAD_SHA but current PR head is $current_head." >&2
    exit 1
  fi
  if [ -z "$HEAD_COMMIT_TIME" ]; then
    HEAD_COMMIT_TIME="$(gh api "repos/${REPOSITORY}/commits/${HEAD_SHA}" --jq '.commit.committer.date // .commit.author.date')"
  fi
}

refresh_evidence() {
  comments_json="$(gh api --paginate "repos/${REPOSITORY}/issues/${PR_NUMBER}/comments?per_page=100" --jq '.[]' | jq -s '.')"
  reviews_json="$(gh api --paginate "repos/${REPOSITORY}/pulls/${PR_NUMBER}/reviews?per_page=100" --jq '.[]' | jq -s '.')"
  inline_json="$(gh api --paginate "repos/${REPOSITORY}/pulls/${PR_NUMBER}/comments?per_page=100" --jq '.[]' | jq -s '.')"

  CODEX_REQUEST_ID="$(jq -r --arg marker "$codex_marker" '[.[] | select(.user.login == "github-actions[bot]" and ((.body // "") | contains($marker)))] | sort_by(.created_at) | last | .id // empty' <<< "$comments_json")"
  CODEX_REQUEST_TIME="$(jq -r --arg marker "$codex_marker" '[.[] | select(.user.login == "github-actions[bot]" and ((.body // "") | contains($marker)))] | sort_by(.created_at) | last | .created_at // empty' <<< "$comments_json")"
  CODERABBIT_REQUEST_TIME="$(jq -r --arg marker "$coderabbit_marker" '[.[] | select(.user.login == "github-actions[bot]" and ((.body // "") | contains($marker)))] | sort_by(.created_at) | last | .created_at // empty' <<< "$comments_json")"
}

request_codex() {
  refresh_evidence
  local existing_review_count pr_reactions existing_clean_reaction_count
  existing_review_count="$(jq -r --arg sha "$HEAD_SHA" '[.[] | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector")) | select(.commit_id == $sha)] | length' <<< "$reviews_json")"
  pr_reactions="$(gh api --paginate "repos/${REPOSITORY}/issues/${PR_NUMBER}/reactions?per_page=100" --jq '.[]' | jq -s '.')"
  existing_clean_reaction_count="$(jq -r --arg head_time "$HEAD_COMMIT_TIME" '[.[] | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector")) | select(.content == "+1") | select((.created_at // "") >= $head_time)] | length' <<< "$pr_reactions")"

  if [ "$existing_review_count" -gt 0 ] || [ "$existing_clean_reaction_count" -gt 0 ]; then
    echo "Current-head Codex evidence already exists; no duplicate review requested."
    return
  fi

  if [ -n "$CODEX_REQUEST_ID" ] && [ -n "$CODEX_REQUEST_TIME" ]; then
    echo "Codex exact-head review was already requested for $HEAD_SHA."
    return
  fi

  local body response
  body="$(printf '%s\n%s\n' "$codex_marker" '@codex review')"
  response="$(gh api --method POST "repos/${REPOSITORY}/issues/${PR_NUMBER}/comments" -f body="$body")"
  CODEX_REQUEST_ID="$(jq -r '.id' <<< "$response")"
  CODEX_REQUEST_TIME="$(jq -r '.created_at' <<< "$response")"
  echo "Requested Codex primary review for exact head $HEAD_SHA."
}

request_coderabbit() {
  refresh_evidence
  if [ -n "$CODERABBIT_REQUEST_TIME" ]; then
    echo "CodeRabbit fallback was already requested for exact head $HEAD_SHA."
    return
  fi

  local body
  body="$(printf '%s\n%s\n' "$coderabbit_marker" '@coderabbitai review')"
  gh api --method POST "repos/${REPOSITORY}/issues/${PR_NUMBER}/comments" -f body="$body" >/dev/null
  refresh_evidence
  echo "Requested CodeRabbit availability fallback for exact head $HEAD_SHA."
}

evaluate_once() {
  EVAL_STATUS="pending"
  EVAL_REASON="no accepted current-head review yet"
  CODEX_UNAVAILABLE="false"
  CODERABBIT_UNAVAILABLE="false"

  refresh_evidence

  local cr_reviews cr_latest_changes cr_latest_approval cr_terminal_count
  cr_reviews="$(jq -c --arg sha "$HEAD_SHA" '[.[] | select(.user.login == "coderabbitai[bot]" and .commit_id == $sha)]' <<< "$reviews_json")"
  cr_latest_changes="$(jq -r '[.[] | select(.state == "CHANGES_REQUESTED") | .submitted_at] | max // empty' <<< "$cr_reviews")"
  cr_latest_approval="$(jq -r '[.[] | select(.state == "APPROVED") | .submitted_at] | max // empty' <<< "$cr_reviews")"
  cr_terminal_count="$(jq -r '[.[] | select(.state == "APPROVED" or .state == "COMMENTED")] | length' <<< "$cr_reviews")"

  if [ -n "$cr_latest_changes" ] && { [ -z "$cr_latest_approval" ] || [[ ! "$cr_latest_approval" > "$cr_latest_changes" ]]; }; then
    EVAL_STATUS="blocked"
    EVAL_REASON="CodeRabbit has unresolved CHANGES_REQUESTED on the current head"
    return
  fi

  local codex_inline_count=0 codex_approval_count=0 codex_clean_count=0 codex_pr_clean_count=0
  codex_inline_count="$(jq -r --arg sha "$HEAD_SHA" '[.[] | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector")) | select(.commit_id == $sha)] | length' <<< "$inline_json")"

  if [ "$codex_inline_count" -gt 0 ]; then
    EVAL_STATUS="blocked"
    EVAL_REASON="Codex posted current-head review findings; a new head and new review are required"
    return
  fi

  codex_approval_count="$(jq -r --arg sha "$HEAD_SHA" '[.[] | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector")) | select(.commit_id == $sha) | select(.state == "APPROVED")] | length' <<< "$reviews_json")"

  local pr_reactions_json
  pr_reactions_json="$(gh api --paginate "repos/${REPOSITORY}/issues/${PR_NUMBER}/reactions?per_page=100" --jq '.[]' | jq -s '.')"
  codex_pr_clean_count="$(jq -r --arg head_time "$HEAD_COMMIT_TIME" '[.[] | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector")) | select(.content == "+1") | select((.created_at // "") >= $head_time)] | length' <<< "$pr_reactions_json")"

  if [ -n "$CODEX_REQUEST_TIME" ]; then
    local codex_unavailable_count
    codex_unavailable_count="$(jq -r --arg request_time "$CODEX_REQUEST_TIME" '
      [
        .[]
        | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector"))
        | select((.updated_at // .created_at // "") >= $request_time)
        | select((.body // "") | test("create an environment|rate limit|quota|temporarily unavailable|service unavailable|unable to|could not|failed"; "i"))
      ] | length
    ' <<< "$comments_json")"
    if [ "$codex_unavailable_count" -gt 0 ]; then
      CODEX_UNAVAILABLE="true"
    fi

    if [ -n "$CODEX_REQUEST_ID" ]; then
      local reactions_json
      reactions_json="$(gh api --paginate "repos/${REPOSITORY}/issues/comments/${CODEX_REQUEST_ID}/reactions?per_page=100" --jq '.[]' | jq -s '.')"
      codex_clean_count="$(jq -r --arg request_time "$CODEX_REQUEST_TIME" '
        [
          .[]
          | select((.user.login == "chatgpt-codex-connector[bot]" or .user.login == "chatgpt-codex-connector"))
          | select(.content == "+1")
          | select((.created_at // "") >= $request_time)
        ] | length
      ' <<< "$reactions_json")"
    fi
  fi

  local cr_clean_summary_count=0
  cr_clean_summary_count="$(jq -r --arg sha "$HEAD_SHA" '
    [
      .[]
      | select(.user.login == "coderabbitai[bot]")
      | select((.body // "") | test("<!-- recent_review_start -->[\\s\\S]*No actionable comments were generated in the recent review\\.[\\s\\S]*" + $sha + "[\\s\\S]*<!-- recent_review_end -->"))
    ] | length
  ' <<< "$comments_json")"

  if [ -n "$CODERABBIT_REQUEST_TIME" ]; then
    local cr_unavailable_count
    cr_unavailable_count="$(jq -r --arg request_time "$CODERABBIT_REQUEST_TIME" '
      [
        .[]
        | select(.user.login == "coderabbitai[bot]")
        | select((.updated_at // .created_at // "") >= $request_time)
        | select((.body // "") | test("Review limit reached|Review rate limited|Action not completed: Review rate limited|Review skipped|temporarily unavailable|service unavailable"; "i"))
      ] | length
    ' <<< "$comments_json")"
    if [ "$cr_unavailable_count" -gt 0 ]; then
      CODERABBIT_UNAVAILABLE="true"
    fi
  fi

  if [ "$codex_clean_count" -gt 0 ] || [ "$codex_pr_clean_count" -gt 0 ] || [ "$codex_approval_count" -gt 0 ]; then
    EVAL_STATUS="accepted"
    EVAL_REASON="Codex completed a clean exact-head review"
    return
  fi

  if [ -n "$cr_latest_changes" ] && [ -n "$cr_latest_approval" ] && [[ "$cr_latest_approval" > "$cr_latest_changes" ]]; then
    EVAL_STATUS="accepted"
    EVAL_REASON="CodeRabbit approved the exact head after its latest change request"
    return
  fi

  if [ "$cr_terminal_count" -gt 0 ] || [ "$cr_clean_summary_count" -gt 0 ]; then
    EVAL_STATUS="accepted"
    EVAL_REASON="CodeRabbit completed a non-blocking exact-head review"
    return
  fi
}

refresh_head

case "$MODE" in
  route)
    request_codex
    ;;
  check)
    evaluate_once
    echo "$EVAL_REASON"
    if [ "$EVAL_STATUS" != "accepted" ]; then
      exit 1
    fi
    ;;
  wait)
    request_codex
    for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
      refresh_head
      evaluate_once
      echo "AI review gate attempt ${attempt}/${MAX_ATTEMPTS}: ${EVAL_REASON}."

      if [ "$EVAL_STATUS" = "accepted" ]; then
        exit 0
      fi
      if [ "$EVAL_STATUS" = "blocked" ]; then
        exit 1
      fi

      if [ "$CODEX_UNAVAILABLE" = "true" ] || [ "$attempt" -ge "$FALLBACK_ATTEMPT" ]; then
        request_coderabbit
      fi

      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        sleep "$SLEEP_SECONDS"
      fi
    done

    echo "Refused: no acceptable exact-head AI review was recorded within the bounded gate window. Codex primary and CodeRabbit fallback both failed to produce acceptable evidence." >&2
    exit 1
    ;;
  *)
    echo "Refused: unknown REVIEW_GATE_MODE '$MODE'." >&2
    exit 1
    ;;
esac
