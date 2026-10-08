import {createHash, createPublicKey, verify as cryptoVerify} from "node:crypto";
import {request as httpsRequest} from "node:https";

// Two distinct external signers; NO private key may live in this worktree.
const FILE = ".github/supervisor/provenance-issuers.json";
const DOMAIN = "proffera.supervisor.provenance.v1\n";
const SHA = /^[a-f0-9]{40}$/;
const KEY_ID = /^[a-z][a-z0-9._-]{2,80}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const DAY = 86_400_000;
function deny(code, reason) {throw new Error("supervisor_provenance:" + code + ": " + reason);}
const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function fields(value, required, label) {
  if (!obj(value) || Object.keys(value).some((k) => !required.includes(k))
    || required.some((k) => !Object.hasOwn(value,k))) deny("schema",label + " has invalid fields");
}
function subjectMatches(subject,frozen) {
  fields(subject,Object.keys(frozen),"candidate");
  for (const key of Object.keys(frozen)) {
    if (subject[key] !== frozen[key]) deny("candidate","stale or mismatched " + key);
  }
}
export function signingBytes(unsigned) {
  fields(unsigned,["kind","version","role","issuer_id","issued_at","expires_at","payload"],"unsigned receipt");
  return Buffer.from(DOMAIN + JSON.stringify(unsigned),"utf8");
}
export function validateTrustManifest(manifest,repository) {
  fields(manifest,["kind","version","repository","issuers"],"trust root");
  if (manifest.kind !== "proffera-supervisor-trust" || manifest.version !== 1
    || manifest.repository !== repository || !Array.isArray(manifest.issuers)
    || manifest.issuers.length !== 2) deny("trust_root","unprovisioned or incorrect trust manifest");
  const roles = new Map(), principals = new Set(), keys = new Set();
  for (const issuer of manifest.issuers) {
    fields(issuer,["issuer_id","principal","role","public_key_spki_pem"],"trusted issuer");
    if (!KEY_ID.test(issuer.issuer_id) || !KEY_ID.test(issuer.principal)
      || !["validation-runner","independent-reviewer"].includes(issuer.role)
      || roles.has(issuer.role) || principals.has(issuer.principal)) {
      deny("trust_root","invalid or duplicate independent issuer");
    }
    let key;
    try {key = createPublicKey(issuer.public_key_spki_pem);} catch {deny("trust_root","invalid trusted key");}
    if (key.asymmetricKeyType !== "ed25519" || key.type !== "public") {
      deny("trust_root","trusted issuer requires Ed25519 public key");
    }
    const der = key.export({type:"spki",format:"der"}).toString("hex");
    if (keys.has(der)) deny("trust_root","validator and reviewer cannot share a key");
    roles.set(issuer.role,{...issuer,key});
    principals.add(issuer.principal);keys.add(der);
  }
  if (!roles.has("validation-runner") || !roles.has("independent-reviewer")) {
    deny("trust_root","both independent signer roles required");
  }
  return roles;
}
function attest(receipt,role,issuer,frozen,now) {
  fields(receipt,["kind","version","role","issuer_id","issued_at","expires_at","payload","signature"],"signed attestation");
  if (receipt.kind !== "proffera-signed-provenance" || receipt.version !== 1
    || receipt.role !== role || receipt.issuer_id !== issuer.issuer_id) {
    deny("issuer","receipt is not from authorized issuer");
  }
  const issued=Date.parse(receipt.issued_at),expires=Date.parse(receipt.expires_at);
  if (!Number.isFinite(issued) || !Number.isFinite(expires)
    || new Date(issued).toISOString() !== receipt.issued_at
    || new Date(expires).toISOString() !== receipt.expires_at
    || issued > now+300000 || expires <= now || expires <= issued
    || expires-issued > DAY || now-issued > DAY) deny("expired","attestation missing valid bounded timestamps");
  if (typeof receipt.signature !== "string" || !SIGNATURE.test(receipt.signature)) {
    deny("signature","noncanonical Ed25519 signature");
  }
  const bytes=Buffer.from(receipt.signature,"base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== receipt.signature) {
    deny("signature","noncanonical signature bytes");
  }
  const {signature,...unsigned}=receipt;
  if (!cryptoVerify(null,signingBytes(unsigned),issuer.key,bytes)) {
    deny("signature","signature is not authentic for this trusted issuer");
  }
  if (!obj(receipt.payload)) deny("schema","signed payload is not an object");
  subjectMatches(receipt.payload.candidate,frozen);
  return receipt.payload;
}
export function authenticateProvenance({manifest,validationReceipt,reviewReceipt,candidate,now=Date.now()}) {
  const roles=validateTrustManifest(manifest,candidate.repository);
  const v=roles.get("validation-runner"),r=roles.get("independent-reviewer");
  const validation=attest(validationReceipt,"validation-runner",v,candidate,now);
  const review=attest(reviewReceipt,"independent-reviewer",r,candidate,now);
  if (validation.kind !== "supervisor-validation-evidence" || validation.version !== 1
    || review.kind !== "supervisor-review-evidence" || review.version !== 1
    || review.reviewer !== r.principal) deny("issuer","signed evidence is not expected issuer's claim");
  return {validation,review,validation_issuer:v.issuer_id,review_issuer:r.issuer_id,
    authenticated:true,trust_root:"protected-main"};
}

// Public repository: go directly to api.github.com over TLS, never PATH-selected gh,
// configured GH_HOST, a candidate-supplied URL, or an HTTP redirect.
async function fetchProtectedBlob(endpoint) {
  return new Promise((resolve,reject) => {
    const req=httpsRequest({
      protocol:"https:",hostname:"api.github.com",port:443,path:endpoint,
      method:"GET",rejectUnauthorized:true,
      headers:{"User-Agent":"Proffera-supervisor-preflight",
        "Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},
      timeout:15000,
    },(response) => {
      if (response.statusCode !== 200) {
        response.resume();reject(new Error("protected issuer GitHub manifest unavailable"));return;
      }
      let output="",size=0;
      response.setEncoding("utf8");
      response.on("data",(chunk) => {
        size += Buffer.byteLength(chunk);
        if (size > 131072) {req.destroy(new Error("protected GitHub response too large"));return;}
        output += chunk;
      });
      response.on("end",()=>resolve(output));
      response.on("error",reject);
    });
    req.on("timeout",()=>req.destroy(new Error("protected GitHub timeout")));
    req.on("error",reject);
    req.end();
  });
}
export async function readIssuerManifest({repository,baseSha,reader=fetchProtectedBlob}) {
  if (repository !== "ibboabdoli-ai/Proffera" || !SHA.test(baseSha)) {
    deny("trust_root","repository and immutable baseline required");
  }
  const endpoint="/repos/"+repository+"/contents/"+FILE+"?ref="+baseSha;
  let response;
  try {response=await reader(endpoint);}
  catch {deny("trust_root_unavailable","issuer manifest is not provisioned on protected main");}
  let entry;
  try {entry=JSON.parse(response);} catch {deny("trust_root_unavailable","GitHub response invalid");}
  if (!obj(entry) || entry.type !== "file" || entry.encoding !== "base64"
    || typeof entry.content !== "string" || !SHA.test(entry.sha ?? "")) {
    deny("trust_root_unavailable","missing trusted GitHub blob metadata");
  }
  const normalized=entry.content.replace(/\s/g,"");
  const data=Buffer.from(normalized,"base64");
  if (!data.length || data.length > 65536 || data.toString("base64") !== normalized) {
    deny("trust_root_unavailable","trusted manifest has malformed encoding or excessive size");
  }
  const digest=createHash("sha1").update(Buffer.from("blob "+data.length+"\0"))
    .update(data).digest("hex");
  if (digest !== entry.sha) deny("trust_root_unavailable","issuer blob mismatch");
  try {return JSON.parse(data.toString("utf8"));}
  catch {deny("trust_root_unavailable","issuer manifest is not valid JSON");}
}
