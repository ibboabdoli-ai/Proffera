---
name: graphify
description: "Use Graphify for Proffera codebase architecture, dependency, call-path, and file-relationship questions. Prefer an existing local graph when available, and keep GitHub/Production DB/runtime logs as the source of truth for live state."
---

# Graphify for Proffera

Use Graphify as a local code-intelligence layer for architecture and dependency analysis. It is not a source of truth for production state.

## Project rules

1. Read and obey the repository `AGENTS.md` before making changes.
2. For live state, GitHub, Production DB, GitHub Actions, Vercel deploys/logs, and the production UI remain authoritative.
3. Never infer official company facts, service areas, auth state, billing state, or production health from the graph alone.
4. Never send secrets, credentials, `.env*`, tokens, or production data into the graph corpus.
5. Generated Graphify output is local tooling and must not be committed unless explicitly requested.

## Ensure Graphify is available

Use Graphify `0.9.42` for this repository integration.

```bash
if command -v graphify >/dev/null 2>&1; then
  graphify --version
elif command -v uv >/dev/null 2>&1; then
  uv tool install 'graphifyy==0.9.42'
else
  python3 -m pip install 'graphifyy==0.9.42'
fi
```

## Initial Proffera graph

For the first pass, index code only. This uses local AST extraction and does not require an LLM API key.

```bash
graphify extract . --code-only
```

## Existing graph: query first

If `graphify-out/graph.json` exists, use it before broad raw-code searching for architecture questions.

```bash
graphify query "How does Company Directory publication work?"
graphify path "Bolagsverket" "CompanyProfile"
graphify explain "CompanyProfile"
```

Rebuild only when the graph is missing/stale or the user explicitly asks for a rebuild/update.

## Good Proffera uses

- Trace Company Directory discovery → official facts → readiness → publication.
- Find callers/callees and module coupling before a patch.
- Trace SNI, Bolagsverket, auth/RBAC, quotes, booking, billing, and workspace flows.
- Identify likely regression surfaces before changing shared services.
- Use Graphify findings to guide verification in source code and live systems; do not replace verification with graph inference.
