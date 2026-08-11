module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},375148,a=>a.a(async(b,c)=>{try{var d=a.i(739601),e=a.i(295946),f=b([d]);function g(a,b){let c=a?.trim()??"";return c&&c.length<=b?c:null}async function h(a={}){let b=await (0,d.getPlatformAdmin)(),c=(0,e.getSql)();if(!b||!c)return[];let f=g(a.query,160),i=f?`%${f}%`:null,j=g(a.planStatus,40),k=!0===a.attentionOnly;return c`
    select
      w.id,
      w.name,
      w.slug,
      w.status,
      w.public_booking_slug,
      coalesce(ws.company_name, w.company_name, w.name) as company_name,
      coalesce(ws.contact_email, w.contact_email) as contact_email,
      coalesce(ws.contact_phone, w.contact_phone) as contact_phone,
      coalesce(p.plan_key, 'none') as plan_key,
      coalesce(p.status, 'none') as plan_status,
      p.current_period_end,
      count(distinct wm.id)::int as member_count,
      (select count(*)::int from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) as active_service_count,
      (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end <= now() + interval '3 days') as trial_ending_soon,
      (coalesce(ws.contact_email, w.contact_email, '') = '' or coalesce(ws.contact_phone, w.contact_phone, '') = '') as contact_incomplete,
      (w.public_booking_slug is null or w.public_booking_slug = '') as booking_page_missing,
      ((select count(*) from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) = 0) as services_missing,
      (count(distinct wm.id) = 0) as members_missing
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = w.id
      order by created_at desc
      limit 1
    ) p on true
    left join workspace_memberships wm on wm.workspace_id = w.id
    where (
      ${i}::text is null
      or w.name ilike ${i}::text
      or w.slug ilike ${i}::text
      or coalesce(ws.company_name, w.company_name, '') ilike ${i}::text
      or coalesce(ws.contact_email, w.contact_email, '') ilike ${i}::text
    )
      and (${j}::text is null or coalesce(p.status, 'none') = ${j}::text)
    group by w.id, ws.company_name, ws.contact_email, ws.contact_phone,
      p.plan_key, p.status, p.current_period_end
    having (
      ${k}::boolean = false
      or (
        (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end <= now() + interval '3 days')
        or coalesce(ws.contact_email, w.contact_email, '') = ''
        or coalesce(ws.contact_phone, w.contact_phone, '') = ''
        or w.public_booking_slug is null
        or w.public_booking_slug = ''
        or (select count(*) from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) = 0
        or count(distinct wm.id) = 0
      )
    )
    order by
      case when p.status = 'trialing' and p.current_period_end <= now() + interval '3 days' then 0 else 1 end,
      coalesce(ws.company_name, w.company_name, w.name) asc
  `}[d]=f.then?(await f)():f,a.s(["listAdminWorkspaceDirectory",0,h]),c()}catch(a){c(a)}},!1),669557,a=>a.a(async(b,c)=>{try{var d=a.i(739601),e=a.i(295946),f=b([d]);function g(a,b){let c=a?.trim()??"";return c&&c.length<=b?c:null}function h(a){let b=a?.trim()??"";return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:null}async function i(){let a=await (0,d.getPlatformAdmin)(),b=(0,e.getSql)();if(!a||!b)return{workspaces:[],admins:[],actions:[]};let[c,f,g]=await Promise.all([b`select id, name from workspaces order by name asc`,b`
      select distinct u.id, u.name, u.email
      from admin_audit_logs l
      join "user" u on u.id = l.admin_user_id
      order by u.name asc nulls last, u.email asc
    `,b`
      select distinct action
      from admin_audit_logs
      where action is not null and action <> ''
      order by action asc
    `]);return{workspaces:c,admins:f,actions:g}}async function j(a={},b=200){var c;let f,i=await (0,d.getPlatformAdmin)(),k=(0,e.getSql)();if(!i||!k)return[];let l=Math.min(Math.max(b,1),500),m=(c=a.workspaceId,f=c?.trim()??"",/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(f)?f:null),n=g(a.adminUserId,255),o=g(a.action,160),p=g(a.query,160),q=p?`%${p}%`:null,r=h(a.dateFrom),s=h(a.dateTo);return k`
    select l.id, l.action, l.reason, l.created_at,
      l.previous_value, l.new_value,
      u.id as admin_user_id, u.name as admin_name, u.email as admin_email,
      w.id as workspace_id, w.name as workspace_name
    from admin_audit_logs l
    join "user" u on u.id = l.admin_user_id
    left join workspaces w on w.id = l.workspace_id
    where (${m}::uuid is null or l.workspace_id = ${m}::uuid)
      and (${n}::text is null or l.admin_user_id = ${n}::text)
      and (${o}::text is null or l.action = ${o}::text)
      and (${r}::date is null or l.created_at >= ${r}::date)
      and (${s}::date is null or l.created_at < (${s}::date + interval '1 day'))
      and (
        ${q}::text is null
        or l.action ilike ${q}::text
        or coalesce(l.reason, '') ilike ${q}::text
        or coalesce(w.name, '') ilike ${q}::text
        or coalesce(u.name, '') ilike ${q}::text
        or coalesce(u.email, '') ilike ${q}::text
      )
    order by l.created_at desc
    limit ${l}
  `}[d]=f.then?(await f)():f,a.s(["listAdminAuditFilterOptions",0,i,"listAdminAuditLogs",0,j]),c()}catch(a){c(a)}},!1),508728,a=>a.a(async(b,c)=>{try{var d=a.i(669557),e=a.i(375148),f=a.i(739601),g=b([d,e,f]);async function h(){let a=await (0,f.getPlatformAdmin)();if(!a)return null;let[b,c,g,h]=await Promise.all([(0,e.listAdminWorkspaceDirectory)(),(0,e.listAdminWorkspaceDirectory)({attentionOnly:!0}),(0,f.listActiveSupportSessions)(),(0,d.listAdminAuditLogs)({},8)]),i=b.filter(a=>"trialing"===a.plan_status).length,j=b.filter(a=>"active"===a.plan_status).length,k=b.filter(a=>"past_due"===a.plan_status).length,l=b.filter(a=>a.trial_ending_soon).length;return{admin:a,summary:{totalWorkspaces:b.length,attentionCount:c.length,trialingCount:i,activePlanCount:j,pastDueCount:k,trialsEndingSoon:l,activeSessionCount:g.length},urgentWorkspaces:c.slice(0,10),activeSessions:g.slice(0,8),recentAudit:h}}[d,e,f]=g.then?(await g)():g,a.s(["getAdminSaasDashboard",0,h]),c()}catch(a){c(a)}},!1),716862,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(395936);a.i(570396);var f=a.i(673727),g=a.i(508728),h=b([g]);function i({label:a,value:b,tone:c="default"}){return(0,d.jsxs)("article",{className:`rounded-2xl border p-5 shadow-sm ${"danger"===c?"border-red-200 bg-red-50 text-red-950":"warning"===c?"border-amber-200 bg-amber-50 text-amber-950":"border-slate-200 bg-white text-slate-950"}`,children:[(0,d.jsx)("p",{className:"text-sm font-semibold opacity-70",children:a}),(0,d.jsx)("p",{className:"mt-2 text-3xl font-bold",children:b})]})}async function j(){let a=await (0,g.getAdminSaasDashboard)();a||(0,f.redirect)("/logga-in");let{admin:b,summary:c,urgentWorkspaces:h,activeSessions:j,recentAudit:k}=a;return(0,d.jsxs)("main",{className:"mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8",children:[(0,d.jsxs)("header",{className:"flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("p",{className:"text-sm font-semibold uppercase tracking-[0.18em] text-slate-500",children:"Proffera Admin"}),(0,d.jsx)("h1",{className:"mt-1 text-3xl font-bold text-slate-950",children:"SaaS dashboard"}),(0,d.jsxs)("p",{className:"mt-2 text-sm text-slate-600",children:["Inloggad som ",b.email," · ",b.role]})]}),(0,d.jsxs)("nav",{className:"flex flex-wrap gap-2 text-sm font-semibold",children:[(0,d.jsx)(e.default,{href:"/admin/workspaces",className:"rounded-lg bg-slate-950 px-4 py-2 text-white",children:"Workspaces"}),(0,d.jsx)(e.default,{href:"/admin/audit",className:"rounded-lg border border-slate-300 px-4 py-2 text-slate-700",children:"Audit log"}),(0,d.jsx)(e.default,{href:"/admin",className:"rounded-lg border border-slate-300 px-4 py-2 text-slate-700",children:"Quote admin"})]})]}),(0,d.jsxs)("section",{className:"grid gap-4 sm:grid-cols-2 xl:grid-cols-7",children:[(0,d.jsx)(i,{label:"Workspaces",value:c.totalWorkspaces}),(0,d.jsx)(i,{label:"Behöver åtgärd",value:c.attentionCount,tone:c.attentionCount?"warning":"default"}),(0,d.jsx)(i,{label:"Trial",value:c.trialingCount}),(0,d.jsx)(i,{label:"Aktiva planer",value:c.activePlanCount}),(0,d.jsx)(i,{label:"Past due",value:c.pastDueCount,tone:c.pastDueCount?"danger":"default"}),(0,d.jsx)(i,{label:"Trial slutar snart",value:c.trialsEndingSoon,tone:c.trialsEndingSoon?"warning":"default"}),(0,d.jsx)(i,{label:"Supportsessioner",value:c.activeSessionCount})]}),(0,d.jsxs)("section",{className:"grid gap-6 xl:grid-cols-[1.4fr_1fr]",children:[(0,d.jsxs)("article",{className:"overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-slate-200 px-5 py-4",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("h2",{className:"text-xl font-bold text-slate-950",children:"Behöver åtgärd"}),(0,d.jsx)("p",{className:"mt-1 text-sm text-slate-600",children:"De viktigaste Workspace-problemen just nu."})]}),(0,d.jsx)(e.default,{href:"/admin/workspaces?attention=1",className:"text-sm font-semibold text-slate-700 underline",children:"Visa alla"})]}),(0,d.jsxs)("div",{className:"divide-y divide-slate-100",children:[h.map(a=>(0,d.jsxs)("div",{className:"flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("p",{className:"font-semibold text-slate-950",children:String(a.company_name)}),(0,d.jsxs)("p",{className:"mt-1 text-xs text-slate-500",children:[String(a.slug)," · ",String(a.plan_key)," / ",String(a.plan_status)]}),(0,d.jsx)("div",{className:"mt-2 flex flex-wrap gap-1.5",children:[a.trial_ending_soon?"Trial slutar snart":null,a.services_missing?"Inga aktiva tjänster":null,a.booking_page_missing?"Bokningssida saknas":null,a.contact_incomplete?"Kontaktuppgifter saknas":null,a.members_missing?"Ingen medlem":null].filter(Boolean).map(a=>(0,d.jsx)("span",{className:"rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800",children:a},a))})]}),(0,d.jsx)(e.default,{href:`/admin/workspaces/${String(a.id)}`,className:"shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800",children:"Öppna"})]},String(a.id))),0===h.length?(0,d.jsx)("p",{className:"px-5 py-10 text-center text-sm text-slate-500",children:"Alla workspaces ser bra ut."}):null]})]}),(0,d.jsxs)("article",{className:"overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",children:[(0,d.jsxs)("div",{className:"border-b border-slate-200 px-5 py-4",children:[(0,d.jsx)("h2",{className:"text-xl font-bold text-slate-950",children:"Aktiva supportsessioner"}),(0,d.jsx)("p",{className:"mt-1 text-sm text-slate-600",children:"Pågående åtkomst till kundmiljöer."})]}),(0,d.jsxs)("div",{className:"divide-y divide-slate-100",children:[j.map(a=>(0,d.jsxs)("div",{className:"px-5 py-4",children:[(0,d.jsx)("p",{className:"font-semibold text-slate-950",children:String(a.workspace_name)}),(0,d.jsxs)("p",{className:"mt-1 text-xs text-slate-500",children:[String(a.mode)," · slutar ",new Date(String(a.expires_at)).toLocaleString("sv-SE")]}),(0,d.jsx)("p",{className:"mt-2 text-sm text-slate-600",children:String(a.reason)})]},String(a.id))),0===j.length?(0,d.jsx)("p",{className:"px-5 py-10 text-center text-sm text-slate-500",children:"Inga aktiva sessioner."}):null]})]})]}),(0,d.jsxs)("section",{className:"overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-slate-200 px-5 py-4",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("h2",{className:"text-xl font-bold text-slate-950",children:"Senaste adminaktivitet"}),(0,d.jsx)("p",{className:"mt-1 text-sm text-slate-600",children:"Senaste support- och ändringshändelserna."})]}),(0,d.jsx)(e.default,{href:"/admin/audit",className:"text-sm font-semibold text-slate-700 underline",children:"Öppna audit log"})]}),(0,d.jsx)("div",{className:"overflow-x-auto",children:(0,d.jsxs)("table",{className:"min-w-full divide-y divide-slate-200 text-sm",children:[(0,d.jsx)("thead",{className:"bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500",children:(0,d.jsxs)("tr",{children:[(0,d.jsx)("th",{className:"px-4 py-3",children:"Tid"}),(0,d.jsx)("th",{className:"px-4 py-3",children:"Admin"}),(0,d.jsx)("th",{className:"px-4 py-3",children:"Workspace"}),(0,d.jsx)("th",{className:"px-4 py-3",children:"Händelse"}),(0,d.jsx)("th",{className:"px-4 py-3",children:"Orsak"})]})}),(0,d.jsxs)("tbody",{className:"divide-y divide-slate-100",children:[k.map(a=>(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{className:"whitespace-nowrap px-4 py-3 text-slate-600",children:new Date(String(a.created_at)).toLocaleString("sv-SE")}),(0,d.jsx)("td",{className:"px-4 py-3 text-slate-700",children:String(a.admin_name||a.admin_email)}),(0,d.jsx)("td",{className:"px-4 py-3 text-slate-700",children:String(a.workspace_name||"System")}),(0,d.jsx)("td",{className:"px-4 py-3 font-semibold text-slate-900",children:String(a.action)}),(0,d.jsx)("td",{className:"max-w-md px-4 py-3 text-slate-600",children:String(a.reason||"—")})]},String(a.id))),0===k.length?(0,d.jsx)("tr",{children:(0,d.jsx)("td",{colSpan:5,className:"px-4 py-10 text-center text-slate-500",children:"Ingen adminaktivitet ännu."})}):null]})]})})]})]})}[g]=h.then?(await h)():h,a.s(["default",0,j]),c()}catch(a){c(a)}},!1),539031,a=>{a.n(a.i(716862))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0926lce._.js.map