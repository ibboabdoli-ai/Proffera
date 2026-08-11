module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},708174,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation>","default")},990697,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs","default")},653808,a=>{"use strict";a.i(708174);var b=a.i(990697);a.n(b)},892277,a=>{"use strict";var b=a.i(800717);let c=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var d=a.i(653808);a.s(["default",0,(a,e)=>{let f=(0,b.forwardRef)(({className:f,...g},h)=>(0,b.createElement)(d.default,{ref:h,iconNode:e,className:((...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim())(`lucide-${c(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,f),...g}));return f.displayName=c(a),f}],892277)},295946,a=>{"use strict";var b=a.i(546767);let c=(0,a.i(612147).resolveDatabaseUrl)();a.s(["getSql",0,function(){return c?(0,b.neon)(c):null}])},188506,a=>{"use strict";let b={starter:1,professional:2,business:3};function c(a){return"starter"===a||"professional"===a||"business"===a?a:null}a.s(["isWorkspacePlanFeatureIncluded",0,function(a){let d=c(a.planKey),e=c(a.minimumPlan)??"starter",f=String(a.planStatus??"");if("trialing"===f){if(!a.planPeriodEnd)return!1;let b=new Date(String(a.planPeriodEnd));return!Number.isNaN(b.getTime())&&b.getTime()>(a.now??new Date).getTime()}return!!(d&&"active"===f&&b[d]>=b[e])},"normalizeWorkspacePlan",0,c])},359920,a=>{"use strict";a.s(["resolveWorkspaceFeatureAccess",0,function(a){return!0===a.adminOverrideEnabled?{hasAccess:!0,accessState:"included"}:!1===a.adminOverrideEnabled||!a.workspaceEnabled&&(a.includedInPlan||a.trialActive)?{hasAccess:!1,accessState:"disabled"}:a.includedInPlan&&a.workspaceEnabled?{hasAccess:!0,accessState:"included"}:a.trialActive&&a.workspaceEnabled?{hasAccess:!0,accessState:"trial"}:{hasAccess:!1,accessState:"locked"}}])},121573,a=>a.a(async(b,c)=>{try{var d=a.i(295946),e=a.i(188506),f=a.i(359920),g=a.i(87921),h=b([g]);async function i(){let a=(0,d.getSql)(),b=await (0,g.getUserWorkspaceAccess)();if(!a||!b.ok)return[];let c=await a`
    with latest_plan as (
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = ${b.workspaceId}::uuid
      order by created_at desc
      limit 1
    )
    select c.feature_key, c.name, c.description, c.minimum_plan, c.trial_days,
      coalesce(f.enabled, false) as workspace_enabled,
      o.enabled as admin_override_enabled,
      p.plan_key, p.status as plan_status, p.current_period_end as plan_period_end,
      t.status as trial_status, t.ends_at as trial_ends_at,
      (t.workspace_id is not null) as trial_consumed
    from feature_catalog c
    left join workspace_feature_flags f
      on f.workspace_id = ${b.workspaceId}::uuid and f.feature_key = c.feature_key
    left join workspace_feature_overrides o
      on o.workspace_id = ${b.workspaceId}::uuid and o.feature_key = c.feature_key
    left join latest_plan p on true
    left join workspace_feature_trials t
      on t.workspace_id = ${b.workspaceId}::uuid and t.feature_key = c.feature_key
    where c.is_active = true
    order by c.minimum_plan, c.name
  `,h=new Date;return c.map(a=>{let b=(0,e.normalizeWorkspacePlan)(a.plan_key),c=(0,e.normalizeWorkspacePlan)(a.minimum_plan)??"starter",d=(0,e.isWorkspacePlanFeatureIncluded)({planKey:a.plan_key,planStatus:a.plan_status,planPeriodEnd:a.plan_period_end,minimumPlan:a.minimum_plan,now:h}),g=a.trial_ends_at?new Date(String(a.trial_ends_at)).toISOString():null,i="active"===String(a.trial_status??"")&&!!g&&new Date(g).getTime()>h.getTime(),j=!!a.workspace_enabled,k=null===a.admin_override_enabled||void 0===a.admin_override_enabled?null:!!a.admin_override_enabled,{hasAccess:l,accessState:m}=(0,f.resolveWorkspaceFeatureAccess)({includedInPlan:d,trialActive:i,workspaceEnabled:j,adminOverrideEnabled:k});return{featureKey:String(a.feature_key),name:String(a.name),description:String(a.description),minimumPlan:c,trialDays:Number(a.trial_days)||0,workspaceEnabled:j,adminOverrideEnabled:k,planKey:b,planStatus:a.plan_status?String(a.plan_status):null,trialStatus:a.trial_status?String(a.trial_status):null,trialEndsAt:g,accessState:m,hasAccess:l,canStartTrial:null===k&&!d&&!a.trial_consumed&&Number(a.trial_days)>0}})}async function j(a){return(await i()).some(b=>b.featureKey===a&&b.hasAccess)}async function k(a,b){let c=(0,d.getSql)(),e=await (0,g.getUserWorkspaceAccess)();if(!c||!e.ok||!(0,g.canManageWorkspaceSettings)(e))throw Error("Owner or admin access required");if(!(await c`select feature_key from feature_catalog where feature_key = ${a} and is_active = true limit 1`)[0])throw Error("Unknown feature");await c`
    insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
    values (gen_random_uuid(), ${e.workspaceId}::uuid, ${a}, ${b}, now(), now())
    on conflict (workspace_id, feature_key) do update set enabled = excluded.enabled, updated_at = now()
  `}async function l(a){let b=(0,d.getSql)(),c=await (0,g.getUserWorkspaceAccess)();if(!b||!c.ok||!(0,g.canManageWorkspaceSettings)(c))throw Error("Owner or admin access required");let e=await b`select trial_days from feature_catalog where feature_key = ${a} and is_active = true limit 1`,f=Number(e[0]?.trial_days??0);if(f<=0)throw Error("Trial unavailable");if(!(await b`
    insert into workspace_feature_trials (workspace_id, feature_key, status, started_at, ends_at, created_at, updated_at)
    values (${c.workspaceId}::uuid, ${a}, 'active', now(), now() + (${f} || ' days')::interval, now(), now())
    on conflict (workspace_id, feature_key) do nothing
    returning feature_key
  `)[0])throw Error("Trial already used");await k(a,!0)}[g]=h.then?(await h)():h,a.s(["getWorkspaceEntitlements",0,i,"hasWorkspaceFeature",0,j,"setWorkspaceFeatureEnabled",0,k,"startWorkspaceFeatureTrial",0,l]),c()}catch(a){c(a)}},!1),672607,a=>{"use strict";let b=(0,a.i(892277).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",0,b],672607)},522734,(a,b,c)=>{b.exports=a.x("fs",()=>require("fs"))},446786,(a,b,c)=>{b.exports=a.x("os",()=>require("os"))},427699,(a,b,c)=>{b.exports=a.x("events",()=>require("events"))},254799,(a,b,c)=>{b.exports=a.x("crypto",()=>require("crypto"))},921517,(a,b,c)=>{b.exports=a.x("http",()=>require("http"))},524836,(a,b,c)=>{b.exports=a.x("https",()=>require("https"))},929579,a=>{"use strict";let b=["starter","professional"],c={starter:{SEK:{sv:"Från 299 kr/mån",en:"From SEK 299/month"},EUR:{sv:"Från 28 €/mån",en:"From €28/month"},GBP:{sv:"Från £24/mån",en:"From £24/month"}},professional:{SEK:{sv:"Från 699 kr/mån",en:"From SEK 699/month"},EUR:{sv:"Från 64 €/mån",en:"From €64/month"},GBP:{sv:"Från £55/mån",en:"From £55/month"}}};a.s(["checkoutPlanDefinitions",0,{starter:{key:"starter",name:"Starter",priceLabel:"Från 299 kr/mån",description:"Bokning, kontaktformulär och grundläggande leadlista."},professional:{key:"professional",name:"Professional",priceLabel:"Från 699 kr/mån",description:"Allt i Starter samt CRM och en samlad kundöversikt."}},"checkoutPlanKeys",0,b,"getCheckoutPlanPriceLabel",0,function(a,b,d){return c[a][b][d]},"isCheckoutPlanKey",0,function(a){return"string"==typeof a&&b.includes(a)}])},290025,a=>{"use strict";let b=(0,a.i(892277).default)("credit-card",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]);a.s(["CreditCard",0,b],290025)},659403,a=>{"use strict";var b=a.i(295946),c=a.i(496011);function d(a){let b=!!a.charges_enabled,c=!!a.payouts_enabled;return{stripeAccountId:String(a.stripe_account_id??""),detailsSubmitted:!!a.details_submitted,chargesEnabled:b,payoutsEnabled:c,ready:b&&c}}async function e(a){let c=(0,b.getSql)();if(!c)return null;let e=await c`
    select stripe_account_id, details_submitted, charges_enabled, payouts_enabled
    from workspace_payment_accounts
    where workspace_id = ${a}::uuid
    limit 1
  `;return e[0]?d(e[0]):null}async function f(a){let f=(0,b.getSql)(),g=(0,c.getStripeClient)();if(!f||!g)return null;let h=await e(a);if(!h?.stripeAccountId)return null;let i=await g.accounts.retrieve(h.stripeAccountId),j=await f`
    update workspace_payment_accounts
    set
      details_submitted = ${i.details_submitted},
      charges_enabled = ${i.charges_enabled},
      payouts_enabled = ${i.payouts_enabled},
      updated_at = now()
    where workspace_id = ${a}::uuid
      and stripe_account_id = ${i.id}
    returning stripe_account_id, details_submitted, charges_enabled, payouts_enabled
  `;return j[0]?d(j[0]):null}a.s(["getWorkspacePaymentAccount",0,e,"syncWorkspaceStripeConnectAccount",0,f])},352937,a=>a.a(async(b,c)=>{try{var d=a.i(666680),e=a.i(295946),f=a.i(121573),g=a.i(87921);a.i(659403);var h=b([f,g]);async function i(a){let b=(0,e.getSql)();return b?(await b`
    select
      job.id,
      job.title,
      coalesce(customer.name, '') as customer_name,
      job.status,
      job.total_minor,
      job.currency,
      coalesce(payment.status, '') as payment_status
    from workspace_service_jobs job
    left join customers customer
      on customer.id = job.customer_id
     and customer.workspace_id = job.workspace_id::text
    left join workspace_service_job_payments payment
      on payment.workspace_id = job.workspace_id
     and payment.service_job_id = job.id
    where job.workspace_id = ${a}::uuid
      and job.status <> 'cancelled'
      and job.total_minor is not null
      and job.total_minor > 0
      and job.currency ~ '^[A-Z]{3}$'
    order by case when payment.status = 'paid' then 1 else 0 end, job.updated_at desc
    limit 50
  `).map(a=>({id:String(a.id),title:String(a.title??""),customerName:String(a.customer_name??""),status:String(a.status??""),totalMinor:Number(a.total_minor),currency:String(a.currency??""),paymentStatus:String(a.payment_status??"")})):[]}async function j(a){if(!a||a.length>200)return null;let b=(0,e.getSql)();if(!b)return null;let c=(0,d.createHash)("sha256").update(a).digest("hex"),f=await b`
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
    where payment.token_hash = ${c}
      and payment.status in ('pending', 'paid')
    limit 1
  `;if(!f[0])return null;let g=f[0];return{id:String(g.id),workspaceId:String(g.workspace_id),serviceJobId:String(g.service_job_id),status:String(g.status),amountMinor:Number(g.amount_minor),currency:String(g.currency),checkoutSessionId:String(g.stripe_checkout_session_id??""),title:String(g.title??""),companyName:String(g.company_name??"Proffera"),stripeAccountId:String(g.stripe_account_id??""),accountReady:!!g.charges_enabled&&!!g.payouts_enabled}}[f,g]=h.then?(await h)():h,a.s(["getPayableWorkspaceServiceJobs",0,i,"getPublicServiceJobPayment",0,j]),c()}catch(a){c(a)}},!1),360331,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(672607),f=a.i(290025);a.i(570396);var g=a.i(673727),h=a.i(352937),i=b([h]);async function j({params:a}){var b,c;let{token:i}=await a,k=await (0,h.getPublicServiceJobPayment)(i);k||(0,g.notFound)();let l="paid"===k.status;return(0,d.jsx)("main",{className:"min-h-screen bg-[#f4f6f2] px-4 py-10 text-[#17201a]",children:(0,d.jsxs)("section",{className:"mx-auto max-w-xl rounded-[28px] border border-[#dde5dc] bg-white p-6 shadow-sm sm:p-8",children:[(0,d.jsx)("p",{className:"text-xs font-black uppercase tracking-[0.16em] text-[#68736b]",children:k.companyName}),(0,d.jsx)("h1",{className:"mt-2 text-3xl font-black",children:"Betalning"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-6 text-[#5c675f]",children:k.title}),(0,d.jsxs)("div",{className:"mt-6 rounded-2xl bg-[#f7f9f6] p-5",children:[(0,d.jsx)("p",{className:"text-xs font-black uppercase tracking-wide text-[#788279]",children:"Att betala"}),(0,d.jsx)("p",{className:"mt-2 text-3xl font-black",children:(b=k.amountMinor,c=k.currency,new Intl.NumberFormat("sv-SE",{style:"currency",currency:c}).format(b/100))})]}),l?(0,d.jsxs)("div",{className:"mt-6 flex items-center gap-3 rounded-2xl bg-[#e9f2ec] p-4 font-bold text-[#17452f]",children:[(0,d.jsx)(e.CheckCircle2,{className:"h-5 w-5"}),"Betalningen är mottagen."]}):k.accountReady?(0,d.jsxs)("form",{method:"post",action:"/api/public/payments/checkout",className:"mt-6",children:[(0,d.jsx)("input",{type:"hidden",name:"token",value:i}),(0,d.jsxs)("button",{type:"submit",className:"inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 py-3 font-bold text-white",children:[(0,d.jsx)(f.CreditCard,{className:"h-5 w-5"}),"Betala säkert med Stripe"]})]}):(0,d.jsx)("p",{className:"mt-6 rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b]",children:"Betalningen är tillfälligt otillgänglig. Kontakta företaget."}),(0,d.jsx)("p",{className:"mt-6 text-xs leading-5 text-[#788279]",children:"Betalningen hanteras av Stripe. Proffera lagrar inte dina kortuppgifter."})]})})}[h]=i.then?(await i)():i,a.s(["default",0,j,"dynamic",0,"force-dynamic"]),c()}catch(a){c(a)}},!1),891583,a=>{a.n(a.i(360331))},577062,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_memory-adapter_dist_index_mjs_0ptlb60._.js"].map(b=>a.l(b))).then(()=>b(17616)))},860484,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_01xuj8~._.js"].map(b=>a.l(b))).then(()=>b(536063)))},580632,a=>{a.v(a=>Promise.resolve().then(()=>a(270406)))},564133,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0c3cy-j._.js"].map(b=>a.l(b))).then(()=>b(311618)))},908409,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0gpix3g._.js"].map(b=>a.l(b))).then(()=>b(869959)))},552157,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_07980-r._.js"].map(b=>a.l(b))).then(()=>b(71326)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0xgo6e7._.js.map