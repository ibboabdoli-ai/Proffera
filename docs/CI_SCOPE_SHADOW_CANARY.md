# CI scope shadow canary

This temporary document exists only to exercise the merged targeted-CI shadow planner on a real post-merge pull request.

Expected shadow classification:

- mode: `shadow`
- classification: `low-docs`
- full CI remains authoritative
- proposed lanes: `governance`, `whitespace`
- no existing required CI job is skipped by the shadow workflow

The canary must not be merged as product documentation. After the shadow result is captured, close the canary PR and use the evidence when designing the separately reviewed targeted-CI activation change.
