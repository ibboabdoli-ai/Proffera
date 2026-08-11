module.exports=[918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},120635,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,r)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,r)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,r)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),r()}catch(e){r(e)}},!0),442315,(e,t,r)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,r)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},819481,(e,t,r)=>{"use strict";var n=Object.defineProperty,a=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,o=Object.prototype.hasOwnProperty,s={},l={RequestCookies:()=>f,ResponseCookies:()=>h,parseCookie:()=>d,parseSetCookie:()=>u,stringifyCookie:()=>c};for(var p in l)n(s,p,{get:l[p],enumerable:!0});function c(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function d(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,a]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=a?a:"true"))}catch{}}return t}function u(e){if(!e)return;let[[t,r],...n]=d(e),{domain:a,expires:i,httponly:o,maxage:s,path:l,samesite:p,secure:c,partitioned:u,priority:f}=Object.fromEntries(n.map(([e,t])=>[e.toLowerCase().replace(/-/g,""),t]));{var h,_,y={name:t,value:decodeURIComponent(r),domain:a,...i&&{expires:new Date(i)},...o&&{httpOnly:!0},..."string"==typeof s&&{maxAge:Number(s)},path:l,...p&&{sameSite:m.includes(h=(h=p).toLowerCase())?h:void 0},...c&&{secure:!0},...f&&{priority:g.includes(_=(_=f).toLowerCase())?_:void 0},...u&&{partitioned:!0}};let e={};for(let t in y)y[t]&&(e[t]=y[t]);return e}}t.exports=((e,t,r)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let s of i(t))o.call(e,s)||void 0===s||n(e,s,{get:()=>t[s],enumerable:!(r=a(t,s))||r.enumerable});return e})(n({},"__esModule",{value:!0}),s);var m=["strict","lax","none"],g=["low","medium","high"],f=class{constructor(e){this._parsed=new Map,this._headers=e;const t=e.get("cookie");if(t)for(const[e,r]of d(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>c(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>c(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},h=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;const a=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(const e of Array.isArray(a)?a:function(e){if(!e)return[];var t,r,n,a,i,o=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,i=!1;l();)if(","===(r=e.charAt(s))){for(n=s,s+=1,l(),a=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(i=!0,s=a,o.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!i||s>=e.length)&&o.push(e.substring(t,e.length))}return o}(a)){const t=u(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,a=this._parsed;return a.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=c(r);t.append("set-cookie",e)}}(a,this._headers),this}delete(...e){let[t,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0]];return this.set({...r,name:t,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(c).join("; ")}}},263124,e=>{"use strict";let t=["DATABASE_URL","POSTGRES_URL","POSTGRES_PRISMA_URL","POSTGRES_URL_NON_POOLING","DATABASE_URL_UNPOOLED"];e.s(["resolveDatabaseUrl",0,function(e=process.env){if("preview"===e.VERCEL_ENV)return e.PROFFERA_PREVIEW_DATABASE_URL?.trim()||null;for(let r of t){let t=e[r]?.trim();if(t)return t}return null}])},276269,e=>{"use strict";var t=e.i(598323);let r=(0,e.i(263124).resolveDatabaseUrl)();e.s(["getSql",0,function(){return r?(0,t.neon)(r):null}])},887435,e=>{"use strict";let t=["BETTER_AUTH_SECRET","AUTH_SECRET"];function r(e=process.env){if("preview"===e.VERCEL_ENV)return e.PROFFERA_PREVIEW_AUTH_SECRET?.trim()||null;for(let r of t){let t=e[r]?.trim();if(t)return t}return null}e.s(["resolveAuthSecret",0,r,"resolveCustomerPortalSecret",0,function(e=process.env){return"preview"===e.VERCEL_ENV?r(e):e.CUSTOMER_PORTAL_SECRET?.trim()||r(e)}])},135114,e=>{"use strict";e.s(["DialectAdapterBase",0,class{get supportsCreateIfNotExists(){return!0}get supportsMultipleConnections(){return!0}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!1}get supportsOutput(){return!1}}])},96727,e=>{"use strict";var t=e.i(738950);let r=/"/g,n=/[\\'"]/g;class a extends t.DefaultQueryCompiler{visitOrAction(e){this.append("or "),this.append(e.action)}getCurrentParameterPlaceholder(){return"?"}getLeftExplainOptionsWrapper(){return""}getRightExplainOptionsWrapper(){return""}getLeftIdentifierWrapper(){return'"'}getRightIdentifierWrapper(){return'"'}getAutoIncrement(){return"autoincrement"}sanitizeIdentifier(e){return e.replace(r,'""')}sanitizeJSONPathMemberValue(e){return e.replace(n,e=>"\\"===e?"\\\\":"'"===e?"''":'\\"')}visitDefaultInsertValue(e){this.append("null")}}e.s(["SqliteQueryCompiler",0,a])},985282,e=>{"use strict";var t=e.i(135114);class r extends t.DialectAdapterBase{get supportsMultipleConnections(){return!1}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!0}async acquireMigrationLock(e,t){}async releaseMigrationLock(e,t){}}e.s(["SqliteAdapter",0,r])},806527,e=>e.a(async(t,r)=>{try{var n=e.i(493458),a=e.i(79832),i=t([a]);async function o(){return(0,a.getAuth)().api.getSession({headers:await (0,n.headers)()})}[a]=i.then?(await i)():i,e.s(["getServerSession",0,o]),r()}catch(e){r(e)}},!1),814671,e=>e.a(async(t,r)=>{try{e.i(493458);var n=e.i(806527),a=e.i(276269),i=t([n]);async function o(){let e=await (0,n.getServerSession)(),t=e?.user?.id,r=(0,a.getSql)();if(!t||!r)return null;let i=(await r`
    select pa.role, u.email, u.name
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    where pa.user_id = ${t} and pa.is_active = true
    limit 1
  `)[0];return i?{userId:t,role:String(i.role),email:String(i.email??""),name:String(i.name??"")}:null}[n]=i.then?(await i)():i,e.s(["getPlatformAdmin",0,o]),r()}catch(e){r(e)}},!1),972942,e=>{"use strict";function t(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function r(e){let t=e.match(/^(.+?)\s*<([^>]+)>$/);return t?{name:t[1].trim(),email:t[2].trim()}:{name:"Proffera",email:e.trim()}}async function n(e){let n,a=process.env.BREVO_API_KEY,i=process.env.LEAD_FROM_EMAIL;if(!a)return{ok:!1,message:"BREVO_API_KEY saknas i Vercel."};if(!i)return{ok:!1,message:"LEAD_FROM_EMAIL saknas i Vercel."};let o=r(i),s=(n=`Ny f\xf6rfr\xe5gan fr\xe5n Proffera: ${e.category} i ${e.city}`,{subject:n,text:[`Hej ${e.companyName},`,"\nNi har en matchad förfrågan i Proffera.\n",`Referens: ${e.leadRef}`,`Kategori: ${e.category}`,`Tj\xe4nst: ${e.serviceType}`,`Ort: ${e.city}`,"\nBeskrivning:",e.description,"\nSvara på detta mejl om ni vill gå vidare med uppdraget.\n\nMed vänliga hälsningar\nProffera"].join("\n"),html:`
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${t(e.companyName)},</p>
      <p>Ni har en matchad f\xf6rfr\xe5gan i Proffera.</p>
      <ul>
        <li><strong>Referens:</strong> ${t(e.leadRef)}</li>
        <li><strong>Kategori:</strong> ${t(e.category)}</li>
        <li><strong>Tj\xe4nst:</strong> ${t(e.serviceType)}</li>
        <li><strong>Ort:</strong> ${t(e.city)}</li>
      </ul>
      <p><strong>Beskrivning:</strong></p>
      <p>${t(e.description).replaceAll("\n","<br />")}</p>
      <p>Svara p\xe5 detta mejl om ni vill g\xe5 vidare med uppdraget.</p>
      <p>Med v\xe4nliga h\xe4lsningar<br />Proffera</p>
    </div>
  `});try{let t=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":a,"Content-Type":"application/json"},body:JSON.stringify({sender:o,to:[{email:e.companyEmail,name:e.companyName}],subject:s.subject,textContent:s.text,htmlContent:s.html})}),r=await t.json().catch(()=>({}));if(!t.ok)return{ok:!1,message:r.message??r.code??"Kunde inte skicka mejl via Brevo."};return{ok:!0,providerId:r.messageId??null}}catch{return{ok:!1,message:"Kunde inte kontakta Brevo."}}}async function a(e){let n,a=process.env.BREVO_API_KEY,i=process.env.LEAD_FROM_EMAIL;if(!a||!i)return{ok:!1,code:"configuration",message:"Brevo är inte konfigurerat."};let o=r(i),s=(n=`Aktivera ${e.companyName} i Proffera`,{subject:n,text:[`Hej ${e.contactName},`,"",`${e.companyName} har godk\xe4nts f\xf6r Proffera.`,"Öppna länken och välj ditt lösenord för att aktivera kundportalen:",e.activationUrl,"",`L\xe4nken g\xe4ller i ${e.expiresInHours} timmar och kan bara anv\xe4ndas en g\xe5ng.`,"\nMed vänliga hälsningar\nProffera"].join("\n"),html:`
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${t(e.contactName)},</p>
      <p><strong>${t(e.companyName)}</strong> har godk\xe4nts f\xf6r Proffera.</p>
      <p>\xd6ppna l\xe4nken och v\xe4lj ditt l\xf6senord f\xf6r att aktivera kundportalen.</p>
      <p style="margin: 28px 0;">
        <a href="${t(e.activationUrl)}" style="display: inline-block; border-radius: 12px; background: #17452f; color: #ffffff; padding: 14px 22px; text-decoration: none; font-weight: 700;">Aktivera kundportalen</a>
      </p>
      <p>L\xe4nken g\xe4ller i ${e.expiresInHours} timmar och kan bara anv\xe4ndas en g\xe5ng.</p>
      <p>Med v\xe4nliga h\xe4lsningar<br />Proffera</p>
    </div>
  `});try{let t=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":a,"Content-Type":"application/json"},body:JSON.stringify({sender:o,to:[{email:e.email,name:e.contactName}],subject:s.subject,textContent:s.text,htmlContent:s.html})}),r=await t.json().catch(()=>({}));if(!t.ok)return{ok:!1,code:"provider",message:r.message??r.code??"Kunde inte skicka inbjudan."};return{ok:!0,providerId:r.messageId??null}}catch{return{ok:!1,code:"network",message:"Kunde inte kontakta Brevo."}}}async function i(e){var n,a;let i,o=process.env.BREVO_API_KEY,s=process.env.LEAD_FROM_EMAIL;if(!o||!s)return{ok:!1,message:"Brevo is not configured."};let l=r(s),p=(n=e.quote,i=`New website quote request – ${n.service}`,{subject:i,text:["New website quote request\n",`Name: ${n.name}`,`Phone: ${n.phone}`,`Email: ${n.email}`,`Postcode: ${n.postcode}`,`Service: ${n.service}`,"\nMessage:",n.message,"\nReply directly to this email to contact the customer."].join("\n"),html:`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#09183a;">
      <h1 style="margin:0 0 20px;font-size:24px;">New website quote request</h1>
      <table style="border-collapse:collapse;max-width:620px;width:100%;">
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Name</td><td style="padding:7px 0;">${t(n.name)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Phone</td><td style="padding:7px 0;"><a href="tel:${t(n.phone)}">${t(n.phone)}</a></td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Email</td><td style="padding:7px 0;"><a href="mailto:${t(n.email)}">${t(n.email)}</a></td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Postcode</td><td style="padding:7px 0;">${t(n.postcode)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Service</td><td style="padding:7px 0;">${t(n.service)}</td></tr>
      </table>
      <h2 style="margin:24px 0 8px;font-size:18px;">Message</h2>
      <p style="margin:0;white-space:pre-wrap;">${t(n.message)}</p>
      <p style="margin-top:24px;color:#475569;">Reply directly to this email to contact the customer.</p>
    </div>
  `});try{let r,n=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":o,"Content-Type":"application/json"},body:JSON.stringify({sender:l,to:[{email:e.recipient.email,name:e.recipient.name}],replyTo:{email:e.quote.email,name:e.quote.name},subject:p.subject,textContent:p.text,htmlContent:p.html})}),i=await n.json().catch(()=>({}));if(!n.ok)return{ok:!1,message:i.message??i.code??"Brevo rejected the PrimeView quote notification."};let s=(a=e.quote,r=`Hello ${a.name},

Thank you for contacting PrimeView Window Care.
We have received your request and will get back to you with a clear, no-obligation quote.

Service: ${a.service}
Postcode: ${a.postcode}

Kind regards,
PrimeView Window Care`,{subject:"We received your quote request – PrimeView Window Care",text:r,html:`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#09183a;">
      <h1 style="margin:0 0 20px;font-size:24px;">Thank you for contacting PrimeView</h1>
      <p>Hello ${t(a.name)},</p>
      <p>We have received your request and will get back to you with a clear, no-obligation quote.</p>
      <table style="border-collapse:collapse;max-width:620px;width:100%;">
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;">Service</td><td style="padding:7px 0;">${t(a.service)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;">Postcode</td><td style="padding:7px 0;">${t(a.postcode)}</td></tr>
      </table>
      <p style="margin-top:28px;">Kind regards,<br /><strong>PrimeView Window Care</strong></p>
    </div>
  `});try{let t=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":o,"Content-Type":"application/json"},body:JSON.stringify({sender:l,to:[{email:e.quote.email,name:e.quote.name}],replyTo:{email:e.recipient.email,name:e.recipient.name},subject:s.subject,textContent:s.text,htmlContent:s.html})}),r=await t.json().catch(()=>({}));if(!t.ok)return{ok:!0,confirmationSent:!1,confirmationError:r.message??r.code??"Brevo rejected the customer confirmation.",providerId:i.messageId??null};return{ok:!0,confirmationSent:!0,providerId:i.messageId??null,confirmationProviderId:r.messageId??null}}catch{return{ok:!0,confirmationSent:!1,confirmationError:"Could not contact Brevo for the customer confirmation.",providerId:i.messageId??null}}}catch{return{ok:!1,message:"Could not contact Brevo."}}}e.s(["sendLeadEmail",0,n,"sendPrimeViewQuoteEmails",0,i,"sendWorkspaceInvitationEmail",0,a])},133151,e=>{"use strict";var t=e.i(666680),r=e.i(276269);async function n(e){let n=(0,r.getSql)();if(!n)throw Error("Database is not configured");let a=e.workspaceId??(0,t.randomUUID)(),i=e.planKey??"starter",o=e.invitationId??null,s=new Date(Date.now()+12096e5).toISOString();return await n.transaction(t=>[t`
      insert into workspaces (
        id, slug, public_booking_slug, name, company_name, primary_city,
        contact_email, contact_phone, status
      ) values (
        ${a}::uuid, ${e.slug}, ${e.slug}, ${e.companyName},
        ${e.companyName}, ${e.city}, ${e.email}, ${e.phone}, 'trial'
      )
      on conflict (id) do update set
        name = excluded.name,
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,t`
      insert into workspace_memberships (id, workspace_id, user_id, role)
      values (gen_random_uuid(), ${a}::uuid, ${e.userId}, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner'
    `,t`
      insert into workspace_settings (
        workspace_id, company_name, primary_city, response_time_goal,
        default_cta, contact_email, contact_phone, billing_country_code,
        time_zone, billing_currency
      ) values (
        ${a}, ${e.companyName}, ${e.city}, 'Inom 24 timmar',
        'Boka tid', ${e.email}, ${e.phone}, 'SE', 'Europe/Stockholm', 'SEK'
      )
      on conflict (workspace_id) do update set
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,t`
      insert into workspace_plans (
        id, workspace_id, plan_key, status, current_period_start,
        current_period_end, created_at, updated_at
      )
      select gen_random_uuid(), ${a}::uuid, ${i}, 'trialing', now(),
        ${s}::timestamptz, now(), now()
      where not exists (
        select 1 from workspace_plans where workspace_id = ${a}::uuid
      )
    `,t`
      insert into workspace_experience_settings (workspace_id)
      values (${a}::uuid)
      on conflict (workspace_id) do nothing
    `,t`
      insert into workspace_onboarding (workspace_id)
      values (${a}::uuid)
      on conflict (workspace_id) do nothing
    `,t`
      insert into workspace_booking_reminder_settings (workspace_id)
      values (${a})
      on conflict (workspace_id) do nothing
    `,t`
      insert into workspace_booking_hours (workspace_id, weekday, opens_at, closes_at, is_closed)
      values
        (${a}, 0, null, null, true),
        (${a}, 1, '09:00'::time, '17:00'::time, false),
        (${a}, 2, '09:00'::time, '17:00'::time, false),
        (${a}, 3, '09:00'::time, '17:00'::time, false),
        (${a}, 4, '09:00'::time, '17:00'::time, false),
        (${a}, 5, '09:00'::time, '17:00'::time, false),
        (${a}, 6, null, null, true)
      on conflict (workspace_id, weekday) do nothing
    `,t`
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), ${a}::uuid, feature_key, true, now(), now()
      from feature_catalog
      where is_active = true
      on conflict (workspace_id, feature_key) do update set
        enabled = true,
        updated_at = now()
    `,t`
      update workspace_invitations
      set workspace_id = ${a}::uuid, updated_at = now()
      where ${o}::uuid is not null
        and id = ${o}::uuid
        and status = 'accepted'
        and workspace_id is null
    `]),{workspaceId:a,trialEndsAt:s}}e.s(["createWorkspaceSlug",0,function(e){let r=e.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,42),n=(0,t.randomBytes)(3).toString("hex");return`${r||"foretag"}-${n}`},"provisionWorkspace",0,n])},563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__05ya8.g._.js.map