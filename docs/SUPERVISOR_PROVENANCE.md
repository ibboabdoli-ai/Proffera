# Supervisor signed pre-publication provenance — staged contract

Status: **Verifier code staged locally. NOT provisioned. NOT SAFE TO PUSH.**

## Trust boundary

Builder-controlled files, test logs, and textual Codex reports cannot authenticate independent execution or independent review. The canonical preflight must continue to reject caller-authored, unsigned JSON. An independent, protected controller must issue separately signed receipts for the actual validation execution and the separate Red Team security review of the exact frozen candidate.

The Builder must not hold either signing key. The independent reviewer cannot share a principal or key with the validator. The verifier in a writable worktree is not itself a trusted enforcement runtime; the eventual controller must run trusted code outside the Builder's writable branch and independently enforce the decision before exposing push credentials.

## Trust authority

The issuer public-key manifest must be separately reviewed and installed onto protected main, at the exact candidate base SHA:

.github/supervisor/provenance-issuers.json

The reader contacts api.github.com via TLS and checks the blob digest against the GitHub contents response for this immutable SHA. It accepts neither a local file nor a configured alternative GitHub host. No private key may be committed.

Required manifest structure (public keys are illustrative placeholders, not credentials):

~~~json
{
  "kind": "proffera-supervisor-trust",
  "version": 1,
  "repository": "ibboabdoli-ai/Proffera",
  "issuers": [
    {
      "issuer_id": "protected-ci-validation",
      "principal": "protected-ci-runner",
      "role": "validation-runner",
      "public_key_spki_pem": "<independently provisioned SPKI PUBLIC key>"
    },
    {
      "issuer_id": "independent-redteam",
      "principal": "independent-security-reviewer",
      "role": "independent-reviewer",
      "public_key_spki_pem": "<DIFFERENT independently provisioned SPKI PUBLIC key>"
    }
  ]
}
~~~

## Receipt format

Validation and review evidence each require a separately signed JSON envelope:

~~~json
{
  "kind": "proffera-signed-provenance",
  "version": 1,
  "role": "validation-runner",
  "issuer_id": "protected-ci-validation",
  "issued_at": "2026-10-08T19:00:00.000Z",
  "expires_at": "2026-10-08T20:00:00.000Z",
  "payload": {"...": "canonical supervisor-validation-evidence schema"},
  "signature": "<canonical Ed25519 base64url signature>"
}
~~~

The separate reviewer receipt uses role independent-reviewer and the canonical supervisor-review-evidence schema. The signing input is UTF-8 of the literal domain prefix proffera.supervisor.provenance.v1 followed by one LF and JSON.stringify of the seven-field unsigned envelope. The signature field is excluded from the signed bytes.

Both signed payloads must match the frozen repository, branch, base SHA, HEAD SHA, tree SHA and exact PR-body SHA-256. Receipts expire, have a maximum 24-hour lifetime, and may not be reused for different candidates. Authenticated validation still must cover all selected checks; only unit and e2e may be hosted-required under the existing actual-attempt rule. Authenticated review must include independent reviewer identity, all mandatory focuses and no unresolved verified findings.

The canonical verify command takes these signed envelopes through its existing --validation and --review flags. A successful signed prepublication receipt is not an authorization to push, merge, deploy, or skip final hosted CI/review. Before publication, the trusted controller and owner must still revalidate live graph/state and apply separate authorization.

## Unresolved bootstrap prerequisites

The current main baseline does NOT contain this trust manifest. No production issuer keys or independent controller are installed. Therefore signed verification cannot pass yet; unsigned JSON still fails with evidence_provenance_unverified. CI Autofix publication remains blocked in a credential-free step.

Before enabling: get explicit owner approval to provision the two separated issuers, secure their private keys outside Builder access, install the public manifest on protected main, deploy a separately reviewed trusted controller, test signatures and real validation/review execution end-to-end, and only then consider removing the CI Autofix blocker. Re-freeze the candidate if main changes. Never use fixture keys or a self-authored report as trusted evidence.
