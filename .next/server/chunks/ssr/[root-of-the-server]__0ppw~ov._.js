module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},164240,(a,b,c)=>{"use strict";function d(a){if("function"!=typeof WeakMap)return null;var b=new WeakMap,c=new WeakMap;return(d=function(a){return a?c:b})(a)}c._=function(a,b){if(!b&&a&&a.__esModule)return a;if(null===a||"object"!=typeof a&&"function"!=typeof a)return{default:a};var c=d(b);if(c&&c.has(a))return c.get(a);var e={__proto__:null},f=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var g in a)if("default"!==g&&Object.prototype.hasOwnProperty.call(a,g)){var h=f?Object.getOwnPropertyDescriptor(a,g):null;h&&(h.get||h.set)?Object.defineProperty(e,g,h):e[g]=a[g]}return e.default=a,c&&c.set(a,e),e}},500790,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js <module evaluation>"))},784707,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js"))},297647,a=>{"use strict";a.i(500790);var b=a.i(784707);a.n(b)},395936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={default:function(){return i},useLinkStatus:function(){return h.useLinkStatus}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(164240),g=a.r(907997),h=f._(a.r(297647));function i(a){let b=a.legacyBehavior,c="string"==typeof a.children||"number"==typeof a.children||"string"==typeof a.children?.type,d=a.children?.type?.$$typeof===Symbol.for("react.client.reference");return!b||c||d||(a.children?.type?.$$typeof===Symbol.for("react.lazy")?console.error("Using a Lazy Component as a direct child of `<Link legacyBehavior>` from a Server Component is not supported. If you need legacyBehavior, wrap your Lazy Component in a Client Component that renders the Link's `<a>` tag."):console.error("Using a Server Component as a direct child of `<Link legacyBehavior>` is not supported. If you need legacyBehavior, wrap your Server Component in a Client Component that renders the Link's `<a>` tag.")),(0,g.jsx)(h.default,{...a})}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},739601,a=>a.a(async(b,c)=>{try{var d=a.i(905246),e=a.i(178227),f=a.i(295946),g=b([e]);async function h(){let a=await (0,e.getServerSession)(),b=a?.user?.id,c=(0,f.getSql)();if(!b||!c)return null;let d=(await c`
    select pa.role, u.email, u.name
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    where pa.user_id = ${b} and pa.is_active = true
    limit 1
  `)[0];return d?{userId:b,role:String(d.role),email:String(d.email??""),name:String(d.name??"")}:null}async function i(){let a=await h(),b=(0,f.getSql)();return a&&b?(await b`
    update admin_support_sessions
    set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now()
  `,b`
    select s.id, s.reason, s.mode, s.expires_at, s.created_at,
      w.name as workspace_name, w.slug as workspace_slug,
      u.email as admin_email, u.name as admin_name
    from admin_support_sessions s
    join workspaces w on w.id = s.workspace_id
    join "user" u on u.id = s.admin_user_id
    where s.status = 'active' and s.expires_at > now()
    order by s.expires_at asc
  `):[]}async function j(a,b){let c=await h(),e=(0,f.getSql)();if(!c||!e)throw Error("Platform admin access required");let g=b.trim();if(g.length<8||g.length>500)throw Error("A clear support reason is required");let i=await (0,d.headers)(),j=i.get("user-agent")??"",k=i.get("x-forwarded-for")?.split(",")[0]?.trim()??"",l=await e.transaction(b=>[b`
      insert into admin_support_sessions (
        admin_user_id, workspace_id, reason, mode, status, expires_at
      ) values (
        ${c.userId}, ${a}::uuid, ${g}, 'read_only', 'active', now() + interval '30 minutes'
      ) returning id, expires_at
    `]),m=l[0]?.[0];if(!m)throw Error("Unable to start support session");return await e`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason, ip_address, user_agent
    ) values (
      ${c.userId}, ${a}::uuid, ${String(m.id)}::uuid,
      'support_session.started', ${g}, ${k}, ${j}
    )
  `,{id:String(m.id),expiresAt:new Date(String(m.expires_at)).toISOString()}}async function k(a){let b=await h(),c=(0,f.getSql)();return b&&c?(await c`
    select s.id, s.reason, s.mode, s.expires_at, w.id as workspace_id,
      w.name, w.slug, w.status, w.public_booking_slug,
      ws.company_name, ws.primary_city, ws.contact_email, ws.contact_phone,
      coalesce(p.plan_key, 'none') as plan_key, coalesce(p.status, 'none') as plan_status
    from admin_support_sessions s
    join workspaces w on w.id = s.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select plan_key, status from workspace_plans
      where workspace_id = w.id order by created_at desc limit 1
    ) p on true
    where s.id = ${a}::uuid
      and s.admin_user_id = ${b.userId}
      and s.status = 'active'
      and s.expires_at > now()
    limit 1
  `)[0]??null:null}async function l(a,b){let c=await h(),d=(0,f.getSql)();if(!c||!d||"super_admin"!==c.role)throw Error("Super admin access required");let e=b.trim();if(e.length<12||e.length>500)throw Error("A clear edit reason is required");let g=(await d`
    update admin_support_sessions
    set mode = 'edit', expires_at = now() + interval '10 minutes', updated_at = now()
    where id = ${a}::uuid
      and admin_user_id = ${c.userId}
      and status = 'active'
      and expires_at > now()
    returning workspace_id
  `)[0];if(!g)throw Error("Active support session not found");await d`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason,
      previous_value, new_value
    ) values (
      ${c.userId}, ${String(g.workspace_id)}::uuid, ${a}::uuid,
      'support_session.edit_elevated', ${e},
      ${JSON.stringify({mode:"read_only"})}::jsonb,
      ${JSON.stringify({mode:"edit",duration_minutes:10})}::jsonb
    )
  `}async function m(a){let b=await h(),c=(0,f.getSql)();if(!b||!c)throw Error("Platform admin access required");let d=(await c`
    update admin_support_sessions
    set mode = 'read_only', expires_at = now() + interval '20 minutes', updated_at = now()
    where id = ${a}::uuid
      and admin_user_id = ${b.userId}
      and status = 'active'
      and mode = 'edit'
      and expires_at > now()
    returning workspace_id, reason
  `)[0];d&&await c`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason,
      previous_value, new_value
    ) values (
      ${b.userId}, ${String(d.workspace_id)}::uuid, ${a}::uuid,
      'support_session.edit_downgraded', ${String(d.reason)},
      ${JSON.stringify({mode:"edit"})}::jsonb,
      ${JSON.stringify({mode:"read_only"})}::jsonb
    )
  `}async function n(a){let b=await h(),c=(0,f.getSql)();if(!b||!c)throw Error("Platform admin access required");let d="super_admin"===b.role?c``:c`and admin_user_id = ${b.userId}`,e=(await c`
    update admin_support_sessions
    set status = 'ended', ended_at = now(), updated_at = now()
    where id = ${a}::uuid and status = 'active' ${d}
    returning workspace_id, reason
  `)[0];e&&await c`
      insert into admin_audit_logs (admin_user_id, workspace_id, support_session_id, action, reason)
      values (${b.userId}, ${String(e.workspace_id)}::uuid, ${a}::uuid, 'support_session.ended', ${String(e.reason)})
    `}[e]=g.then?(await g)():g,a.s(["downgradeSupportSession",0,m,"elevateSupportSession",0,l,"endSupportSession",0,n,"getPlatformAdmin",0,h,"getSupportSession",0,k,"listActiveSupportSessions",0,i,"startReadOnlySupportSession",0,j]),c()}catch(a){c(a)}},!1),730510,a=>{"use strict";let b=[{area:"saas",label:"SaaS Dashboard",href:"/admin/saas"},{area:"operations",label:"Operations Health",href:"/admin/status"},{area:"workspaces",label:"Workspaces",href:"/admin/workspaces"},{area:"company_admin",label:"Företag",href:"/admin/foretag"},{area:"billing",label:"Billing",href:"/admin/billing"},{area:"platform_admins",label:"Platform Admins",href:"/admin/platform-admins"},{area:"audit",label:"Audit Log",href:"/admin/audit"},{area:"quote_admin",label:"Quote Admin",href:"/admin"}],c={super_admin:["saas","operations","workspaces","company_admin","billing","platform_admins","audit","quote_admin"],support_admin:["saas","operations","workspaces","audit"],billing_admin:["saas","operations","workspaces","billing","audit"],operations_admin:["saas","operations","workspaces","audit","quote_admin"],read_only_admin:["saas","operations","workspaces","audit"],developer_admin:["saas","operations","workspaces","audit","quote_admin"]};function d(a,b){return c[a].includes(b)}a.s(["canAccessAdminArea",0,d,"canAccessCompanyAdmin",0,function(a){return"super_admin"===a},"getAdminNavigationItems",0,function(a){return b.filter(b=>d(a,b.area))},"resolveAdminArea",0,function(a){return"/admin/saas"===a||a.startsWith("/admin/saas/")?"saas":"/admin/status"===a||a.startsWith("/admin/status/")?"operations":"/admin/workspaces"===a||a.startsWith("/admin/workspaces/")?"workspaces":"/admin/foretag"===a||a.startsWith("/admin/foretag/")?"company_admin":"/admin/billing"===a||a.startsWith("/admin/billing/")?"billing":"/admin/platform-admins"===a||a.startsWith("/admin/platform-admins/")?"platform_admins":"/admin/audit"===a||a.startsWith("/admin/audit/")?"audit":"quote_admin"}])},765102,a=>a.a(async(b,c)=>{try{a.i(570396);var d=a.i(673727),e=a.i(730510),f=a.i(739601),g=b([f]);async function h(a){let b=await (0,f.getPlatformAdmin)();return b&&(0,e.canAccessAdminArea)(b.role,a)?b:null}async function i(a){let b=await (0,f.getPlatformAdmin)();return b||(0,d.redirect)("/logga-in"),(0,e.canAccessAdminArea)(b.role,a)||(0,d.redirect)("/admin/saas?denied=1"),b}async function j(){let a=await (0,f.getPlatformAdmin)();return a||(0,d.redirect)("/logga-in"),(0,e.canAccessCompanyAdmin)(a.role)||(0,d.redirect)("/admin/saas?denied=1"),a}async function k(){let a=await (0,f.getPlatformAdmin)();return a||(0,d.redirect)("/logga-in"),"super_admin"!==a.role&&(0,d.redirect)("/admin/saas?denied=1"),a}[f]=g.then?(await g)():g,a.s(["getAdminForArea",0,h,"requireAdminArea",0,i,"requireCompanyAdmin",0,j,"requireSuperAdmin",0,k]),c()}catch(a){c(a)}},!1),963877,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(666680),f=a.i(395936);a.i(570396);var g=a.i(673727),h=a.i(765102),i=b([h]);function j(a){return"string"==typeof a?a.slice(0,500):"number"==typeof a||"boolean"==typeof a?String(a):""}function k(a,b){let c=[];b&&c.push(`www-authenticate: ${b.slice(0,500)}`);try{let b=JSON.parse(a);for(let a of["code","message","description","error","error_description","type","instance","status","title","detail","requestId"]){let d=b[a];if(d&&"object"==typeof d&&!Array.isArray(d))for(let b of["code","message","description","title","detail"]){let e=j(d[b]);e&&c.push(`${a}.${b}: ${e}`)}else{let b=j(d);b&&c.push(`${a}: ${b}`)}}}catch{let b=a.trim();b&&c.push(`body: ${b.slice(0,500)}`)}return c.join(" · ")||"Ingen säker felbeskrivning returnerades."}function l(a,b){return a.replaceAll("{organizationNumber}",encodeURIComponent(b))}async function m(){let a=process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim(),b=process.env.BOLAGSVERKET_CLIENT_ID?.trim(),c=process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),d=process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim(),f=process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim(),g=process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim(),h=process.env.COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS?.split(/[\s,;]+/).map(a=>a.replace(/\D/g,"")).find(a=>10===a.length);if(!a||!b||!c||!f||!h)return{token:"Config missing",alive:"–",organisation:"–",scope:"–"};let i=new URLSearchParams({grant_type:"client_credentials"});d&&i.set("scope",d);let m=await fetch(a,{method:"POST",headers:{authorization:`Basic ${Buffer.from(`${b}:${c}`).toString("base64")}`,"content-type":"application/x-www-form-urlencoded",accept:"application/json"},body:i.toString(),cache:"no-store",signal:AbortSignal.timeout(12e3)}),n=await m.text();if(!m.ok)return{token:`HTTP ${m.status} \xb7 ${k(n,m.headers.get("www-authenticate"))}`,alive:"–",organisation:"–",scope:"–"};let o="",p="";try{var q;let a=JSON.parse(n);q=a.access_token,o="string"==typeof q?q:"",p=j(a.scope)}catch{return{token:"Token response was not valid JSON",alive:"–",organisation:"–",scope:"–"}}if(!o)return{token:"No access_token returned",alive:"–",organisation:"–",scope:p||"(none)"};let r=l(f,h),s=r.replace(/\/organisationer(?:\?.*)?$/,""),t=await fetch(`${s}/isalive`,{method:"GET",headers:{authorization:`Bearer ${o}`,"x-request-id":(0,e.randomUUID)(),accept:"application/json, text/plain"},cache:"no-store",signal:AbortSignal.timeout(12e3)}),u=await t.text(),v=t.ok?`HTTP ${t.status} \xb7 OK`:`HTTP ${t.status} \xb7 ${k(u,t.headers.get("www-authenticate"))}`,w=await fetch(r,{method:"POST",headers:{authorization:`Bearer ${o}`,"x-request-id":(0,e.randomUUID)(),accept:"application/json","content-type":"application/json"},body:g?l(g,h):JSON.stringify({identitetsbeteckning:h}),cache:"no-store",signal:AbortSignal.timeout(15e3)}),x=await w.text(),y=w.ok?`HTTP ${w.status} \xb7 OK`:`HTTP ${w.status} \xb7 ${k(x,w.headers.get("www-authenticate"))}`;return{token:`HTTP ${m.status} \xb7 OK`,scope:p||"(inget scope-fält i svaret)",alive:v,organisation:y}}async function n({searchParams:a}){"preview"!==process.env.VERCEL_ENV&&(0,g.notFound)(),await (0,h.requireSuperAdmin)();let b=a?await a:void 0,c=Array.isArray(b?.run)?b?.run[0]:b?.run,e="1"===c?await m():null;return(0,d.jsx)("main",{className:"min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8",children:(0,d.jsxs)("section",{className:"mx-auto max-w-3xl",children:[(0,d.jsx)("p",{className:"text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]",children:"Preview only · read-only"}),(0,d.jsx)("h1",{className:"mt-2 text-3xl font-black text-[#17201a]",children:"Bolagsverket OAuth-diagnostik"}),(0,d.jsx)("p",{className:"mt-3 text-sm text-[#687169]",children:"Visar aldrig client secret eller access token och skriver inget till Company Directory."}),e?(0,d.jsxs)("div",{className:"mt-7 grid gap-4",children:[(0,d.jsxs)("section",{className:"rounded-2xl bg-white p-5 ring-1 ring-black/5",children:[(0,d.jsx)("h2",{className:"font-black",children:"OAuth token"}),(0,d.jsx)("p",{className:"mt-2 break-words text-sm",children:e.token}),(0,d.jsxs)("p",{className:"mt-2 break-words text-sm",children:["Granted scope: ",(0,d.jsx)("strong",{children:e.scope})]})]}),(0,d.jsxs)("section",{className:"rounded-2xl bg-white p-5 ring-1 ring-black/5",children:[(0,d.jsx)("h2",{className:"font-black",children:"GET /isalive"}),(0,d.jsx)("p",{className:"mt-2 break-words text-sm",children:e.alive})]}),(0,d.jsxs)("section",{className:"rounded-2xl bg-white p-5 ring-1 ring-black/5",children:[(0,d.jsx)("h2",{className:"font-black",children:"POST /organisationer"}),(0,d.jsx)("p",{className:"mt-2 break-words text-sm",children:e.organisation})]})]}):(0,d.jsx)(f.default,{href:"?run=1",className:"mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#17452f] px-5 font-black text-white",children:"Kör säker diagnostik"})]})})}[h]=i.then?(await i)():i,a.s(["default",0,n,"dynamic",0,"force-dynamic"]),c()}catch(a){c(a)}},!1),915673,a=>{a.n(a.i(963877))},577062,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_memory-adapter_dist_index_mjs_0ptlb60._.js"].map(b=>a.l(b))).then(()=>b(17616)))},860484,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_01xuj8~._.js"].map(b=>a.l(b))).then(()=>b(536063)))},580632,a=>{a.v(a=>Promise.resolve().then(()=>a(270406)))},564133,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0c3cy-j._.js"].map(b=>a.l(b))).then(()=>b(311618)))},908409,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0gpix3g._.js"].map(b=>a.l(b))).then(()=>b(869959)))},552157,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_07980-r._.js"].map(b=>a.l(b))).then(()=>b(71326)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0ppw~ov._.js.map