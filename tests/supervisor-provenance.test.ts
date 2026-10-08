import {createHash, generateKeyPairSync, sign} from "node:crypto";
import type {KeyObject} from "node:crypto";
import {describe, expect, it} from "vitest";
// @ts-expect-error plain ESM repository script
import {authenticateProvenance, readIssuerManifest, signingBytes} from "../scripts/supervisor-provenance.mjs";

const now = Date.parse("2026-10-08T20:00:00.000Z");
const candidate = {
  repository:"ibboabdoli-ai/Proffera",
  branch:"work/proffera-b4-repair-safety",
  base_sha:"a".repeat(40),
  head_sha:"b".repeat(40),
  tree_sha:"c".repeat(40),
  pr_body_sha256:"d".repeat(64),
};
function fixture() {
  const validator = generateKeyPairSync("ed25519");
  const reviewer = generateKeyPairSync("ed25519");
  const manifest = {
    kind:"proffera-supervisor-trust", version:1, repository:candidate.repository,
    issuers:[
      {issuer_id:"protected-runner",principal:"protected-ci-runner",role:"validation-runner",
        public_key_spki_pem:validator.publicKey.export({type:"spki",format:"pem"})},
      {issuer_id:"external-review",principal:"independent-security-reviewer",role:"independent-reviewer",
        public_key_spki_pem:reviewer.publicKey.export({type:"spki",format:"pem"})}
    ]
  };
  const validation = {
    kind:"supervisor-validation-evidence", version:1, candidate,
    results:[{id:"targeted",status:"passed",command:"node22 vitest"}]
  };
  const review = {
    kind:"supervisor-review-evidence",version:1,candidate,
    reviewer:"independent-security-reviewer",outcome:"pass",
    focuses:["adversarial","security"],findings:[],review_digest:"f".repeat(64)
  };
  function receipt<T>(role:string, issuer_id:string, payload:T, privateKey:KeyObject) {
    const unsigned = {
      kind:"proffera-signed-provenance",version:1,role,issuer_id,
      issued_at:"2026-10-08T19:00:00.000Z",expires_at:"2026-10-08T21:00:00.000Z",
      payload
    };
    return {...unsigned,signature:sign(null,signingBytes(unsigned),privateKey).toString("base64url")};
  }
  const validationReceipt = receipt("validation-runner","protected-runner",validation,validator.privateKey);
  const reviewReceipt = receipt("independent-reviewer","external-review",review,reviewer.privateKey);
  return {manifest,validationReceipt,reviewReceipt,validator,reviewer,receipt};
}
function proof(overrides:Record<string,unknown>={}) {
  const f=fixture();
  return {...f,...overrides};
}
function verify(f:ReturnType<typeof fixture>) {
  return authenticateProvenance({manifest:f.manifest,validationReceipt:f.validationReceipt,
    reviewReceipt:f.reviewReceipt,candidate,now});
}
describe("authenticated pre-publication evidence trust boundary",()=>{
  it("accepts only two distinct protected signer keys bound to the exact frozen candidate",()=>{
    const f=fixture();
    expect(verify(f)).toMatchObject({
      authenticated:true, validation_issuer:"protected-runner",review_issuer:"external-review",
      trust_root:"protected-main",
      review:{reviewer:"independent-security-reviewer"}
    });
  });
  it("rejects payload alterations after signing",()=>{
    const f=fixture();
    f.validationReceipt.payload.results[0].status="failed";
    expect(()=>verify(f)).toThrow(/signature is not authentic/);
  });
  it("rejects a forged reviewer name even with a valid signature from a trusted reviewer",()=>{
    const f=fixture();
    f.reviewReceipt=f.receipt("independent-reviewer","external-review",
      {...f.reviewReceipt.payload,reviewer:"builder"},f.reviewer.privateKey);
    expect(()=>verify(f)).toThrow(/not expected issuer/);
  });
  it("rejects a local candidate HEAD or PR-body change without a fresh signed receipt",()=>{
    const f=fixture();
    expect(()=>authenticateProvenance({...f,candidate:{...candidate,head_sha:"e".repeat(40)},now}))
      .toThrow(/stale or mismatched head_sha/);
    expect(()=>authenticateProvenance({...f,candidate:{...candidate,pr_body_sha256:"e".repeat(64)},now}))
      .toThrow(/stale or mismatched pr_body_sha256/);
  });
  it("rejects an expired, stale, future-dated or tampered timestamp",()=>{
    const f=fixture();
    expect(()=>authenticateProvenance({...f,candidate,now:now+4*3_600_000}))
      .toThrow(/expired|timestamps/);
    f.reviewReceipt.expires_at="2027-10-08T00:00:00.000Z";
    expect(()=>verify(f)).toThrow(/timestamps/);
  });
  it("does not trust two roles sharing one private or public key",()=>{
    const f=fixture();
    f.manifest.issuers[1].public_key_spki_pem=f.manifest.issuers[0].public_key_spki_pem;
    expect(()=>verify(f)).toThrow(/share a key/);
  });
  it("rejects duplicate principals, unexpected roles, or caller-supplied keys",()=>{
    const f=fixture();
    f.manifest.issuers[1].principal="protected-ci-runner";
    expect(()=>verify(f)).toThrow(/invalid or duplicate/);
    f.manifest.issuers[1].principal="independent-security-reviewer";
    f.manifest.issuers[1].role="validation-runner";
    expect(()=>verify(f)).toThrow(/invalid or duplicate/);
    f.manifest.issuers[1].role="independent-reviewer";
    f.manifest.issuers.push({...f.manifest.issuers[1],issuer_id:"attacker"});
    expect(()=>verify(f)).toThrow(/trust manifest/);
  });
  it("requires canonical Ed25519 bytes and the authorized signer identity",()=>{
    const f=fixture();
    f.reviewReceipt.signature="wrong";
    expect(()=>verify(f)).toThrow(/noncanonical/);
    f.reviewReceipt=f.receipt("independent-reviewer","wrong-id",f.reviewReceipt.payload,
      f.reviewer.privateKey);
    expect(()=>verify(f)).toThrow(/not from authorized issuer/);
  });
  it("rejects complete but unsigned claimant objects",()=>{
    const f=fixture();
    const {signature,...unsigned}=f.reviewReceipt;
    expect(()=>authenticateProvenance({...f,candidate,now,reviewReceipt:unsigned}))
      .toThrow(/invalid fields/);
  });
  it("reads the exact GitHub.com baseline manifest and checks its blob digest",async ()=>{
    const f=fixture();
    const bytes=Buffer.from(JSON.stringify(f.manifest));
    const sha=createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0"))
      .update(bytes).digest("hex");
    const entry={type:"file",encoding:"base64",sha,content:bytes.toString("base64")+"\n"};
    let wasCalled=false;
    const reader=async (endpoint:string)=>{
      wasCalled=true;
      expect(endpoint).toBe("/repos/ibboabdoli-ai/Proffera/contents/.github/supervisor/provenance-issuers.json?ref="+candidate.base_sha);
      return JSON.stringify(entry);
    };
    await expect(readIssuerManifest({repository:candidate.repository,baseSha:candidate.base_sha,reader}))
      .resolves.toEqual(f.manifest);
    expect(wasCalled).toBe(true);
    await expect(readIssuerManifest({repository:candidate.repository,baseSha:candidate.base_sha,
      reader:async ()=>JSON.stringify({...entry,sha:"0".repeat(40)})}))
      .rejects.toThrow(/blob mismatch/);
  });
  it("fails closed without a provisioned protected-main issuer manifest",async ()=>{
    await expect(readIssuerManifest({repository:candidate.repository,baseSha:candidate.base_sha,
      reader:async ()=>{throw new Error("HTTP 404");}}))
      .rejects.toThrow(/not provisioned/);
    await expect(readIssuerManifest({repository:"attacker/Proffera",baseSha:candidate.base_sha}))
      .rejects.toThrow(/immutable baseline required/);
  });
});
