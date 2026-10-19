#!/usr/bin/env bash
set -euo pipefail
cp .github/pr946-review/PR946-v5-reviewed.patch.gz.b64 /tmp/pr946-v5.patch.gz.b64
cp .github/pr946-review/PR946-15-Independent-Connections-v5.patch /tmp/pr946-15.patch
git checkout --detach 482e6be7f3cfdd644a1db2414129e40f1ba52e5a
test "$(git rev-parse HEAD)" = "482e6be7f3cfdd644a1db2414129e40f1ba52e5a"
base64 --decode /tmp/pr946-v5.patch.gz.b64 | gzip --decompress --stdout > /tmp/pr946-v5.patch
echo "fdbf559e7321f16990015cc2a9f360382ea45bc84b5cf86f15eb1adfca0a47ba  /tmp/pr946-v5.patch" | sha256sum --check
echo "b8fd694fa05d21b9542a9b5de29386fb81fad2e320a788cb859e733eb9f0551f  /tmp/pr946-15.patch" | sha256sum --check
git apply --check /tmp/pr946-v5.patch
git apply /tmp/pr946-v5.patch
if [[ "${PR946_ONLY_PRIMARY_CANDIDATE:-false}" != "true" ]]; then
  git apply --check /tmp/pr946-15.patch
  git apply /tmp/pr946-15.patch
fi
git diff --check
printf 'Candidate SHA256: fdbf559e7321f16990015cc2a9f360382ea45bc84b5cf86f15eb1adfca0a47ba\n'
