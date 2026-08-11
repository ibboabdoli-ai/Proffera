module.exports=[164240,(a,b,c)=>{"use strict";function d(a){if("function"!=typeof WeakMap)return null;var b=new WeakMap,c=new WeakMap;return(d=function(a){return a?c:b})(a)}c._=function(a,b){if(!b&&a&&a.__esModule)return a;if(null===a||"object"!=typeof a&&"function"!=typeof a)return{default:a};var c=d(b);if(c&&c.has(a))return c.get(a);var e={__proto__:null},f=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var g in a)if("default"!==g&&Object.prototype.hasOwnProperty.call(a,g)){var h=f?Object.getOwnPropertyDescriptor(a,g):null;h&&(h.get||h.set)?Object.defineProperty(e,g,h):e[g]=a[g]}return e.default=a,c&&c.set(a,e),e}},500790,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js <module evaluation>"))},784707,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js"))},297647,a=>{"use strict";a.i(500790);var b=a.i(784707);a.n(b)},395936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={default:function(){return i},useLinkStatus:function(){return h.useLinkStatus}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(164240),g=a.r(907997),h=f._(a.r(297647));function i(a){let b=a.legacyBehavior,c="string"==typeof a.children||"number"==typeof a.children||"string"==typeof a.children?.type,d=a.children?.type?.$$typeof===Symbol.for("react.client.reference");return!b||c||d||(a.children?.type?.$$typeof===Symbol.for("react.lazy")?console.error("Using a Lazy Component as a direct child of `<Link legacyBehavior>` from a Server Component is not supported. If you need legacyBehavior, wrap your Lazy Component in a Client Component that renders the Link's `<a>` tag."):console.error("Using a Server Component as a direct child of `<Link legacyBehavior>` is not supported. If you need legacyBehavior, wrap your Server Component in a Client Component that renders the Link's `<a>` tag.")),(0,g.jsx)(h.default,{...a})}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},739601,a=>a.a(async(b,c)=>{try{var d=a.i(905246),e=a.i(178227),f=a.i(295946),g=b([e]);async function h(){let a=await (0,e.getServerSession)(),b=a?.user?.id,c=(0,f.getSql)();if(!b||!c)return null;let d=(await c`
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
    `}[e]=g.then?(await g)():g,a.s(["downgradeSupportSession",0,m,"elevateSupportSession",0,l,"endSupportSession",0,n,"getPlatformAdmin",0,h,"getSupportSession",0,k,"listActiveSupportSessions",0,i,"startReadOnlySupportSession",0,j]),c()}catch(a){c(a)}},!1),730510,a=>{"use strict";let b=[{area:"saas",label:"SaaS Dashboard",href:"/admin/saas"},{area:"operations",label:"Operations Health",href:"/admin/status"},{area:"workspaces",label:"Workspaces",href:"/admin/workspaces"},{area:"company_admin",label:"Företag",href:"/admin/foretag"},{area:"billing",label:"Billing",href:"/admin/billing"},{area:"platform_admins",label:"Platform Admins",href:"/admin/platform-admins"},{area:"audit",label:"Audit Log",href:"/admin/audit"},{area:"quote_admin",label:"Quote Admin",href:"/admin"}],c={super_admin:["saas","operations","workspaces","company_admin","billing","platform_admins","audit","quote_admin"],support_admin:["saas","operations","workspaces","audit"],billing_admin:["saas","operations","workspaces","billing","audit"],operations_admin:["saas","operations","workspaces","audit","quote_admin"],read_only_admin:["saas","operations","workspaces","audit"],developer_admin:["saas","operations","workspaces","audit","quote_admin"]};function d(a,b){return c[a].includes(b)}a.s(["canAccessAdminArea",0,d,"canAccessCompanyAdmin",0,function(a){return"super_admin"===a},"getAdminNavigationItems",0,function(a){return b.filter(b=>d(a,b.area))},"resolveAdminArea",0,function(a){return"/admin/saas"===a||a.startsWith("/admin/saas/")?"saas":"/admin/status"===a||a.startsWith("/admin/status/")?"operations":"/admin/workspaces"===a||a.startsWith("/admin/workspaces/")?"workspaces":"/admin/foretag"===a||a.startsWith("/admin/foretag/")?"company_admin":"/admin/billing"===a||a.startsWith("/admin/billing/")?"billing":"/admin/platform-admins"===a||a.startsWith("/admin/platform-admins/")?"platform_admins":"/admin/audit"===a||a.startsWith("/admin/audit/")?"audit":"quote_admin"}])},743742,a=>{"use strict";var b=a.i(907997),c=a.i(395936),d=a.i(730510);a.s(["AdminNavigation",0,function({role:a,email:e}){let f=(0,d.getAdminNavigationItems)(a);return(0,b.jsx)("div",{className:"border-b border-slate-200 bg-slate-950 text-white",children:(0,b.jsxs)("div",{className:"mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8",children:[(0,b.jsxs)("div",{className:"min-w-0",children:[(0,b.jsx)("p",{className:"text-xs font-bold uppercase tracking-[0.18em] text-slate-400",children:"Proffera Platform Admin"}),(0,b.jsxs)("p",{className:"truncate text-xs text-slate-300",children:[e," · ",a]})]}),(0,b.jsx)("nav",{className:"flex flex-wrap gap-2","aria-label":"Platform admin navigation",children:f.map(a=>(0,b.jsx)(c.default,{href:a.href,className:"rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900",children:a.label},a.area))})]})})}])},436102,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(905246);a.i(570396);var f=a.i(673727),g=a.i(743742),h=a.i(730510),i=a.i(739601),j=b([i]);async function k({children:a}){let b=await (0,i.getPlatformAdmin)();b||(0,f.redirect)("/logga-in");let c=(await (0,e.headers)()).get("x-proffera-admin-path")??"/admin",j=(0,h.resolveAdminArea)(c);return(0,h.canAccessAdminArea)(b.role,j)||(0,f.redirect)("/admin/saas?denied=1"),(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(g.AdminNavigation,{role:b.role,email:b.email}),a]})}[i]=j.then?(await j)():j,a.s(["default",0,k]),c()}catch(a){c(a)}},!1),444067,a=>{a.n(a.i(436102))},577062,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_memory-adapter_dist_index_mjs_0ptlb60._.js"].map(b=>a.l(b))).then(()=>b(17616)))},860484,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_01xuj8~._.js"].map(b=>a.l(b))).then(()=>b(536063)))},580632,a=>{a.v(a=>Promise.resolve().then(()=>a(270406)))},564133,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0c3cy-j._.js"].map(b=>a.l(b))).then(()=>b(311618)))},908409,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0gpix3g._.js"].map(b=>a.l(b))).then(()=>b(869959)))},552157,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_07980-r._.js"].map(b=>a.l(b))).then(()=>b(71326)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__11.px7f._.js.map