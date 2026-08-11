module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,r)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,r)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,r)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),r()}catch(e){r(e)}},!0),918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},446786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},921517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},912081,e=>{"use strict";e.s(["siteConfig",0,{name:"Proffera",description:"Proffera hjälper tjänsteföretag att visa tjänster, ta emot bokningar och offertförfrågningar och hantera kunder, uppdrag och uppföljning i ett tydligt arbetsflöde.",url:"https://proffera.se",primaryCta:"Starta gratis i 14 dagar",providerCta:"Se priser"}])},509742,e=>{"use strict";var t=e.i(276269),r=e.i(666680),a=e.i(912081);let n=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,i=process.env.SERVICE_AI_CHAT_BRIDGE_URL?.trim()||"",s=process.env.SERVICE_AI_CHAT_INTEGRATION_SECRET?.trim()||"",o=process.env.SERVICE_AI_CHAT_ORIGIN?.trim().replace(/\/$/,"")||"https://chat.proffera.se";function d(e){return null==e?"":String(e)}function c(e){return"active"===e||"suspended"===e?e:null}async function l(e){if(!(i&&s))return{ok:!1,code:"not_configured",data:null};let t=JSON.stringify(e),a=new Date().toISOString();try{let e=await fetch(i,{method:"POST",headers:{"content-type":"application/json","x-proffera-timestamp":a,"x-proffera-signature":(0,r.createHmac)("sha256",s).update(`${a}.${t}`).digest("hex")},body:t,cache:"no-store"}),n=await e.json().catch(()=>({}));if(!e.ok)return{ok:!1,code:d(n.error)||`remote_${e.status}`,data:n};return{ok:!0,code:null,data:n}}catch(e){return console.error("Service AI Chat bridge request failed",e),{ok:!1,code:"network_error",data:null}}}async function u(e){let r=(0,t.getSql)();if(!r||!n.test(e))return null;let i=(await r`
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
  `)[0],s=d(i?.name).trim(),o=d(i?.owner_email).trim().toLowerCase(),c=d(i?.public_booking_slug).trim(),l=a.siteConfig.url.replace(/^https?:\/\/(?:www\.)?/,"https://www.").replace(/\/$/,""),u=c?`${l}/boka/${encodeURIComponent(c)}`:l;return s&&o?{name:s,ownerEmail:o,bookingUrl:u}:null}async function p(e){let r=(0,t.getSql)();if(!r||!n.test(e))return{databaseReady:!1,tenantId:null,clientId:null,lifecycle:null,lastErrorCode:null};try{let t=(await r`
      select remote_tenant_id, remote_client_id, lifecycle_state, last_error_code
      from workspace_ai_chat_integrations
      where workspace_id = ${e}::uuid
      limit 1
    `)[0];return{databaseReady:!0,tenantId:d(t?.remote_tenant_id)||null,clientId:d(t?.remote_client_id)||null,lifecycle:c(t?.lifecycle_state),lastErrorCode:d(t?.last_error_code)||null}}catch(e){return console.error("Failed to read AI Chat integration",e),{databaseReady:!1,tenantId:null,clientId:null,lifecycle:null,lastErrorCode:null}}}async function _(e){let r=(0,t.getSql)();if(!r||!n.test(e.workspaceId))return{ok:!1,code:"database"};let a=await p(e.workspaceId);if(!e.enabled&&!a.tenantId)return{ok:!0,skipped:!0};let i=await u(e.workspaceId);if(!i)return{ok:!1,code:"workspace_identity"};let s=e.enabled?"active":"suspended",o=await l({action:"provision",workspaceId:e.workspaceId,workspaceName:i.name,ownerEmail:i.ownerEmail,website:i.bookingUrl,lifecycle:s});if(!o.ok)return await r`
      update workspace_ai_chat_integrations
      set last_error_code = ${o.code}, updated_at = now()
      where workspace_id = ${e.workspaceId}::uuid
    `,{ok:!1,code:o.code};let _=d(o.data.tenantId),w=d(o.data.clientId),m=c(o.data.lifecycle);return _&&w&&m?(await r`
    insert into workspace_ai_chat_integrations (
      workspace_id, remote_tenant_id, remote_client_id, lifecycle_state, last_synced_at, last_error_code, created_at, updated_at
    ) values (
      ${e.workspaceId}::uuid, ${_}, ${w}, ${m}, now(), null, now(), now()
    )
    on conflict (workspace_id)
    do update set
      remote_tenant_id = excluded.remote_tenant_id,
      remote_client_id = excluded.remote_client_id,
      lifecycle_state = excluded.lifecycle_state,
      last_synced_at = now(),
      last_error_code = null,
      updated_at = now()
  `,{ok:!0,tenantId:_,lifecycle:m}):{ok:!1,code:"invalid_remote_response"}}async function w(e){let t=await p(e);if(!t.tenantId||"active"!==t.lifecycle)return null;let r=await l({action:"activation_link",workspaceId:e}),a=r.ok?d(r.data.token):"",n=r.ok?d(r.data.expiresAt):"";return a&&n?`${o}/activate/proffera?token=${encodeURIComponent(a)}`:null}e.s(["createWorkspaceAiChatActivationUrl",0,w,"syncWorkspaceAiChat",0,_],509742)},644887,e=>{"use strict";var t=e.i(276269),r=e.i(8018);async function a(e){var r;let a,n,i=(0,t.getSql)();if(!i)return null;let s=await i`
    select stripe_account_id, details_submitted, charges_enabled, payouts_enabled
    from workspace_payment_accounts
    where workspace_id = ${e}::uuid
    limit 1
  `;return s[0]?(a=!!(r=s[0]).charges_enabled,n=!!r.payouts_enabled,{stripeAccountId:String(r.stripe_account_id??""),detailsSubmitted:!!r.details_submitted,chargesEnabled:a,payoutsEnabled:n,ready:a&&n}):null}async function n(e){let n=(0,t.getSql)(),i=(0,r.getStripeClient)();if(!n||!i)throw Error("Stripe Connect is not configured");let s=await a(e);if(s?.stripeAccountId)return s.stripeAccountId;let o=await i.accounts.create({type:"express",capabilities:{card_payments:{requested:!0},transfers:{requested:!0}},metadata:{workspace_id:e}});try{await n`
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
    `}catch(e){throw await i.accounts.del(o.id).catch(()=>void 0),e}return o.id}e.s(["ensureWorkspaceStripeConnectAccount",0,n,"getWorkspacePaymentAccount",0,a])},173322,e=>{"use strict";e.s(["canCreateServiceJobPayment",0,function(e){return"cancelled"!==e.status&&Number.isInteger(e.totalMinor)&&Number(e.totalMinor)>0&&/^[A-Z]{3}$/.test(e.currency)}])},419455,e=>e.a(async(t,r)=>{try{var a=e.i(666680),n=e.i(276269),i=e.i(173322),s=e.i(141097),o=e.i(695478),d=e.i(644887),c=t([s,o]);[s,o]=c.then?(await c)():c;let m=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function l(e){return(0,a.createHash)("sha256").update(e).digest("hex")}async function u(e,t){if(!m.test(e))throw Error("invalid_job");let r=(0,n.getSql)(),c=await (0,o.getUserWorkspaceAccess)();if(!r||!c.ok||!(0,o.canManageWorkspaceSettings)(c))throw Error("forbidden");if(!await (0,s.hasWorkspaceFeature)("payments"))throw Error("locked");let u=await (0,d.getWorkspacePaymentAccount)(c.workspaceId);if(!u?.ready)throw Error("connect_not_ready");let p=(await r`
    select id, status, total_minor, currency
    from workspace_service_jobs
    where id = ${e}::uuid
      and workspace_id = ${c.workspaceId}::uuid
    limit 1
  `)[0],_=p?.total_minor===null||p?.total_minor===void 0?null:Number(p.total_minor),w=String(p?.currency??"");if(!p||!(0,i.canCreateServiceJobPayment)({status:String(p.status),totalMinor:_,currency:w}))throw Error("not_payable");let h=await r`
    select status
    from workspace_service_job_payments
    where workspace_id = ${c.workspaceId}::uuid
      and service_job_id = ${e}::uuid
    limit 1
  `;if("paid"===String(h[0]?.status??""))throw Error("already_paid");let y=(0,a.randomBytes)(32).toString("base64url"),f=l(y);return await r`
    insert into workspace_service_job_payments (
      workspace_id, service_job_id, token_hash, status, amount_minor, currency, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at, updated_at
    ) values (
      ${c.workspaceId}::uuid, ${e}::uuid, ${f}, 'pending', ${_}, ${w}, null, null, null, now(), now()
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
  `,await r`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
    ) values (
      ${c.workspaceId}::uuid,
      ${e}::uuid,
      'payment_link_created',
      'Customer payment link created.',
      jsonb_build_object('amount_minor', ${_}, 'currency', ${w}),
      ${c.userId}
    )
  `,`${t.replace(/\/$/,"")}/betala/${y}`}async function p(e){if(!e||e.length>200)return null;let t=(0,n.getSql)();if(!t)return null;let r=l(e),a=await t`
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
    where payment.token_hash = ${r}
      and payment.status in ('pending', 'paid')
    limit 1
  `;if(!a[0])return null;let i=a[0];return{id:String(i.id),workspaceId:String(i.workspace_id),serviceJobId:String(i.service_job_id),status:String(i.status),amountMinor:Number(i.amount_minor),currency:String(i.currency),checkoutSessionId:String(i.stripe_checkout_session_id??""),title:String(i.title??""),companyName:String(i.company_name??"Proffera"),stripeAccountId:String(i.stripe_account_id??""),accountReady:!!i.charges_enabled&&!!i.payouts_enabled}}async function _(e,t){if(!m.test(e))throw Error("invalid_payment");let r=(0,n.getSql)();if(!r)throw Error("database_unavailable");await r`
    update workspace_service_job_payments
    set stripe_checkout_session_id = ${t}, updated_at = now()
    where id = ${e}::uuid
      and status = 'pending'
  `}async function w(e){if(e.metadata?.payment_kind!=="service_job"||"paid"!==e.payment_status)return!1;let t=e.metadata.payment_request_id??"",r=e.metadata.workspace_id??"",a=e.metadata.service_job_id??"";if(!m.test(t)||!m.test(r)||!m.test(a))return!1;let i=(0,n.getSql)();if(!i)throw Error("database_unavailable");let s="string"==typeof e.payment_intent?e.payment_intent:e.payment_intent?.id??null;return!!(await i`
    update workspace_service_job_payments
    set
      status = 'paid',
      stripe_checkout_session_id = ${e.id},
      stripe_payment_intent_id = ${s},
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
    where id = ${t}::uuid
      and workspace_id = ${r}::uuid
      and service_job_id = ${a}::uuid
      and status = 'pending'
      and amount_minor = ${e.amount_total??-1}
      and lower(currency) = lower(${e.currency??""})
    returning id
  `)[0]&&(await i`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata
    ) values (
      ${r}::uuid,
      ${a}::uuid,
      'payment_paid',
      'Customer payment completed.',
      jsonb_build_object('checkout_session_id', ${e.id}, 'payment_intent_id', ${s})
    )
  `,!0)}e.s(["applyServiceJobCheckoutCompleted",0,w,"bindServiceJobCheckoutSession",0,_,"createWorkspaceServiceJobPaymentLink",0,u,"getPublicServiceJobPayment",0,p]),r()}catch(e){r(e)}},!1),101390,e=>{"use strict";var t=e.i(276269),r=e.i(509742);let a=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function n(e,n,i,s){var o,d;let c=(0,t.getSql)(),l=e.metadata.workspace_id?.trim()??"",u=e.items.data[0],p=u?.price.id??"";if(!c||!a.test(l)||p!==s)return{ok:!1,code:"ignored"};let _="active"===(o=e.status)||"trialing"===o||"past_due"===o||"paused"===o?o:"canceled"===o||"incomplete_expired"===o?"cancelled":"past_due",w="active"===_||"trialing"===_,m=w&&"professional"===i,h=(d=e.customer)?"string"==typeof d?d:d.id:null,y=u?.current_period_start??e.current_period_start,f=u?.current_period_end??e.current_period_end,k=y?new Date(1e3*y).toISOString():null,b=f?new Date(1e3*f).toISOString():null;try{let t=await c`
      with permitted_event as (
        select 1
        where coalesce((
          select last_event_created
          from workspace_billing_subscriptions
          where workspace_id = ${l}::uuid
        ), 0) <= ${n}
      ),
      selected_workspace as (
        select id
        from workspaces
        where id = ${l}::uuid
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
          plan_key = ${i},
          status = ${_},
          current_period_start = ${k},
          current_period_end = ${b},
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
          gen_random_uuid(), sw.id, ${i}, ${_}, ${k}, ${b}, now(), now()
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
          ${h},
          ${e.id},
          ${p},
          ${_},
          ${e.cancel_at_period_end},
          ${k},
          ${b},
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
          ('booking_demo', ${w}::boolean),
          ('crm_customers', ${m}::boolean),
          ('lead_inbox', ${w}::boolean),
          ('ai_assistant', ${m}::boolean)
      )
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), bu.workspace_id, fv.feature_key, fv.enabled, now(), now()
      from billing_upsert bu
      cross join feature_values fv
      on conflict (workspace_id, feature_key)
      do update set enabled = excluded.enabled, updated_at = now()
      returning workspace_id
    `;if(0===t.length)return{ok:!1,code:"stale"};try{let e=await (0,r.syncWorkspaceAiChat)({workspaceId:l,enabled:m});e.ok||console.error("Failed to synchronise AI Chat entitlement",{workspaceId:l,code:e.code})}catch(e){console.error("AI Chat entitlement synchronisation crashed",{workspaceId:l,error:e})}return{ok:!0}}catch(e){return console.error("Failed to sync Stripe subscription",e),{ok:!1,code:"database"}}}e.s(["syncWorkspaceSubscription",0,n])},250842,e=>e.a(async(t,r)=>{try{var a=e.i(89171),n=e.i(8018),i=e.i(101390),s=e.i(419455),o=t([s]);[s]=o.then?(await o)():o;let c=new Set(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"]);async function d(e){let t,r,o=(0,n.getStripeClient)(),d=(0,n.getStripeWebhookSecret)(),l=e.headers.get("stripe-signature");if(!o||!d||!l)return a.NextResponse.json({error:"Webhook är inte konfigurerad."},{status:503});try{t=await o.webhooks.constructEventAsync(await e.text(),l,d)}catch(e){return console.error("Stripe webhook signature verification failed",e),a.NextResponse.json({error:"Ogiltig signatur."},{status:400})}if("checkout.session.completed"===t.type)try{let e=await (0,s.applyServiceJobCheckoutCompleted)(t.data.object);return a.NextResponse.json({received:!0,applied:e})}catch(e){return console.error("Failed to apply service job payment",e),a.NextResponse.json({error:"Kundbetalningen kunde inte sparas."},{status:500})}if(!c.has(t.type))return a.NextResponse.json({received:!0});let u=t.data.object;try{r=await o.subscriptions.retrieve(u.id)}catch(e){return console.error("Failed to retrieve current Stripe subscription state",e),a.NextResponse.json({error:"Stripe-abonnemanget kunde inte läsas."},{status:502})}let p=r.items.data[0]?.price.id??"",_=(0,n.getStripeCheckoutPlanForPriceId)(p);if(!_)return a.NextResponse.json({received:!0,applied:!1});let w=await (0,i.syncWorkspaceSubscription)(r,t.created,_,p);return w.ok||"database"!==w.code?a.NextResponse.json({received:!0,applied:w.ok}):a.NextResponse.json({error:"Databasen kunde inte uppdateras."},{status:500})}e.s(["POST",0,d,"runtime",0,"nodejs"]),r()}catch(e){r(e)}},!1),951743,e=>e.a(async(t,r)=>{try{var a=e.i(747909),n=e.i(174017),i=e.i(996250),s=e.i(759756),o=e.i(561916),d=e.i(174677),c=e.i(869741),l=e.i(316795),u=e.i(487718),p=e.i(995169),_=e.i(47587),w=e.i(666012),m=e.i(570101),h=e.i(626937),y=e.i(10372),f=e.i(193695);e.i(820232);var k=e.i(600220),b=e.i(250842),g=t([b]);[b]=g.then?(await g)():g;let x=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/stripe/webhook/route",pathname:"/api/stripe/webhook",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/stripe/webhook/route.ts",nextConfigOutput:"",userland:b,...{}}),{workAsyncStorage:$,workUnitAsyncStorage:S,serverHooks:R}=x;async function v(e,t,r){r.requestMeta&&(0,s.setRequestMeta)(e,r.requestMeta),x.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/stripe/webhook/route";a=a.replace(/\/index$/,"")||"/";let i=await x.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:b,params:g,nextConfig:v,parsedUrl:$,isDraftMode:S,prerenderManifest:R,routerServerContext:j,isOnDemandRevalidate:C,revalidateOnlyGenerated:I,resolvedPathname:E,clientReferenceManifest:A,serverActionsManifest:q}=i,P=(0,c.normalizeAppPath)(a),N=!!(R.dynamicRoutes[P]||R.routes[E]),T=async()=>((null==j?void 0:j.render404)?await j.render404(e,t,$,!1):t.end("This page could not be found"),null);if(N&&!S){let e=!!R.routes[E],t=R.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(v.adapterPath)return await T();throw new f.NoFallbackError}}let O=null;!N||x.isDev||S||(O=E,O="/index"===O?"/":O);let H=!0===x.isDev||!N,U=N&&!H;q&&A&&(0,d.setManifestsSingleton)({page:a,clientReferenceManifest:A,serverActionsManifest:q});let M=e.method||"GET",D=(0,o.getTracer)(),W=D.getActiveScopeSpan(),F=!!(null==j?void 0:j.isWrappedByNextServer),J=!!(0,s.getRequestMeta)(e,"minimalMode"),K=(0,s.getRequestMeta)(e,"incrementalCache")||await x.getIncrementalCache(e,v,R,J);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let B={params:g,previewProps:R.preview,renderOpts:{experimental:{authInterrupts:!!v.experimental.authInterrupts},cacheComponents:!!v.cacheComponents,supportsDynamicResponse:H,incrementalCache:K,cacheLifeProfiles:v.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>x.onRequestError(e,t,a,n,j)},sharedContext:{buildId:b}},L=new l.NodeNextRequest(e),G=new l.NodeNextResponse(t),V=u.NextRequestAdapter.fromNodeNextRequest(L,(0,u.signalFromNodeResponse)(t));try{let i,s=async e=>x.handle(V,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=D.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${M} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),i&&i!==e&&(i.setAttribute("http.route",n),i.updateName(t))}else e.updateName(`${M} ${a}`)}),d=async i=>{var o,d;let c=async({previousCacheEntry:n})=>{try{if(!J&&C&&I&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await s(i);e.fetchMetrics=B.renderOpts.fetchMetrics;let o=B.renderOpts.pendingWaitUntil;o&&r.waitUntil&&(r.waitUntil(o),o=void 0);let d=B.renderOpts.collectedTags;if(!N)return await (0,w.sendResponse)(L,G,a,B.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(a.headers);d&&(t[y.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,n=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:k.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await x.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:C})},!1,j),t}},l=await x.handleResponse({req:e,nextConfig:v,cacheKey:O,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:R,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:I,responseGenerator:c,waitUntil:r.waitUntil,isMinimalMode:J});if(!N)return null;if((null==l||null==(o=l.value)?void 0:o.kind)!==k.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(d=l.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});J||t.setHeader("x-nextjs-cache",C?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,m.fromNodeOutgoingHttpHeaders)(l.value.headers);return J&&N||u.delete(y.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,h.getCacheControlHeader)(l.cacheControl)),await (0,w.sendResponse)(L,G,new Response(l.value.body,{headers:u,status:l.value.status||200})),null};F&&W?await d(W):(i=D.getActiveScopeSpan(),await D.withPropagatedContext(e.headers,()=>D.trace(p.BaseServerSpan.handleRequest,{spanName:`${M} ${a}`,kind:o.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},d),void 0,!F))}catch(t){if(t instanceof f.NoFallbackError||await x.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:C})},!1,j),N)throw t;return await (0,w.sendResponse)(L,G,new Response(null,{status:500})),null}}e.s(["handler",0,v,"patchFetch",0,function(){return(0,i.patchFetch)({workAsyncStorage:$,workUnitAsyncStorage:S})},"routeModule",0,x,"serverHooks",0,R,"workAsyncStorage",0,$,"workUnitAsyncStorage",0,S]),r()}catch(e){r(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0_202v4._.js.map