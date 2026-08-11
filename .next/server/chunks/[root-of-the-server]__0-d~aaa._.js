module.exports=[193695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,a)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,a)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,a)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,a)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,a)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,a)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),a()}catch(e){a(e)}},!0),918622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},814747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},522734,(e,t,a)=>{t.exports=e.x("fs",()=>require("fs"))},446786,(e,t,a)=>{t.exports=e.x("os",()=>require("os"))},427699,(e,t,a)=>{t.exports=e.x("events",()=>require("events"))},254799,(e,t,a)=>{t.exports=e.x("crypto",()=>require("crypto"))},921517,(e,t,a)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,a)=>{t.exports=e.x("https",()=>require("https"))},644887,e=>{"use strict";var t=e.i(276269),a=e.i(8018);async function r(e){var a;let r,n,s=(0,t.getSql)();if(!s)return null;let i=await s`
    select stripe_account_id, details_submitted, charges_enabled, payouts_enabled
    from workspace_payment_accounts
    where workspace_id = ${e}::uuid
    limit 1
  `;return i[0]?(r=!!(a=i[0]).charges_enabled,n=!!a.payouts_enabled,{stripeAccountId:String(a.stripe_account_id??""),detailsSubmitted:!!a.details_submitted,chargesEnabled:r,payoutsEnabled:n,ready:r&&n}):null}async function n(e){let n=(0,t.getSql)(),s=(0,a.getStripeClient)();if(!n||!s)throw Error("Stripe Connect is not configured");let i=await r(e);if(i?.stripeAccountId)return i.stripeAccountId;let o=await s.accounts.create({type:"express",capabilities:{card_payments:{requested:!0},transfers:{requested:!0}},metadata:{workspace_id:e}});try{await n`
      insert into workspace_payment_accounts (
        workspace_id, stripe_account_id, details_submitted, charges_enabled, payouts_enabled, created_at, updated_at
      ) values (
        ${e}::uuid, ${o.id}, ${o.details_submitted}, ${o.charges_enabled}, ${o.payouts_enabled}, now(), now()
      )
      on conflict (workspace_id) do update set
        stripe_account_id = excluded.stripe_account_id,
        details_submitted = excluded.details_submitted,
        charges_enabled = excluded.charges_enabled,
        payouts_enabled = excluded.payouts_enabled,
        updated_at = now()
    `}catch(e){throw await s.accounts.del(o.id).catch(()=>void 0),e}return o.id}e.s(["ensureWorkspaceStripeConnectAccount",0,n,"getWorkspacePaymentAccount",0,r])},173322,e=>{"use strict";e.s(["canCreateServiceJobPayment",0,function(e){return"cancelled"!==e.status&&Number.isInteger(e.totalMinor)&&Number(e.totalMinor)>0&&/^[A-Z]{3}$/.test(e.currency)}])},419455,e=>e.a(async(t,a)=>{try{var r=e.i(666680),n=e.i(276269),s=e.i(173322),i=e.i(141097),o=e.i(695478),d=e.i(644887),c=t([i,o]);[i,o]=c.then?(await c)():c;let h=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function u(e){return(0,r.createHash)("sha256").update(e).digest("hex")}async function l(e,t){if(!h.test(e))throw Error("invalid_job");let a=(0,n.getSql)(),c=await (0,o.getUserWorkspaceAccess)();if(!a||!c.ok||!(0,o.canManageWorkspaceSettings)(c))throw Error("forbidden");if(!await (0,i.hasWorkspaceFeature)("payments"))throw Error("locked");let l=await (0,d.getWorkspacePaymentAccount)(c.workspaceId);if(!l?.ready)throw Error("connect_not_ready");let p=(await a`
    select id, status, total_minor, currency
    from workspace_service_jobs
    where id = ${e}::uuid
      and workspace_id = ${c.workspaceId}::uuid
    limit 1
  `)[0],_=p?.total_minor===null||p?.total_minor===void 0?null:Number(p.total_minor),m=String(p?.currency??"");if(!p||!(0,s.canCreateServiceJobPayment)({status:String(p.status),totalMinor:_,currency:m}))throw Error("not_payable");let y=await a`
    select status
    from workspace_service_job_payments
    where workspace_id = ${c.workspaceId}::uuid
      and service_job_id = ${e}::uuid
    limit 1
  `;if("paid"===String(y[0]?.status??""))throw Error("already_paid");let w=(0,r.randomBytes)(32).toString("base64url"),b=u(w);return await a`
    insert into workspace_service_job_payments (
      workspace_id, service_job_id, token_hash, status, amount_minor, currency, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at, updated_at
    ) values (
      ${c.workspaceId}::uuid, ${e}::uuid, ${b}, 'pending', ${_}, ${m}, null, null, null, now(), now()
    )
    on conflict (workspace_id, service_job_id) do update set
      token_hash = excluded.token_hash,
      status = 'pending',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      stripe_checkout_session_id = null,
      stripe_payment_intent_id = null,
      paid_at = null,
      updated_at = now()
    where workspace_service_job_payments.status <> 'paid'
  `,await a`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
    ) values (
      ${c.workspaceId}::uuid,
      ${e}::uuid,
      'payment_link_created',
      'Customer payment link created.',
      jsonb_build_object('amount_minor', ${_}, 'currency', ${m}),
      ${c.userId}
    )
  `,`${t.replace(/\/$/,"")}/betala/${w}`}async function p(e){if(!e||e.length>200)return null;let t=(0,n.getSql)();if(!t)return null;let a=u(e),r=await t`
    select
      payment.id,
      payment.workspace_id,
      payment.service_job_id,
      payment.status,
      payment.amount_minor,
      payment.currency,
      payment.stripe_checkout_session_id,
      job.title,
      coalesce(settings.company_name, 'Proffera') as company_name,
      account.stripe_account_id,
      account.charges_enabled,
      account.payouts_enabled
    from workspace_service_job_payments payment
    join workspace_service_jobs job
      on job.id = payment.service_job_id
     and job.workspace_id = payment.workspace_id
    join workspace_payment_accounts account
      on account.workspace_id = payment.workspace_id
    left join workspace_settings settings
      on settings.workspace_id = payment.workspace_id
    where payment.token_hash = ${a}
      and payment.status in ('pending', 'paid')
    limit 1
  `;if(!r[0])return null;let s=r[0];return{id:String(s.id),workspaceId:String(s.workspace_id),serviceJobId:String(s.service_job_id),status:String(s.status),amountMinor:Number(s.amount_minor),currency:String(s.currency),checkoutSessionId:String(s.stripe_checkout_session_id??""),title:String(s.title??""),companyName:String(s.company_name??"Proffera"),stripeAccountId:String(s.stripe_account_id??""),accountReady:!!s.charges_enabled&&!!s.payouts_enabled}}async function _(e,t){if(!h.test(e))throw Error("invalid_payment");let a=(0,n.getSql)();if(!a)throw Error("database_unavailable");await a`
    update workspace_service_job_payments
    set stripe_checkout_session_id = ${t}, updated_at = now()
    where id = ${e}::uuid
      and status = 'pending'
  `}async function m(e){if(e.metadata?.payment_kind!=="service_job"||"paid"!==e.payment_status)return!1;let t=e.metadata.payment_request_id??"",a=e.metadata.workspace_id??"",r=e.metadata.service_job_id??"";if(!h.test(t)||!h.test(a)||!h.test(r))return!1;let s=(0,n.getSql)();if(!s)throw Error("database_unavailable");let i="string"==typeof e.payment_intent?e.payment_intent:e.payment_intent?.id??null;return!!(await s`
    update workspace_service_job_payments
    set
      status = 'paid',
      stripe_checkout_session_id = ${e.id},
      stripe_payment_intent_id = ${i},
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
    where id = ${t}::uuid
      and workspace_id = ${a}::uuid
      and service_job_id = ${r}::uuid
      and status = 'pending'
      and amount_minor = ${e.amount_total??-1}
      and lower(currency) = lower(${e.currency??""})
    returning id
  `)[0]&&(await s`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata
    ) values (
      ${a}::uuid,
      ${r}::uuid,
      'payment_paid',
      'Customer payment completed.',
      jsonb_build_object('checkout_session_id', ${e.id}, 'payment_intent_id', ${i})
    )
  `,!0)}e.s(["applyServiceJobCheckoutCompleted",0,m,"bindServiceJobCheckoutSession",0,_,"createWorkspaceServiceJobPaymentLink",0,l,"getPublicServiceJobPayment",0,p]),a()}catch(e){a(e)}},!1),799714,e=>e.a(async(t,a)=>{try{var r=e.i(89171),n=e.i(419455),s=t([n]);async function i(e){let t=new URL(e.url),a=e.headers.get("origin");if(a&&a!==t.origin)return r.NextResponse.json({error:"invalid_request"},{status:403});let s=await e.json().catch(()=>null),i="string"==typeof s?.jobId?s.jobId:"";try{let e=await (0,n.createWorkspaceServiceJobPaymentLink)(i,t.origin);return r.NextResponse.json({url:e},{headers:{"Cache-Control":"no-store"}})}catch(t){let e=t instanceof Error?t.message:"error";return r.NextResponse.json({error:e},{status:"forbidden"===e||"locked"===e?403:"already_paid"===e?409:400,headers:{"Cache-Control":"no-store"}})}}[n]=s.then?(await s)():s,e.s(["POST",0,i,"runtime",0,"nodejs"]),a()}catch(e){a(e)}},!1),449880,e=>e.a(async(t,a)=>{try{var r=e.i(747909),n=e.i(174017),s=e.i(996250),i=e.i(759756),o=e.i(561916),d=e.i(174677),c=e.i(869741),u=e.i(316795),l=e.i(487718),p=e.i(995169),_=e.i(47587),m=e.i(666012),h=e.i(570101),y=e.i(626937),w=e.i(10372),b=e.i(193695);e.i(820232);var v=e.i(600220),g=e.i(799714),x=t([g]);[g]=x.then?(await x)():x;let k=new r.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/dashboard/service-job-payments/route",pathname:"/api/dashboard/service-job-payments",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/dashboard/service-job-payments/route.ts",nextConfigOutput:"",userland:g,...{}}),{workAsyncStorage:j,workUnitAsyncStorage:R,serverHooks:S}=k;async function f(e,t,a){a.requestMeta&&(0,i.setRequestMeta)(e,a.requestMeta),k.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let r="/api/dashboard/service-job-payments/route";r=r.replace(/\/index$/,"")||"/";let s=await k.prepare(e,t,{srcPage:r,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:g,params:x,nextConfig:f,parsedUrl:j,isDraftMode:R,prerenderManifest:S,routerServerContext:E,isOnDemandRevalidate:C,revalidateOnlyGenerated:$,resolvedPathname:q,clientReferenceManifest:P,serverActionsManifest:A}=s,N=(0,c.normalizeAppPath)(r),I=!!(S.dynamicRoutes[N]||S.routes[q]),T=async()=>((null==E?void 0:E.render404)?await E.render404(e,t,j,!1):t.end("This page could not be found"),null);if(I&&!R){let e=!!S.routes[q],t=S.dynamicRoutes[N];if(t&&!1===t.fallback&&!e){if(f.adapterPath)return await T();throw new b.NoFallbackError}}let O=null;!I||k.isDev||R||(O=q,O="/index"===O?"/":O);let M=!0===k.isDev||!I,H=I&&!M;A&&P&&(0,d.setManifestsSingleton)({page:r,clientReferenceManifest:P,serverActionsManifest:A});let U=e.method||"GET",D=(0,o.getTracer)(),W=D.getActiveScopeSpan(),F=!!(null==E?void 0:E.isWrappedByNextServer),J=!!(0,i.getRequestMeta)(e,"minimalMode"),K=(0,i.getRequestMeta)(e,"incrementalCache")||await k.getIncrementalCache(e,f,S,J);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let L={params:x,previewProps:S.preview,renderOpts:{experimental:{authInterrupts:!!f.experimental.authInterrupts},cacheComponents:!!f.cacheComponents,supportsDynamicResponse:M,incrementalCache:K,cacheLifeProfiles:f.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,n)=>k.onRequestError(e,t,r,n,E)},sharedContext:{buildId:g}},B=new u.NodeNextRequest(e),G=new u.NodeNextResponse(t),V=l.NextRequestAdapter.fromNodeNextRequest(B,(0,l.signalFromNodeResponse)(t));try{let s,i=async e=>k.handle(V,L).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=D.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${U} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",n),s.updateName(t))}else e.updateName(`${U} ${r}`)}),d=async s=>{var o,d;let c=async({previousCacheEntry:n})=>{try{if(!J&&C&&$&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await i(s);e.fetchMetrics=L.renderOpts.fetchMetrics;let o=L.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let d=L.renderOpts.collectedTags;if(!I)return await (0,m.sendResponse)(B,G,r,L.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(r.headers);d&&(t[w.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==L.renderOpts.collectedRevalidate&&!(L.renderOpts.collectedRevalidate>=w.INFINITE_CACHE)&&L.renderOpts.collectedRevalidate,n=void 0===L.renderOpts.collectedExpire||L.renderOpts.collectedExpire>=w.INFINITE_CACHE?void 0:L.renderOpts.collectedExpire;return{value:{kind:v.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await k.onRequestError(e,t,{routerKind:"App Router",routePath:r,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:C})},!1,E),t}},u=await k.handleResponse({req:e,nextConfig:f,cacheKey:O,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:$,responseGenerator:c,waitUntil:a.waitUntil,isMinimalMode:J});if(!I)return null;if((null==u||null==(o=u.value)?void 0:o.kind)!==v.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(d=u.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});J||t.setHeader("x-nextjs-cache",C?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),R&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,h.fromNodeOutgoingHttpHeaders)(u.value.headers);return J&&I||l.delete(w.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,y.getCacheControlHeader)(u.cacheControl)),await (0,m.sendResponse)(B,G,new Response(u.value.body,{headers:l,status:u.value.status||200})),null};F&&W?await d(W):(s=D.getActiveScopeSpan(),await D.withPropagatedContext(e.headers,()=>D.trace(p.BaseServerSpan.handleRequest,{spanName:`${U} ${r}`,kind:o.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},d),void 0,!F))}catch(t){if(t instanceof b.NoFallbackError||await k.onRequestError(e,t,{routerKind:"App Router",routePath:N,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:C})},!1,E),I)throw t;return await (0,m.sendResponse)(B,G,new Response(null,{status:500})),null}}e.s(["handler",0,f,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:j,workUnitAsyncStorage:R})},"routeModule",0,k,"serverHooks",0,S,"workAsyncStorage",0,j,"workUnitAsyncStorage",0,R]),a()}catch(e){a(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-d~aaa._.js.map