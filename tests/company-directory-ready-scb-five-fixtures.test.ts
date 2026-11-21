import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  confidence: vi.fn(),
  scb: vi.fn(),
  transport: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.confidence,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.scb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.transport,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidate,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "@/lib/company-directory-ready-scb-enrichment";
import { publishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";

const ids = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
const workplace = (city: string, municipality = city) => ({
  municipality, visitingAddress: { addressLine:"QA Testgatan 1", postalCode:"111 11", city },
});

const cases = [
  { name:"pilot-valid", city:"Stockholm", conflict:0, blocked:false, match:true, publish:true },
  { name:"outside-pilot", city:"Uppsala", conflict:0, blocked:false, match:true, publish:false },
  { name:"scb-conflict", city:"Stockholm", conflict:1, blocked:false, match:true, publish:false },
  { name:"legal-block", city:"Stockholm", conflict:0, blocked:true, match:true, publish:false },
  { name:"scb-missing", city:"Stockholm", conflict:0, blocked:false, match:false, publish:false },
] as const;

const initial = (i: number, refreshed: boolean) => ({
  id: ids[i], public_slug: `qa946-${cases[i].name}`,
  publication_status:"ready", legal_name:"QA946 El AB",display_name:"QA946 El AB",
  category_slug:"elektriker",primary_sni_code:"43.210",activity_description:"Elinstallationer",
  address_line1:"QA Registrerad 1",postal_code:"111 11",city:"Stockholm",municipality:"Stockholm",
  registered_names:[{name:"QA946 El AB",typeCode:"FORETAGSNAMN"}],
  sni_codes:[{code:"43.210",label:"Elinstallationer"}],
  profile_updated_token:"2026-10-17 00:00:00+00",
  facts_last_synced_token:"2026-10-17 00:00:01+00",
  facts_source_payload_hash:"qa-facts",
  official_facts_fresh:true,is_active:true,privacy_blocked:false,auto_public_eligible:true,
  claimed_workspace_id:null,advertising_blocked:cases[i].blocked,
  deregistration_date:null,ongoing_procedures:[],
  scb_workplaces:refreshed && cases[i].match?[workplace(cases[i].city)]:[],
  scb_source_payload_hash:refreshed && cases[i].match?"qa-scb":null,
  scb_conflict_count:refreshed && cases[i].match?cases[i].conflict:1,
  scb_snapshot_fresh:refreshed && cases[i].match,
});

beforeEach(() => {
  for(const fn of Object.values(mocks))fn.mockReset();
  vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED","true");
  vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH","true");
  mocks.transport.mockReturnValue({fetchCompany:vi.fn(),fetchWorkplaces:vi.fn()});
  mocks.confidence.mockReturnValue({score:100,officialFactsReady:true});
});
afterEach(()=>vi.unstubAllEnvs());

describe("five synthetic Ready→SCB→publication decision simulations (no live SCB)", () => {
  it.each(cases.map((fixture,i)=>[i,fixture.name,fixture.publish] as const))(
    "fixture %i: %s ends publish=%s",
    async(i,_name,shouldPublish)=>{
      let refreshed=false;
      const sql=vi.fn(async(strings:TemplateStringsArray)=>{
        const query=strings.join("?");
        if(query.includes("select profile.id::text,") && query.includes("scb.profile_id is null")){
          return [{id:ids[i],category_slug:"elektriker",primary_sni_code:"43.210",
            legal_name:"QA946 El AB",display_name:"QA946 El AB",activity_description:"Elinstallationer",
            registered_names:[],sni_codes:[{code:"43.210"}]}];
        }
        if(query.includes("update company_directory_profiles p")){
          return shouldPublish&&refreshed?[{public_slug:`qa946-${cases[i].name}`}]:[];
        }
        if(query.includes("select") && query.includes("p.public_slug")) return [initial(i,refreshed)];
        throw new Error("Unexpected synthetic SQL path: "+query.slice(0,120));
      });
      mocks.getSql.mockReturnValue(sql);
      mocks.scb.mockImplementation(async()=>{
        if(!cases[i].match)throw new Error("simulated SCB company-not-found");
        refreshed=true;
        return {status:"saved",saved:true,conflicts:cases[i].conflict?[{field:"name"}]:[]};
      });
      const evidence=await enrichReadyCompanyDirectoryScbBatch({limit:1});
      expect(evidence.attempted).toBe(1);
      expect(evidence.saved).toBe(cases[i].match?1:0);
      expect(evidence.errors).toBe(cases[i].match?0:1);
      // Guard evaluation is real publication logic, SCB transport & SQL are mocked.
      // Never allow the publication mock to claim an update for unsafe fixtures.
      const decision=await publishCompanyDirectoryProfileIfSafe(ids[i]);
      expect(decision.ok).toBe(shouldPublish);
      if(shouldPublish){
        expect(decision.code).toBe("published");
        expect(sql.mock.calls.some(call=>call[0].join("?").includes("update company_directory_profiles p"))).toBe(true);
      }else{
        expect(decision.code).not.toBe("published");
      }
      expect(mocks.transport).toHaveBeenCalledTimes(1);
    },
  );
});
