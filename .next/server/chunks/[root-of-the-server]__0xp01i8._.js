module.exports=[918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},666680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},3459,e=>{"use strict";var t=e.i(666680),r=e.i(276269);async function a(e){let a=function(e=process.env){let t=e.PUBLIC_FORM_RATE_LIMIT_SECRET?.trim();return t||(e.VERCEL_ENV||"production"===e.NODE_ENV?null:"proffera-public-form-rate-limit-v1")}(),s=(0,r.getSql)();if(!a||!s||e.maxAttempts<1||e.windowSeconds<1)return!1;try{let r=await s`
      insert into public_submission_rate_limits (
        scope,
        fingerprint,
        window_started_at,
        attempts,
        created_at,
        updated_at
      )
      values (
        ${e.scope},
        ${function({scope:e,requestHeaders:r,identity:a=""},s){let n=a.trim().toLowerCase();return(0,t.createHash)("sha256").update(`${s}:${e}:${r.get("x-forwarded-for")?.split(",")[0]?.trim()||r.get("x-real-ip")?.trim()||"unknown"}:${n}`).digest("hex")}(e,a)},
        now(),
        1,
        now(),
        now()
      )
      on conflict (scope, fingerprint)
      do update set
        attempts = case
          when public_submission_rate_limits.window_started_at <= now() - (${e.windowSeconds} * interval '1 second') then 1
          else public_submission_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public_submission_rate_limits.window_started_at <= now() - (${e.windowSeconds} * interval '1 second') then now()
          else public_submission_rate_limits.window_started_at
        end,
        updated_at = now()
      returning attempts
    `;return Number(r[0]?.attempts??e.maxAttempts+1)<=e.maxAttempts}catch(e){return console.error("Failed to apply public form rate limit",e),!1}}e.s(["allowPublicSubmission",0,a],3459)},442315,(e,t,r)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,r)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},819481,(e,t,r)=>{"use strict";var a=Object.defineProperty,s=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,o={},l={RequestCookies:()=>f,ResponseCookies:()=>h,parseCookie:()=>d,parseSetCookie:()=>p,stringifyCookie:()=>c};for(var u in l)a(o,u,{get:l[u],enumerable:!0});function c(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),a=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?a:`${a}; ${r.join("; ")}`}function d(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[a,s]=[r.slice(0,e),r.slice(e+1)];try{t.set(a,decodeURIComponent(null!=s?s:"true"))}catch{}}return t}function p(e){if(!e)return;let[[t,r],...a]=d(e),{domain:s,expires:n,httponly:i,maxage:o,path:l,samesite:u,secure:c,partitioned:p,priority:f}=Object.fromEntries(a.map(([e,t])=>[e.toLowerCase().replace(/-/g,""),t]));{var h,g,w={name:t,value:decodeURIComponent(r),domain:s,...n&&{expires:new Date(n)},...i&&{httpOnly:!0},..."string"==typeof o&&{maxAge:Number(o)},path:l,...u&&{sameSite:m.includes(h=(h=u).toLowerCase())?h:void 0},...c&&{secure:!0},...f&&{priority:_.includes(g=(g=f).toLowerCase())?g:void 0},...p&&{partitioned:!0}};let e={};for(let t in w)w[t]&&(e[t]=w[t]);return e}}t.exports=((e,t,r)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let o of n(t))i.call(e,o)||void 0===o||a(e,o,{get:()=>t[o],enumerable:!(r=s(t,o))||r.enumerable});return e})(a({},"__esModule",{value:!0}),o);var m=["strict","lax","none"],_=["low","medium","high"],f=class{constructor(e){this._parsed=new Map,this._headers=e;const t=e.get("cookie");if(t)for(const[e,r]of d(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===a).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,a=this._parsed;return a.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(a).map(([e,t])=>c(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>c(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},h=class{constructor(e){var t,r,a;this._parsed=new Map,this._headers=e;const s=null!=(a=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?a:[];for(const e of Array.isArray(s)?s:function(e){if(!e)return[];var t,r,a,s,n,i=[],o=0;function l(){for(;o<e.length&&/\s/.test(e.charAt(o));)o+=1;return o<e.length}for(;o<e.length;){for(t=o,n=!1;l();)if(","===(r=e.charAt(o))){for(a=o,o+=1,l(),s=o;o<e.length&&"="!==(r=e.charAt(o))&&";"!==r&&","!==r;)o+=1;o<e.length&&"="===e.charAt(o)?(n=!0,o=s,i.push(e.substring(t,a)),t=o):o=a+1}else o+=1;(!n||o>=e.length)&&i.push(e.substring(t,e.length))}return i}(s)){const t=p(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===a)}has(e){return this._parsed.has(e)}set(...e){let[t,r,a]=1===e.length?[e[0].name,e[0].value,e[0]]:e,s=this._parsed;return s.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...a})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=c(r);t.append("set-cookie",e)}}(s,this._headers),this}delete(...e){let[t,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0]];return this.set({...r,name:t,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(c).join("; ")}}},263124,e=>{"use strict";let t=["DATABASE_URL","POSTGRES_URL","POSTGRES_PRISMA_URL","POSTGRES_URL_NON_POOLING","DATABASE_URL_UNPOOLED"];e.s(["resolveDatabaseUrl",0,function(e=process.env){if("preview"===e.VERCEL_ENV)return e.PROFFERA_PREVIEW_DATABASE_URL?.trim()||null;for(let r of t){let t=e[r]?.trim();if(t)return t}return null}])},276269,e=>{"use strict";var t=e.i(598323);let r=(0,e.i(263124).resolveDatabaseUrl)();e.s(["getSql",0,function(){return r?(0,t.neon)(r):null}])},730216,e=>{"use strict";e.s(["resolveWorkspaceFeatureAccess",0,function(e){return!0===e.adminOverrideEnabled?{hasAccess:!0,accessState:"included"}:!1===e.adminOverrideEnabled||!e.workspaceEnabled&&(e.includedInPlan||e.trialActive)?{hasAccess:!1,accessState:"disabled"}:e.includedInPlan&&e.workspaceEnabled?{hasAccess:!0,accessState:"included"}:e.trialActive&&e.workspaceEnabled?{hasAccess:!0,accessState:"trial"}:{hasAccess:!1,accessState:"locked"}}])},682923,e=>{"use strict";let t={starter:1,professional:2,business:3};function r(e){return"starter"===e||"professional"===e||"business"===e?e:null}e.s(["isWorkspacePlanFeatureIncluded",0,function(e){let a=r(e.planKey),s=r(e.minimumPlan)??"starter",n=String(e.planStatus??"");if("trialing"===n){if(!e.planPeriodEnd)return!1;let t=new Date(String(e.planPeriodEnd));return!Number.isNaN(t.getTime())&&t.getTime()>(e.now??new Date).getTime()}return!!(a&&"active"===n&&t[a]>=t[s])},"normalizeWorkspacePlan",0,r])},872132,e=>{"use strict";var t=e.i(276269),r=e.i(730216),a=e.i(682923);let s=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function n(e,n){let i=(0,t.getSql)(),o=n.trim();if(!i||!s.test(e)||!o)return!1;try{let t=(await i`
      with latest_plan as (
        select plan_key, status, current_period_end
        from workspace_plans
        where workspace_id = ${e}::uuid
        order by created_at desc
        limit 1
      )
      select
        catalog.minimum_plan,
        coalesce(flag.enabled, false) as workspace_enabled,
        override.enabled as admin_override_enabled,
        plan.plan_key,
        plan.status as plan_status,
        plan.current_period_end as plan_period_end,
        trial.status as trial_status,
        trial.ends_at as trial_ends_at
      from feature_catalog catalog
      left join workspace_feature_flags flag
        on flag.workspace_id = ${e}::uuid
       and flag.feature_key = catalog.feature_key
      left join workspace_feature_overrides override
        on override.workspace_id = ${e}::uuid
       and override.feature_key = catalog.feature_key
      left join latest_plan plan on true
      left join workspace_feature_trials trial
        on trial.workspace_id = ${e}::uuid
       and trial.feature_key = catalog.feature_key
      where catalog.feature_key = ${o}
        and catalog.is_active = true
      limit 1
    `)[0];if(!t)return!1;let s=new Date,n=(0,a.isWorkspacePlanFeatureIncluded)({planKey:t.plan_key,planStatus:t.plan_status,planPeriodEnd:t.plan_period_end,minimumPlan:t.minimum_plan,now:s}),l=t.trial_ends_at?new Date(String(t.trial_ends_at)):null,u="active"===String(t.trial_status??"")&&!!l&&!Number.isNaN(l.getTime())&&l.getTime()>s.getTime(),c=null===t.admin_override_enabled||void 0===t.admin_override_enabled?null:!!t.admin_override_enabled;return(0,r.resolveWorkspaceFeatureAccess)({includedInPlan:n,trialActive:u,workspaceEnabled:!!t.workspace_enabled,adminOverrideEnabled:c}).hasAccess}catch(e){return console.error("Failed to resolve workspace feature access",e),!1}}e.s(["hasWorkspaceFeatureAccessForWorkspace",0,n])},842955,e=>{"use strict";var t=e.i(747909),r=e.i(174017),a=e.i(996250),s=e.i(759756),n=e.i(561916),i=e.i(174677),o=e.i(869741),l=e.i(316795),u=e.i(487718),c=e.i(995169),d=e.i(47587),p=e.i(666012),m=e.i(570101),_=e.i(626937),f=e.i(10372),h=e.i(193695);e.i(820232);var g=e.i(600220),w=e.i(89171),v=e.i(469719),x=e.i(276269),b=e.i(3459),y=e.i(872132);let k=v.z.object({workspaceId:v.z.string().uuid(),serviceId:v.z.string().uuid().optional().nullable(),name:v.z.string().trim().min(1).max(120),email:v.z.string().trim().email().max(160),phone:v.z.string().trim().max(40).optional().default(""),message:v.z.string().trim().min(2).max(1e3),website:v.z.string().max(200).optional().default("")});async function R(e){let t;try{t=await e.json()}catch{return w.NextResponse.json({ok:!1,error:"invalid"},{status:400})}let r=k.safeParse(t);if(!r.success)return w.NextResponse.json({ok:!1,error:"invalid"},{status:400});let a=r.data;if(a.website)return w.NextResponse.json({ok:!0},{status:201});let s=(0,x.getSql)();if(!s)return w.NextResponse.json({ok:!1,error:"unavailable"},{status:503});if(!await (0,b.allowPublicSubmission)({scope:`public_business_contact:${a.workspaceId}`,requestHeaders:e.headers,identity:a.email,maxAttempts:5,windowSeconds:1800}))return w.NextResponse.json({ok:!1,error:"rate_limit"},{status:429});if(!(await s`
    select id
    from workspaces
    where id = ${a.workspaceId}::uuid
      and status in ('active', 'trial')
    limit 1
  `)[0]||!await (0,y.hasWorkspaceFeatureAccessForWorkspace)(a.workspaceId,"website_builder"))return w.NextResponse.json({ok:!1,error:"not_found"},{status:404});let n="",i="";if(a.serviceId){let e=await s`
      select name, public_slug
      from workspace_services
      where id = ${a.serviceId}::uuid
        and workspace_id = ${a.workspaceId}
        and is_active = true
        and public_status = 'published'
        and conversion_mode = 'contact'
      limit 1
    `;if(!e[0])return w.NextResponse.json({ok:!1,error:"invalid_service"},{status:400});n=String(e[0].name??""),i=String(e[0].public_slug??"")}let o=`${a.workspaceId}:${a.email.toLowerCase()}`;try{let[,e]=await s.transaction([s`select pg_advisory_xact_lock(hashtextextended(${o}::text, 0))`,s`
        with existing_customer as (
          select id
          from customers
          where workspace_id = ${a.workspaceId}
            and lower(email) = lower(${a.email})
          order by created_at asc nulls last, id asc
          limit 1
        ), updated_existing as (
          update customers customer
          set
            phone = coalesce(nullif(customer.phone, ''), ${a.phone||null}),
            primary_service_slug = coalesce(nullif(customer.primary_service_slug, ''), ${i||null}),
            updated_at = now()
          where customer.id = (select id from existing_customer)
            and customer.workspace_id = ${a.workspaceId}
          returning customer.id
        ), inserted_customer as (
          insert into customers (
            workspace_id, name, email, phone, customer_type, status, source, primary_service_slug
          )
          select
            ${a.workspaceId}, ${a.name}, ${a.email}, ${a.phone||null}, 'private', 'prospect', 'web_form', ${i||null}
          where not exists (select 1 from existing_customer)
          returning id
        ), selected_customer as (
          select id from updated_existing
          union all
          select id from inserted_customer
          limit 1
        ), contact_event as (
          insert into customer_events (
            workspace_id, customer_id, event_type, title, description, metadata
          )
          select
            ${a.workspaceId}, id, 'note', 'Ny kontaktförfrågan', ${a.message},
            jsonb_build_object('source', 'public_business', 'service_id', ${a.serviceId||null}, 'service_name', ${n})
          from selected_customer
          returning id
        )
        select
          (select id from selected_customer) as customer_id,
          (select id from contact_event) as event_id
      `]);if(!e?.[0]?.customer_id||!e?.[0]?.event_id)return w.NextResponse.json({ok:!1,error:"save"},{status:503})}catch(e){return console.error("Failed to save public business contact",e),w.NextResponse.json({ok:!1,error:"save"},{status:503})}return w.NextResponse.json({ok:!0},{status:201})}e.s(["POST",0,R,"dynamic",0,"force-dynamic","runtime",0,"nodejs"],596692);var A=e.i(596692);let E=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/public-business/contact/route",pathname:"/api/public-business/contact",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/public-business/contact/route.ts",nextConfigOutput:"",userland:A,...{}}),{workAsyncStorage:S,workUnitAsyncStorage:C,serverHooks:$}=E;async function N(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),E.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let w="/api/public-business/contact/route";w=w.replace(/\/index$/,"")||"/";let v=await E.prepare(e,t,{srcPage:w,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:x,params:b,nextConfig:y,parsedUrl:k,isDraftMode:R,prerenderManifest:A,routerServerContext:S,isOnDemandRevalidate:C,revalidateOnlyGenerated:$,resolvedPathname:N,clientReferenceManifest:P,serverActionsManifest:O}=v,j=(0,o.normalizeAppPath)(w),I=!!(A.dynamicRoutes[j]||A.routes[N]),T=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,k,!1):t.end("This page could not be found"),null);if(I&&!R){let e=!!A.routes[N],t=A.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(y.adapterPath)return await T();throw new h.NoFallbackError}}let q=null;!I||E.isDev||R||(q="/index"===(q=N)?"/":q);let D=!0===E.isDev||!I,U=I&&!D;O&&P&&(0,i.setManifestsSingleton)({page:w,clientReferenceManifest:P,serverActionsManifest:O});let M=e.method||"GET",F=(0,n.getTracer)(),L=F.getActiveScopeSpan(),H=!!(null==S?void 0:S.isWrappedByNextServer),W=!!(0,s.getRequestMeta)(e,"minimalMode"),z=(0,s.getRequestMeta)(e,"incrementalCache")||await E.getIncrementalCache(e,y,A,W);null==z||z.resetRequestCache(),globalThis.__incrementalCache=z;let B={params:b,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!y.experimental.authInterrupts},cacheComponents:!!y.cacheComponents,supportsDynamicResponse:D,incrementalCache:z,cacheLifeProfiles:y.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>E.onRequestError(e,t,a,s,S)},sharedContext:{buildId:x}},K=new l.NodeNextRequest(e),V=new l.NodeNextResponse(t),G=u.NextRequestAdapter.fromNodeNextRequest(K,(0,u.signalFromNodeResponse)(t));try{let s,i=async e=>E.handle(G,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=F.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${M} ${w}`)}),o=async s=>{var n,o;let l=async({previousCacheEntry:r})=>{try{if(!W&&C&&$&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let o=B.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let l=B.renderOpts.collectedTags;if(!I)return await (0,p.sendResponse)(K,V,n,B.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);l&&(t[f.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:g.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:C})},!1,S),t}},u=await E.handleResponse({req:e,nextConfig:y,cacheKey:q,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:$,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:W});if(!I)return null;if((null==u||null==(n=u.value)?void 0:n.kind)!==g.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(o=u.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});W||t.setHeader("x-nextjs-cache",C?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),R&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,m.fromNodeOutgoingHttpHeaders)(u.value.headers);return W&&I||c.delete(f.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,_.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(K,V,new Response(u.value.body,{headers:c,status:u.value.status||200})),null};H&&L?await o(L):(s=F.getActiveScopeSpan(),await F.withPropagatedContext(e.headers,()=>F.trace(c.BaseServerSpan.handleRequest,{spanName:`${M} ${w}`,kind:n.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof h.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:C})},!1,S),I)throw t;return await (0,p.sendResponse)(K,V,new Response(null,{status:500})),null}}e.s(["handler",0,N,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:C})},"routeModule",0,E,"serverHooks",0,$,"workAsyncStorage",0,S,"workUnitAsyncStorage",0,C],842955)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0xp01i8._.js.map