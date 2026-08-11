module.exports=[666680,(a,b,c)=>{b.exports=a.x("node:crypto",()=>require("node:crypto"))},295946,a=>{"use strict";var b=a.i(546767);let c=(0,a.i(612147).resolveDatabaseUrl)();a.s(["getSql",0,function(){return c?(0,b.neon)(c):null}])},137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},310317,a=>{"use strict";var b=a.i(666680),c=a.i(295946);async function d(a){let d=function(a=process.env){let b=a.PUBLIC_FORM_RATE_LIMIT_SECRET?.trim();return b||(a.VERCEL_ENV||"production"===a.NODE_ENV?null:"proffera-public-form-rate-limit-v1")}(),e=(0,c.getSql)();if(!d||!e||a.maxAttempts<1||a.windowSeconds<1)return!1;try{let c=await e`
      insert into public_submission_rate_limits (
        scope,
        fingerprint,
        window_started_at,
        attempts,
        created_at,
        updated_at
      )
      values (
        ${a.scope},
        ${function({scope:a,requestHeaders:c,identity:d=""},e){let f=d.trim().toLowerCase();return(0,b.createHash)("sha256").update(`${e}:${a}:${c.get("x-forwarded-for")?.split(",")[0]?.trim()||c.get("x-real-ip")?.trim()||"unknown"}:${f}`).digest("hex")}(a,d)},
        now(),
        1,
        now(),
        now()
      )
      on conflict (scope, fingerprint)
      do update set
        attempts = case
          when public_submission_rate_limits.window_started_at <= now() - (${a.windowSeconds} * interval '1 second') then 1
          else public_submission_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public_submission_rate_limits.window_started_at <= now() - (${a.windowSeconds} * interval '1 second') then now()
          else public_submission_rate_limits.window_started_at
        end,
        updated_at = now()
      returning attempts
    `;return Number(c[0]?.attempts??a.maxAttempts+1)<=a.maxAttempts}catch(a){return console.error("Failed to apply public form rate limit",a),!1}}a.s(["allowPublicSubmission",0,d],310317)},368023,a=>{"use strict";var b=a.i(137936),c=a.i(295946);async function d(a){let b,d,e=(0,c.getSql)();if(!e)return{ok:!1,message:"Databasen är inte konfigurerad ännu. Lägg till DATABASE_URL i Vercel och kör databasmigrationen."};let f=(b=Date.now().toString(36).toUpperCase(),d=Math.random().toString(36).slice(2,7).toUpperCase(),`PRO-${b}-${d}`);try{let b=await e`
      select reference_id
      from quote_requests
      where created_at >= now() - interval '15 minutes'
        and (
          lower(contact_email) = lower(${a.contactEmail})
          or contact_phone = ${a.contactPhone}
        )
      order by created_at desc
      limit 1
    `,c=String(b[0]?.reference_id??"").trim();if(c)return{ok:!0,referenceId:c};await e`
      insert into quote_requests (
        category,
        service_type,
        city,
        postal_code,
        description,
        preferred_date,
        contact_name,
        contact_email,
        contact_phone,
        consent_accepted,
        status,
        reference_id
      ) values (
        ${a.category},
        ${a.serviceType},
        ${a.city},
        ${a.postalCode},
        ${a.description},
        ${a.preferredDate},
        ${a.contactName},
        ${a.contactEmail},
        ${a.contactPhone},
        ${a.consentAccepted},
        'submitted',
        ${f}
      )
    `}catch{return{ok:!1,message:"Förfrågan kunde inte sparas just nu. Kontrollera DATABASE_URL och att migrationen har körts."}}return{ok:!0,referenceId:f}}var e=a.i(53112);let f={Hemstädning:["Engångsstädning","Återkommande städning","Storstädning"],Flyttstädning:["Lägenhet","Villa","Kontor"],Kontorsstädning:["Litet kontor","Medelstort kontor","Större lokal"],Fönsterputs:["Lägenhet","Villa","Lokal"],Byggstädning:["Efter renovering","Efter nyproduktion","Grovstädning"],Trädgård:["Gräsklippning","Häckklippning","Trädgårdsskötsel"],Flytthjälp:["Bärhjälp","Flytt med transport","Packhjälp"],Renovering:["Målning","Golv","Mindre renovering"]};function g(a){return Object.hasOwn(f,a)}let h=e.z.object({category:e.z.string().trim().refine(g,"Välj en kategori."),serviceType:e.z.string().trim().min(1,"Välj tjänstetyp.").max(120,"Tjänstetypen är för lång."),city:e.z.string().trim().min(2,"Ange stad.").max(120,"Orten är för lång."),postalCode:e.z.string().trim().min(3,"Ange postnummer.").max(16,"Postnumret är för långt.").regex(/^[0-9\s-]+$/,"Postnummer får bara innehålla siffror, mellanslag eller bindestreck."),description:e.z.string().trim().min(20,"Beskriv uppdraget med minst 20 tecken.").max(2e3,"Beskrivningen är för lång."),preferredDate:e.z.string().trim().min(1,"Välj ungefärlig tidpunkt.").max(80,"Tidpunkten är för lång."),contactName:e.z.string().trim().min(2,"Ange namn.").max(120,"Namnet är för långt."),contactEmail:e.z.string().trim().email("Ange en giltig e-postadress.").max(180,"E-postadressen är för lång."),contactPhone:e.z.string().trim().min(6,"Ange telefonnummer.").max(40,"Telefonnumret är för långt.").regex(/^[0-9+\s-]+$/,"Telefonnummer får bara innehålla siffror, +, mellanslag eller bindestreck."),consentAccepted:e.z.boolean().refine(a=>a,"Du måste godkänna att Proffera behandlar uppgifterna för att hantera förfrågan.")}).superRefine((a,b)=>{let c=g(a.category)?f[a.category]:null;c&&!c.includes(a.serviceType)&&b.addIssue({code:e.z.ZodIssueCode.custom,path:["serviceType"],message:"Välj en tjänstetyp som hör till kategorin."})});var i=a.i(905246),j=a.i(310317);async function k(a){let b=Date.now()-Number(a.formStartedAt);if(a.website||!Number.isFinite(b)||b<2500||b>864e5)return{ok:!1,errors:{form:"Förfrågan kunde inte skickas. Försök igen om en stund."}};let c=h.safeParse(a);if(!c.success){let a={};for(let b of c.error.issues){let c=b.path[0];"string"!=typeof c||c in a||(a[c]=b.message)}return{ok:!1,errors:a}}if(!await (0,j.allowPublicSubmission)({scope:"quote_request",requestHeaders:await (0,i.headers)(),identity:`${c.data.contactEmail}:${c.data.contactPhone}`,maxAttempts:3,windowSeconds:900}))return{ok:!1,errors:{form:"För många försök. Vänta en stund och försök igen."}};let e=await d(c.data);return e.ok?{ok:!0,referenceId:e.referenceId}:{ok:!1,errors:{form:e.message}}}(0,a.i(713095).ensureServerEntryExports)([k]),(0,b.registerServerReference)(k,"4019e35a5605129e5d5e75cae9e607c47ff5a0f3e9",null),a.s([],557341),a.i(557341),a.s(["4019e35a5605129e5d5e75cae9e607c47ff5a0f3e9",0,k],368023)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0j-7um.._.js.map