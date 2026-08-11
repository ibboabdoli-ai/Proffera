module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,r)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,r)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,r)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),r()}catch(e){r(e)}},!0),918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},442315,(e,t,r)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,r)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},819481,(e,t,r)=>{"use strict";var a=Object.defineProperty,n=Object.getOwnPropertyDescriptor,s=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,o={},l={RequestCookies:()=>m,ResponseCookies:()=>w,parseCookie:()=>p,parseSetCookie:()=>u,stringifyCookie:()=>d};for(var c in l)a(o,c,{get:l[c],enumerable:!0});function d(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),a=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?a:`${a}; ${r.join("; ")}`}function p(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[a,n]=[r.slice(0,e),r.slice(e+1)];try{t.set(a,decodeURIComponent(null!=n?n:"true"))}catch{}}return t}function u(e){if(!e)return;let[[t,r],...a]=p(e),{domain:n,expires:s,httponly:i,maxage:o,path:l,samesite:c,secure:d,partitioned:u,priority:m}=Object.fromEntries(a.map(([e,t])=>[e.toLowerCase().replace(/-/g,""),t]));{var w,h,g={name:t,value:decodeURIComponent(r),domain:n,...s&&{expires:new Date(s)},...i&&{httpOnly:!0},..."string"==typeof o&&{maxAge:Number(o)},path:l,...c&&{sameSite:_.includes(w=(w=c).toLowerCase())?w:void 0},...d&&{secure:!0},...m&&{priority:f.includes(h=(h=m).toLowerCase())?h:void 0},...u&&{partitioned:!0}};let e={};for(let t in g)g[t]&&(e[t]=g[t]);return e}}t.exports=((e,t,r)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let o of s(t))i.call(e,o)||void 0===o||a(e,o,{get:()=>t[o],enumerable:!(r=n(t,o))||r.enumerable});return e})(a({},"__esModule",{value:!0}),o);var _=["strict","lax","none"],f=["low","medium","high"],m=class{constructor(e){this._parsed=new Map,this._headers=e;const t=e.get("cookie");if(t)for(const[e,r]of p(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===a).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,a=this._parsed;return a.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(a).map(([e,t])=>d(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>d(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},w=class{constructor(e){var t,r,a;this._parsed=new Map,this._headers=e;const n=null!=(a=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?a:[];for(const e of Array.isArray(n)?n:function(e){if(!e)return[];var t,r,a,n,s,i=[],o=0;function l(){for(;o<e.length&&/\s/.test(e.charAt(o));)o+=1;return o<e.length}for(;o<e.length;){for(t=o,s=!1;l();)if(","===(r=e.charAt(o))){for(a=o,o+=1,l(),n=o;o<e.length&&"="!==(r=e.charAt(o))&&";"!==r&&","!==r;)o+=1;o<e.length&&"="===e.charAt(o)?(s=!0,o=n,i.push(e.substring(t,a)),t=o):o=a+1}else o+=1;(!s||o>=e.length)&&i.push(e.substring(t,e.length))}return i}(n)){const t=u(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===a)}has(e){return this._parsed.has(e)}set(...e){let[t,r,a]=1===e.length?[e[0].name,e[0].value,e[0]]:e,n=this._parsed;return n.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...a})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=d(r);t.append("set-cookie",e)}}(n,this._headers),this}delete(...e){let[t,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0]];return this.set({...r,name:t,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(d).join("; ")}}},263124,e=>{"use strict";let t=["DATABASE_URL","POSTGRES_URL","POSTGRES_PRISMA_URL","POSTGRES_URL_NON_POOLING","DATABASE_URL_UNPOOLED"];e.s(["resolveDatabaseUrl",0,function(e=process.env){if("preview"===e.VERCEL_ENV)return e.PROFFERA_PREVIEW_DATABASE_URL?.trim()||null;for(let r of t){let t=e[r]?.trim();if(t)return t}return null}])},276269,e=>{"use strict";var t=e.i(598323);let r=(0,e.i(263124).resolveDatabaseUrl)();e.s(["getSql",0,function(){return r?(0,t.neon)(r):null}])},887435,e=>{"use strict";let t=["BETTER_AUTH_SECRET","AUTH_SECRET"];function r(e=process.env){if("preview"===e.VERCEL_ENV)return e.PROFFERA_PREVIEW_AUTH_SECRET?.trim()||null;for(let r of t){let t=e[r]?.trim();if(t)return t}return null}e.s(["resolveAuthSecret",0,r,"resolveCustomerPortalSecret",0,function(e=process.env){return"preview"===e.VERCEL_ENV?r(e):e.CUSTOMER_PORTAL_SECRET?.trim()||r(e)}])},135114,e=>{"use strict";e.s(["DialectAdapterBase",0,class{get supportsCreateIfNotExists(){return!0}get supportsMultipleConnections(){return!0}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!1}get supportsOutput(){return!1}}])},96727,e=>{"use strict";var t=e.i(738950);let r=/"/g,a=/[\\'"]/g;class n extends t.DefaultQueryCompiler{visitOrAction(e){this.append("or "),this.append(e.action)}getCurrentParameterPlaceholder(){return"?"}getLeftExplainOptionsWrapper(){return""}getRightExplainOptionsWrapper(){return""}getLeftIdentifierWrapper(){return'"'}getRightIdentifierWrapper(){return'"'}getAutoIncrement(){return"autoincrement"}sanitizeIdentifier(e){return e.replace(r,'""')}sanitizeJSONPathMemberValue(e){return e.replace(a,e=>"\\"===e?"\\\\":"'"===e?"''":'\\"')}visitDefaultInsertValue(e){this.append("null")}}e.s(["SqliteQueryCompiler",0,n])},985282,e=>{"use strict";var t=e.i(135114);class r extends t.DialectAdapterBase{get supportsMultipleConnections(){return!1}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!0}async acquireMigrationLock(e,t){}async releaseMigrationLock(e,t){}}e.s(["SqliteAdapter",0,r])},806527,e=>e.a(async(t,r)=>{try{var a=e.i(493458),n=e.i(79832),s=t([n]);async function i(){return(0,n.getAuth)().api.getSession({headers:await (0,a.headers)()})}[n]=s.then?(await s)():s,e.s(["getServerSession",0,i]),r()}catch(e){r(e)}},!1),257608,e=>{"use strict";e.s(["selectWorkspaceMembership",0,function(e,t){return e.find(e=>e.workspaceId===t)??e[0]??null}])},133939,e=>{"use strict";let t=["owner","admin","staff","viewer"];e.s(["canRoleManageWorkspaceMembers",0,function(e){return"owner"===e},"canRoleManageWorkspaceSettings",0,function(e){return"owner"===e||"admin"===e},"isWorkspaceRole",0,function(e){return"string"==typeof e&&t.includes(e)}])},695478,e=>e.a(async(t,r)=>{try{var a=e.i(598323),n=e.i(493458),s=e.i(806527),i=e.i(263124),o=e.i(257608),l=e.i(133939),c=t([s]);[s]=c.then?(await c)():c;let u=["active","trial"],_=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function d(e,t=""){return null==e?t:String(e)}async function p(){let e,t=await (0,s.getServerSession)();if(!t)return{ok:!1,reason:"no_session"};let r=t.user?.id;if(!r)return{ok:!1,reason:"no_user"};let c=(e=(0,i.resolveDatabaseUrl)())?(0,a.neon)(e):null;if(!c)return{ok:!1,reason:"workspace_not_allowed"};try{let e=await (0,n.cookies)(),t=e.get("proffera_workspace_id")?.value??"",a=_.test(t)?t:"";if(!(await c`
      select id
      from "user"
      where id = ${r}
      limit 1
    `)[0])return{ok:!1,reason:"no_user"};let s=await c`
      select
        wm.workspace_id,
        wm.role,
        w.slug as workspace_slug,
        w.name as workspace_name,
        w.status as workspace_status
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${r}
        and w.status in ('active', 'trial')
      order by wm.created_at asc
    `;if(!s[0])return{ok:!1,reason:"no_membership"};let i=s.flatMap(e=>{let t=e.role,r=e.workspace_status,a=d(e.workspace_id),n=d(e.workspace_slug),s=d(e.workspace_name);return(0,l.isWorkspaceRole)(t)&&"string"==typeof r&&u.includes(r)&&a&&n&&s?[{workspaceId:a,workspaceSlug:n,workspaceName:s,workspaceStatus:r,role:t}]:[]}),p=(0,o.selectWorkspaceMembership)(i,a);if(!p)return{ok:!1,reason:"workspace_not_allowed"};return{ok:!0,userId:r,...p}}catch(e){return console.error("Failed to read workspace access",e),{ok:!1,reason:"workspace_not_allowed"}}}e.s(["canManageWorkspaceMembers",0,function(e){return e.ok&&(0,l.canRoleManageWorkspaceMembers)(e.role)},"canManageWorkspaceSettings",0,function(e){return e.ok&&(0,l.canRoleManageWorkspaceSettings)(e.role)},"getUserWorkspaceAccess",0,p]),r()}catch(e){r(e)}},!1),522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},446786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},921517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},912081,e=>{"use strict";e.s(["siteConfig",0,{name:"Proffera",description:"Proffera hjälper tjänsteföretag att visa tjänster, ta emot bokningar och offertförfrågningar och hantera kunder, uppdrag och uppföljning i ett tydligt arbetsflöde.",url:"https://proffera.se",primaryCta:"Starta gratis i 14 dagar",providerCta:"Se priser"}])},509742,e=>{"use strict";var t=e.i(276269),r=e.i(666680),a=e.i(912081);let n=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,s=process.env.SERVICE_AI_CHAT_BRIDGE_URL?.trim()||"",i=process.env.SERVICE_AI_CHAT_INTEGRATION_SECRET?.trim()||"",o=process.env.SERVICE_AI_CHAT_ORIGIN?.trim().replace(/\/$/,"")||"https://chat.proffera.se";function l(e){return null==e?"":String(e)}function c(e){return"active"===e||"suspended"===e?e:null}async function d(e){if(!(s&&i))return{ok:!1,code:"not_configured",data:null};let t=JSON.stringify(e),a=new Date().toISOString();try{let e=await fetch(s,{method:"POST",headers:{"content-type":"application/json","x-proffera-timestamp":a,"x-proffera-signature":(0,r.createHmac)("sha256",i).update(`${a}.${t}`).digest("hex")},body:t,cache:"no-store"}),n=await e.json().catch(()=>({}));if(!e.ok)return{ok:!1,code:l(n.error)||`remote_${e.status}`,data:n};return{ok:!0,code:null,data:n}}catch(e){return console.error("Service AI Chat bridge request failed",e),{ok:!1,code:"network_error",data:null}}}async function p(e){let r=(0,t.getSql)();if(!r||!n.test(e))return null;let s=(await r`
    select
      w.id,
      w.name,
      w.public_booking_slug,
      coalesce((
        select u.email
        from workspace_memberships wm
        join "user" u on u.id = wm.user_id
        where wm.workspace_id = w.id
          and wm.role = 'owner'
        order by wm.created_at asc
        limit 1
      ), '') as owner_email
    from workspaces w
    where w.id = ${e}::uuid
    limit 1
  `)[0],i=l(s?.name).trim(),o=l(s?.owner_email).trim().toLowerCase(),c=l(s?.public_booking_slug).trim(),d=a.siteConfig.url.replace(/^https?:\/\/(?:www\.)?/,"https://www.").replace(/\/$/,""),p=c?`${d}/boka/${encodeURIComponent(c)}`:d;return i&&o?{name:i,ownerEmail:o,bookingUrl:p}:null}async function u(e){let r=(0,t.getSql)();if(!r||!n.test(e))return{databaseReady:!1,tenantId:null,clientId:null,lifecycle:null,lastErrorCode:null};try{let t=(await r`
      select remote_tenant_id, remote_client_id, lifecycle_state, last_error_code
      from workspace_ai_chat_integrations
      where workspace_id = ${e}::uuid
      limit 1
    `)[0];return{databaseReady:!0,tenantId:l(t?.remote_tenant_id)||null,clientId:l(t?.remote_client_id)||null,lifecycle:c(t?.lifecycle_state),lastErrorCode:l(t?.last_error_code)||null}}catch(e){return console.error("Failed to read AI Chat integration",e),{databaseReady:!1,tenantId:null,clientId:null,lifecycle:null,lastErrorCode:null}}}async function _(e){let r=(0,t.getSql)();if(!r||!n.test(e.workspaceId))return{ok:!1,code:"database"};let a=await u(e.workspaceId);if(!e.enabled&&!a.tenantId)return{ok:!0,skipped:!0};let s=await p(e.workspaceId);if(!s)return{ok:!1,code:"workspace_identity"};let i=e.enabled?"active":"suspended",o=await d({action:"provision",workspaceId:e.workspaceId,workspaceName:s.name,ownerEmail:s.ownerEmail,website:s.bookingUrl,lifecycle:i});if(!o.ok)return await r`
      update workspace_ai_chat_integrations
      set last_error_code = ${o.code}, updated_at = now()
      where workspace_id = ${e.workspaceId}::uuid
    `,{ok:!1,code:o.code};let _=l(o.data.tenantId),f=l(o.data.clientId),m=c(o.data.lifecycle);return _&&f&&m?(await r`
    insert into workspace_ai_chat_integrations (
      workspace_id, remote_tenant_id, remote_client_id, lifecycle_state, last_synced_at, last_error_code, created_at, updated_at
    ) values (
      ${e.workspaceId}::uuid, ${_}, ${f}, ${m}, now(), null, now(), now()
    )
    on conflict (workspace_id)
    do update set
      remote_tenant_id = excluded.remote_tenant_id,
      remote_client_id = excluded.remote_client_id,
      lifecycle_state = excluded.lifecycle_state,
      last_synced_at = now(),
      last_error_code = null,
      updated_at = now()
  `,{ok:!0,tenantId:_,lifecycle:m}):{ok:!1,code:"invalid_remote_response"}}async function f(e){let t=await u(e);if(!t.tenantId||"active"!==t.lifecycle)return null;let r=await d({action:"activation_link",workspaceId:e}),a=r.ok?l(r.data.token):"",n=r.ok?l(r.data.expiresAt):"";return a&&n?`${o}/activate/proffera?token=${encodeURIComponent(a)}`:null}e.s(["createWorkspaceAiChatActivationUrl",0,f,"syncWorkspaceAiChat",0,_],509742)},101390,e=>{"use strict";var t=e.i(276269),r=e.i(509742);let a=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function n(e,n,s,i){var o,l;let c=(0,t.getSql)(),d=e.metadata.workspace_id?.trim()??"",p=e.items.data[0],u=p?.price.id??"";if(!c||!a.test(d)||u!==i)return{ok:!1,code:"ignored"};let _="active"===(o=e.status)||"trialing"===o||"past_due"===o||"paused"===o?o:"canceled"===o||"incomplete_expired"===o?"cancelled":"past_due",f="active"===_||"trialing"===_,m=f&&"professional"===s,w=(l=e.customer)?"string"==typeof l?l:l.id:null,h=p?.current_period_start??e.current_period_start,g=p?.current_period_end??e.current_period_end,k=h?new Date(1e3*h).toISOString():null,v=g?new Date(1e3*g).toISOString():null;try{let t=await c`
      with permitted_event as (
        select 1
        where coalesce((
          select last_event_created
          from workspace_billing_subscriptions
          where workspace_id = ${d}::uuid
        ), 0) <= ${n}
      ),
      selected_workspace as (
        select id
        from workspaces
        where id = ${d}::uuid
      ),
      latest_plan as (
        select wp.id
        from workspace_plans wp
        join selected_workspace sw on sw.id = wp.workspace_id
        order by wp.created_at desc
        limit 1
      ),
      updated_plan as (
        update workspace_plans wp
        set
          plan_key = ${s},
          status = ${_},
          current_period_start = ${k},
          current_period_end = ${v},
          updated_at = now()
        from latest_plan lp, permitted_event pe
        where wp.id = lp.id
        returning wp.id
      ),
      inserted_plan as (
        insert into workspace_plans (
          id, workspace_id, plan_key, status, current_period_start, current_period_end, created_at, updated_at
        )
        select
          gen_random_uuid(), sw.id, ${s}, ${_}, ${k}, ${v}, now(), now()
        from selected_workspace sw
        cross join permitted_event pe
        where not exists (select 1 from updated_plan)
        returning id
      ),
      selected_plan as (
        select id from updated_plan
        union all
        select id from inserted_plan
      ),
      billing_upsert as (
        insert into workspace_billing_subscriptions (
          id,
          workspace_id,
          workspace_plan_id,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id,
          status,
          cancel_at_period_end,
          current_period_start,
          current_period_end,
          last_event_created,
          created_at,
          updated_at
        )
        select
          gen_random_uuid(),
          sw.id,
          sp.id,
          ${w},
          ${e.id},
          ${u},
          ${_},
          ${e.cancel_at_period_end},
          ${k},
          ${v},
          ${n},
          now(),
          now()
        from selected_workspace sw
        cross join selected_plan sp
        on conflict (workspace_id)
        do update set
          workspace_plan_id = excluded.workspace_plan_id,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          stripe_price_id = excluded.stripe_price_id,
          status = excluded.status,
          cancel_at_period_end = excluded.cancel_at_period_end,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          last_event_created = excluded.last_event_created,
          updated_at = now()
        returning workspace_id
      ),
      feature_values (feature_key, enabled) as (
        values
          ('booking_demo', ${f}::boolean),
          ('crm_customers', ${m}::boolean),
          ('lead_inbox', ${f}::boolean),
          ('ai_assistant', ${m}::boolean)
      )
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), bu.workspace_id, fv.feature_key, fv.enabled, now(), now()
      from billing_upsert bu
      cross join feature_values fv
      on conflict (workspace_id, feature_key)
      do update set enabled = excluded.enabled, updated_at = now()
      returning workspace_id
    `;if(0===t.length)return{ok:!1,code:"stale"};try{let e=await (0,r.syncWorkspaceAiChat)({workspaceId:d,enabled:m});e.ok||console.error("Failed to synchronise AI Chat entitlement",{workspaceId:d,code:e.code})}catch(e){console.error("AI Chat entitlement synchronisation crashed",{workspaceId:d,error:e})}return{ok:!0}}catch(e){return console.error("Failed to sync Stripe subscription",e),{ok:!1,code:"database"}}}e.s(["syncWorkspaceSubscription",0,n])},491458,e=>e.a(async(t,r)=>{try{var a=e.i(89171),n=e.i(276269),s=e.i(8018),i=e.i(101390),o=e.i(695478),l=t([o]);function c(e,t){return a.NextResponse.json({error:e},{status:t,headers:{"Cache-Control":"no-store"}})}function d(e){return e&&"string"!=typeof e?e.hosted_invoice_url:null}async function p(e){let t=new URL(e.url),r=e.headers.get("origin");if(r&&r!==t.origin)return c("Ogiltig begäran.",403);let l=await (0,o.getUserWorkspaceAccess)();if(!l.ok||!(0,o.canManageWorkspaceMembers)(l))return c("Endast arbetsytans Owner kan uppgradera abonnemanget.",403);let p=(0,n.getSql)(),u=(0,s.getStripeClient)(),_=(0,s.getStripePriceIdForPlan)("starter"),f=(0,s.getStripePriceIdForPlan)("professional");if(!p||!u||!_||!f)return c("Uppgradering är inte färdigkonfigurerad.",503);if(_===f)return c("Starter och Professional behöver ha olika Stripe-priser.",503);try{let e=(await p`
      select
        wbs.stripe_subscription_id,
        wbs.status,
        wp.plan_key
      from workspace_billing_subscriptions wbs
      left join workspace_plans wp on wp.id = wbs.workspace_plan_id
      where wbs.workspace_id = ${l.workspaceId}::uuid
      limit 1
    `)[0],t=e?.status?String(e.status):"",r=e?.plan_key?String(e.plan_key):"",n=e?.stripe_subscription_id?String(e.stripe_subscription_id):"";if(!n||"active"!==t&&"trialing"!==t)return c("Ett aktivt Starter-abonnemang krävs för att uppgradera.",409);if("professional"===r)return c("Professional är redan aktivt för arbetsytan.",409);if("starter"!==r)return c("Den nuvarande planen kan inte uppgraderas automatiskt.",409);let s=await u.subscriptions.retrieve(n,{expand:["latest_invoice"]}),o=s.items.data[0];if(s.metadata.workspace_id!==l.workspaceId||!o)return c("Stripe-abonnemanget matchar inte arbetsytan.",409);if(o.price.id!==_&&o.price.id!==f)return c("Stripe-abonnemanget använder ett okänt pris.",409);if(s.pending_update)return a.NextResponse.json({pending:!0,url:d(s.latest_invoice),error:"Slutför den befintliga betalningen innan Professional aktiveras."},{status:202,headers:{"Cache-Control":"no-store"}});if(o.price.id===_&&(s=await u.subscriptions.update(n,{items:[{id:o.id,price:f,quantity:o.quantity??1}],metadata:{...s.metadata,workspace_id:l.workspaceId,workspace_owner_id:l.userId,plan_key:"professional"},payment_behavior:"pending_if_incomplete",proration_behavior:"always_invoice",expand:["latest_invoice"]})),s.pending_update)return a.NextResponse.json({pending:!0,url:d(s.latest_invoice),error:"Betalningen behöver slutföras innan Professional aktiveras."},{status:202,headers:{"Cache-Control":"no-store"}});let m=await (0,i.syncWorkspaceSubscription)(s,Math.floor(Date.now()/1e3),"professional",f);return a.NextResponse.json({upgraded:!0,applied:m.ok},{status:m.ok?200:202,headers:{"Cache-Control":"no-store"}})}catch(e){return console.error("Failed to upgrade Stripe subscription",e),c("Abonnemanget kunde inte uppgraderas. Försök igen.",500)}}[o]=l.then?(await l)():l,e.s(["POST",0,p,"runtime",0,"nodejs"]),r()}catch(e){r(e)}},!1),214421,e=>e.a(async(t,r)=>{try{var a=e.i(747909),n=e.i(174017),s=e.i(996250),i=e.i(759756),o=e.i(561916),l=e.i(174677),c=e.i(869741),d=e.i(316795),p=e.i(487718),u=e.i(995169),_=e.i(47587),f=e.i(666012),m=e.i(570101),w=e.i(626937),h=e.i(10372),g=e.i(193695);e.i(820232);var k=e.i(600220),v=e.i(491458),y=t([v]);[v]=y.then?(await y)():y;let b=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/stripe/upgrade/route",pathname:"/api/stripe/upgrade",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/stripe/upgrade/route.ts",nextConfigOutput:"",userland:v,...{}}),{workAsyncStorage:R,workUnitAsyncStorage:S,serverHooks:C}=b;async function x(e,t,r){r.requestMeta&&(0,i.setRequestMeta)(e,r.requestMeta),b.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/stripe/upgrade/route";a=a.replace(/\/index$/,"")||"/";let s=await b.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:v,params:y,nextConfig:x,parsedUrl:R,isDraftMode:S,prerenderManifest:C,routerServerContext:E,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,resolvedPathname:$,clientReferenceManifest:O,serverActionsManifest:P}=s,j=(0,c.normalizeAppPath)(a),T=!!(C.dynamicRoutes[j]||C.routes[$]),q=async()=>((null==E?void 0:E.render404)?await E.render404(e,t,R,!1):t.end("This page could not be found"),null);if(T&&!S){let e=!!C.routes[$],t=C.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(x.adapterPath)return await q();throw new g.NoFallbackError}}let N=null;!T||b.isDev||S||(N=$,N="/index"===N?"/":N);let U=!0===b.isDev||!T,M=T&&!U;P&&O&&(0,l.setManifestsSingleton)({page:a,clientReferenceManifest:O,serverActionsManifest:P});let D=e.method||"GET",L=(0,o.getTracer)(),W=L.getActiveScopeSpan(),H=!!(null==E?void 0:E.isWrappedByNextServer),F=!!(0,i.getRequestMeta)(e,"minimalMode"),V=(0,i.getRequestMeta)(e,"incrementalCache")||await b.getIncrementalCache(e,x,C,F);null==V||V.resetRequestCache(),globalThis.__incrementalCache=V;let B={params:y,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:U,incrementalCache:V,cacheLifeProfiles:x.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>b.onRequestError(e,t,a,n,E)},sharedContext:{buildId:v}},G=new d.NodeNextRequest(e),K=new d.NodeNextResponse(t),z=p.NextRequestAdapter.fromNodeNextRequest(G,(0,p.signalFromNodeResponse)(t));try{let s,i=async e=>b.handle(z,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=L.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${D} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",n),s.updateName(t))}else e.updateName(`${D} ${a}`)}),l=async s=>{var o,l;let c=async({previousCacheEntry:n})=>{try{if(!F&&A&&I&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await i(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let o=B.renderOpts.pendingWaitUntil;o&&r.waitUntil&&(r.waitUntil(o),o=void 0);let l=B.renderOpts.collectedTags;if(!T)return await (0,f.sendResponse)(G,K,a,B.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(a.headers);l&&(t[h.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,n=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:k.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await b.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:A})},!1,E),t}},d=await b.handleResponse({req:e,nextConfig:x,cacheKey:N,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,responseGenerator:c,waitUntil:r.waitUntil,isMinimalMode:F});if(!T)return null;if((null==d||null==(o=d.value)?void 0:o.kind)!==k.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});F||t.setHeader("x-nextjs-cache",A?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return F&&T||p.delete(h.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,w.getCacheControlHeader)(d.cacheControl)),await (0,f.sendResponse)(G,K,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};H&&W?await l(W):(s=L.getActiveScopeSpan(),await L.withPropagatedContext(e.headers,()=>L.trace(u.BaseServerSpan.handleRequest,{spanName:`${D} ${a}`,kind:o.SpanKind.SERVER,attributes:{"http.method":D,"http.target":e.url}},l),void 0,!H))}catch(t){if(t instanceof g.NoFallbackError||await b.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:A})},!1,E),T)throw t;return await (0,f.sendResponse)(G,K,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:S})},"routeModule",0,b,"serverHooks",0,C,"workAsyncStorage",0,R,"workUnitAsyncStorage",0,S]),r()}catch(e){r(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0~_c-ho._.js.map