#!/usr/bin/env bash
set -euo pipefail
cp .github/pr946-review/PR946-v5-reviewed.patch.xz.b64 /tmp/pr946-v5.patch.xz.b64
cp .github/pr946-review/PR946-15-Independent-Connections-v5.patch /tmp/pr946-15.patch
git checkout --detach 482e6be7f3cfdd644a1db2414129e40f1ba52e5a
test "$(git rev-parse HEAD)" = "482e6be7f3cfdd644a1db2414129e40f1ba52e5a"
base64 --decode /tmp/pr946-v5.patch.xz.b64 | xz --decompress --stdout > /tmp/pr946-v5.patch
echo "e588038cb1d4490cc86daf24ff69e27c74549ba62daa1f016a15315c125de4ff  /tmp/pr946-v5.patch" | sha256sum --check
echo "5ecca44ef8027c243f9abe2824fc54867725a761034a4a4ed1f299b767fb976b  /tmp/pr946-15.patch" | sha256sum --check
git apply --check /tmp/pr946-v5.patch
git apply /tmp/pr946-v5.patch
if [[ "${PR946_ONLY_PRIMARY_CANDIDATE:-false}" != "true" ]]; then
  git apply --check /tmp/pr946-15.patch
  git apply /tmp/pr946-15.patch
fi
git diff --check
printf 'Candidate SHA256: e588038cb1d4490cc86daf24ff69e27c74549ba62daa1f016a15315c125de4ff\n'
