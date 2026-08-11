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
    `}catch(e){throw await s.accounts.del(o.id).catch(()=>void 0),e}return o.id}e.s(["ensureWorkspaceStripeConnectAccount",0,n,"getWorkspacePaymentAccount",0,r])},173322,e=>{"use strict";e.s(["canCreateServiceJobPayment",0,function(e){return"cancelled"!==e.status&&Number.isInteger(e.totalMinor)&&Number(e.totalMinor)>0&&/^[A-Z]{3}$/.test(e.currency)}])},419455,e=>e.a(async(t,a)=>{try{var r=e.i(666680),n=e.i(276269),s=e.i(173322),i=e.i(141097),o=e.i(695478),c=e.i(644887),d=t([i,o]);[i,o]=d.then?(await d)():d;let h=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function u(e){return(0,r.createHash)("sha256").update(e).digest("hex")}async function l(e,t){if(!h.test(e))throw Error("invalid_job");let a=(0,n.getSql)(),d=await (0,o.getUserWorkspaceAccess)();if(!a||!d.ok||!(0,o.canManageWorkspaceSettings)(d))throw Error("forbidden");if(!await (0,i.hasWorkspaceFeature)("payments"))throw Error("locked");let l=await (0,c.getWorkspacePaymentAccount)(d.workspaceId);if(!l?.ready)throw Error("connect_not_ready");let p=(await a`
    select id, status, total_minor, currency
    from workspace_service_jobs
    where id = ${e}::uuid
      and workspace_id = ${d.workspaceId}::uuid
    limit 1
  `)[0],_=p?.total_minor===null||p?.total_minor===void 0?null:Number(p.total_minor),m=String(p?.currency??"");if(!p||!(0,s.canCreateServiceJobPayment)({status:String(p.status),totalMinor:_,currency:m}))throw Error("not_payable");let y=await a`
    select status
    from workspace_service_job_payments
    where workspace_id = ${d.workspaceId}::uuid
      and service_job_id = ${e}::uuid
    limit 1
  `;if("paid"===String(y[0]?.status??""))throw Error("already_paid");let w=(0,r.randomBytes)(32).toString("base64url"),b=u(w);return await a`
    insert into workspace_service_job_payments (
      workspace_id, service_job_id, token_hash, status, amount_minor, currency, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at, updated_at
    ) values (
      ${d.workspaceId}::uuid, ${e}::uuid, ${b}, 'pending', ${_}, ${m}, null, null, null, now(), now()
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
      ${d.workspaceId}::uuid,
      ${e}::uuid,
      'payment_link_created',
      'Customer payment link created.',
      jsonb_build_object('amount_minor', ${_}, 'currency', ${m}),
      ${d.userId}
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
  `,!0)}e.s(["applyServiceJobCheckoutCompleted",0,m,"bindServiceJobCheckoutSession",0,_,"createWorkspaceServiceJobPaymentLink",0,l,"getPublicServiceJobPayment",0,p]),a()}catch(e){a(e)}},!1),526954,e=>e.a(async(t,a)=>{try{var r=e.i(89171),n=e.i(8018),s=e.i(419455),i=t([s]);async function o(e){let t=await e.formData().catch(()=>null),a=String(t?.get("token")??""),i=await (0,s.getPublicServiceJobPayment)(a);if(!i||"pending"!==i.status||!i.accountReady)return r.NextResponse.json({error:"payment_unavailable"},{status:400});let o=(0,n.getStripeClient)();if(!o)return r.NextResponse.json({error:"stripe_unavailable"},{status:503});try{if(i.checkoutSessionId){let t=await o.checkout.sessions.retrieve(i.checkoutSessionId).catch(()=>null);if(t?.status==="open"&&t.url)return r.NextResponse.redirect(t.url,303);if(t?.status==="complete")return r.NextResponse.redirect(new URL(`/betala/${a}`,e.url),303)}let t=new URL(e.url).origin,n=await o.checkout.sessions.create({mode:"payment",line_items:[{quantity:1,price_data:{currency:i.currency.toLowerCase(),unit_amount:i.amountMinor,product_data:{name:i.title||"Service"}}}],client_reference_id:i.id,metadata:{payment_kind:"service_job",payment_request_id:i.id,workspace_id:i.workspaceId,service_job_id:i.serviceJobId},payment_intent_data:{transfer_data:{destination:i.stripeAccountId},metadata:{payment_kind:"service_job",payment_request_id:i.id,workspace_id:i.workspaceId,service_job_id:i.serviceJobId}},success_url:`${t}/betala/${a}?status=success`,cancel_url:`${t}/betala/${a}`});if(!n.url)return r.NextResponse.json({error:"checkout_unavailable"},{status:502});return await (0,s.bindServiceJobCheckoutSession)(i.id,n.id),r.NextResponse.redirect(n.url,303)}catch(e){return console.error("Failed to create service job checkout",e),r.NextResponse.json({error:"checkout_failed"},{status:500})}}[s]=i.then?(await i)():i,e.s(["POST",0,o,"runtime",0,"nodejs"]),a()}catch(e){a(e)}},!1),636067,e=>e.a(async(t,a)=>{try{var r=e.i(747909),n=e.i(174017),s=e.i(996250),i=e.i(759756),o=e.i(561916),c=e.i(174677),d=e.i(869741),u=e.i(316795),l=e.i(487718),p=e.i(995169),_=e.i(47587),m=e.i(666012),h=e.i(570101),y=e.i(626937),w=e.i(10372),b=e.i(193695);e.i(820232);var v=e.i(600220),k=e.i(526954),x=t([k]);[k]=x.then?(await x)():x;let g=new r.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/public/payments/checkout/route",pathname:"/api/public/payments/checkout",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/public/payments/checkout/route.ts",nextConfigOutput:"",userland:k,...{}}),{workAsyncStorage:R,workUnitAsyncStorage:j,serverHooks:S}=g;async function f(e,t,a){a.requestMeta&&(0,i.setRequestMeta)(e,a.requestMeta),g.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let r="/api/public/payments/checkout/route";r=r.replace(/\/index$/,"")||"/";let s=await g.prepare(e,t,{srcPage:r,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:k,params:x,nextConfig:f,parsedUrl:R,isDraftMode:j,prerenderManifest:S,routerServerContext:$,isOnDemandRevalidate:E,revalidateOnlyGenerated:C,resolvedPathname:q,clientReferenceManifest:P,serverActionsManifest:A}=s,I=(0,d.normalizeAppPath)(r),N=!!(S.dynamicRoutes[I]||S.routes[q]),T=async()=>((null==$?void 0:$.render404)?await $.render404(e,t,R,!1):t.end("This page could not be found"),null);if(N&&!j){let e=!!S.routes[q],t=S.dynamicRoutes[I];if(t&&!1===t.fallback&&!e){if(f.adapterPath)return await T();throw new b.NoFallbackError}}let O=null;!N||g.isDev||j||(O=q,O="/index"===O?"/":O);let M=!0===g.isDev||!N,U=N&&!M;A&&P&&(0,c.setManifestsSingleton)({page:r,clientReferenceManifest:P,serverActionsManifest:A});let H=e.method||"GET",D=(0,o.getTracer)(),J=D.getActiveScopeSpan(),F=!!(null==$?void 0:$.isWrappedByNextServer),W=!!(0,i.getRequestMeta)(e,"minimalMode"),L=(0,i.getRequestMeta)(e,"incrementalCache")||await g.getIncrementalCache(e,f,S,W);null==L||L.resetRequestCache(),globalThis.__incrementalCache=L;let K={params:x,previewProps:S.preview,renderOpts:{experimental:{authInterrupts:!!f.experimental.authInterrupts},cacheComponents:!!f.cacheComponents,supportsDynamicResponse:M,incrementalCache:L,cacheLifeProfiles:f.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,n)=>g.onRequestError(e,t,r,n,$)},sharedContext:{buildId:k}},B=new u.NodeNextRequest(e),G=new u.NodeNextResponse(t),V=l.NextRequestAdapter.fromNodeNextRequest(B,(0,l.signalFromNodeResponse)(t));try{let s,i=async e=>g.handle(V,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=D.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${H} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",n),s.updateName(t))}else e.updateName(`${H} ${r}`)}),c=async s=>{var o,c;let d=async({previousCacheEntry:n})=>{try{if(!W&&E&&C&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await i(s);e.fetchMetrics=K.renderOpts.fetchMetrics;let o=K.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let c=K.renderOpts.collectedTags;if(!N)return await (0,m.sendResponse)(B,G,r,K.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(r.headers);c&&(t[w.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=w.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,n=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=w.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:v.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await g.onRequestError(e,t,{routerKind:"App Router",routePath:r,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:E})},!1,$),t}},u=await g.handleResponse({req:e,nextConfig:f,cacheKey:O,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:E,revalidateOnlyGenerated:C,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:W});if(!N)return null;if((null==u||null==(o=u.value)?void 0:o.kind)!==v.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(c=u.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});W||t.setHeader("x-nextjs-cache",E?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),j&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,h.fromNodeOutgoingHttpHeaders)(u.value.headers);return W&&N||l.delete(w.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,y.getCacheControlHeader)(u.cacheControl)),await (0,m.sendResponse)(B,G,new Response(u.value.body,{headers:l,status:u.value.status||200})),null};F&&J?await c(J):(s=D.getActiveScopeSpan(),await D.withPropagatedContext(e.headers,()=>D.trace(p.BaseServerSpan.handleRequest,{spanName:`${H} ${r}`,kind:o.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},c),void 0,!F))}catch(t){if(t instanceof b.NoFallbackError||await g.onRequestError(e,t,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:E})},!1,$),N)throw t;return await (0,m.sendResponse)(B,G,new Response(null,{status:500})),null}}e.s(["handler",0,f,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:j})},"routeModule",0,g,"serverHooks",0,S,"workAsyncStorage",0,R,"workUnitAsyncStorage",0,j]),a()}catch(e){a(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__08x-r.a._.js.map