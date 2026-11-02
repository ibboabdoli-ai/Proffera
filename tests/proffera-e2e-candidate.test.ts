
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";

const configPath = resolve("e2e/playwright.config.mjs");
function run(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{status:number|null; output:string}>((resolveResult,reject)=>{
    const child=spawn(process.execPath,args,{env,windowsHide:true});
    let output="";
    child.stdout.on("data",data=>{output+=data;});
    child.stderr.on("data",data=>{output+=data;});
    child.on("error",reject);
    child.on("close",status=>resolveResult({status,output}));
  });
}
function environment(url:string) {
  return {...process.env,PROFFERA_EXACT_CANDIDATE_E2E:"1",E2E_BASE_URL:url,
    E2E_ALLOW_REMOTE:"true",PROFFERA_PREVIEW_E2E_OIDC_TOKEN:"",E2E_MARKETPLACE_PREVIEW_LIFECYCLE:"false"};
}
describe("exact candidate Playwright boundary",()=>{
  it.each(["https://unrelated.vercel.app","http://user:password@127.0.0.1:3000","http://127.0.0.1:3000/stale"])(
    "rejects target %s even with remote opt-in",async url=>{
      const result=await run(["--input-type=module","-e",`await import(${JSON.stringify(pathToFileURL(configPath).href)})`],environment(url));
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("Exact-candidate E2E requires a plain local origin.");
    });
  it("starts a fresh build from the checkout and forbids reuse",async()=>{
    const result=await run(["--input-type=module","-e",`const {default:c}=await import(${JSON.stringify(pathToFileURL(configPath).href)}); console.log(JSON.stringify(c.webServer))`],environment("http://127.0.0.1:3000"));
    expect(result.status,result.output).toBe(0);
    const config=JSON.parse(result.output);
    expect(config.reuseExistingServer).toBe(false);
    expect(config.cwd).toBe(resolve("."));
    expect(config.command).toBe("npm run build && npm run start -- --hostname 127.0.0.1 --port 3000");
  });
  it.each(["unrelated development server","stale candidate server"])("rejects an occupied port: %s",async label=>{
    const server=createServer((_req,res)=>res.end(label));
    await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
    const address=server.address();
    if(!address||typeof address==="string")throw Error("missing port");
    const root=mkdtempSync(join(tmpdir(),"pr941-e2e-binding-"));
    try {
      const config=join(root,"playwright.config.mjs");
      writeFileSync(config,`import original from ${JSON.stringify(pathToFileURL(configPath).href)};export default {...original,testDir:${JSON.stringify(root)},reporter:"line"};`);
      const testModule=pathToFileURL(resolve("e2e/node_modules/@playwright/test/index.mjs")).href;
      writeFileSync(join(root,"binding.e2e.mjs"),`import {test} from ${JSON.stringify(testModule)};test("must never run",()=>{throw new Error("STALE_SERVER_ACCEPTED")});`);
      const result=await run([resolve("e2e/node_modules/playwright/cli.js"),"test","--config",config],environment(`http://127.0.0.1:${address.port}`));
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("already used");
      expect(result.output).not.toContain("STALE_SERVER_ACCEPTED");
    } finally {await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));rmSync(root,{recursive:true,force:true});}
  });
});
