module.exports=[238444,a=>{"use strict";var b=a.i(907997);a.s(["DashboardDataPanel",0,function({title:a,description:c,count:d,children:e}){return(0,b.jsxs)("section",{className:"overflow-hidden rounded-[24px] border border-[#e0e5dd] bg-white shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]",children:[(0,b.jsxs)("div",{className:"flex flex-col gap-3 border-b border-[#e5e9e2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h3",{className:"text-lg font-bold tracking-tight text-[#17201a]",children:a}),(0,b.jsx)("p",{className:"mt-1 text-sm leading-6 text-[#667168]",children:c})]}),(0,b.jsxs)("span",{className:"inline-flex w-fit items-center rounded-full bg-[#eaf2ec] px-3 py-1.5 text-xs font-bold text-[#17452f]",children:[d," ",1===d?"post":"poster"]})]}),e]})},"DashboardMetricGrid",0,function({items:a}){return(0,b.jsx)("section",{className:"grid gap-3 sm:grid-cols-2 xl:grid-cols-4","aria-label":"Sidöversikt",children:a.map(a=>(0,b.jsxs)("article",{className:"rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_10px_26px_rgba(20,43,32,0.035)] transition hover:-translate-y-0.5 hover:border-[#cfd8cd] hover:shadow-[0_14px_30px_rgba(20,43,32,0.07)]",children:[(0,b.jsxs)("div",{className:"flex items-start justify-between gap-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-[11px] font-bold uppercase tracking-[0.1em] text-[#778179]",children:a.label}),(0,b.jsx)("p",{className:"mt-3 text-3xl font-bold tracking-tight text-[#173e2b]",children:a.value})]}),(0,b.jsx)("span",{className:`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`,children:(0,b.jsx)(a.icon,{className:"h-[18px] w-[18px]","aria-hidden":"true"})})]}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-5 text-[#6a756d]",children:a.helper})]},a.label))})},"DashboardPageHeader",0,function({eyebrow:a,title:c,description:d,icon:e,actions:f}){return(0,b.jsxs)("section",{className:"relative overflow-hidden rounded-[24px] border border-[#dfe5dd] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.05)] sm:px-7 sm:py-7 lg:px-8",children:[(0,b.jsx)("div",{className:"absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#eaf2ec] blur-2xl","aria-hidden":"true"}),(0,b.jsxs)("div",{className:"relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",children:[(0,b.jsxs)("div",{className:"flex max-w-3xl items-start gap-4",children:[(0,b.jsx)("span",{className:"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#173e2b] text-white shadow-lg shadow-[#173e2b]/15",children:(0,b.jsx)(e,{className:"h-5 w-5","aria-hidden":"true"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-bold uppercase tracking-[0.14em] text-[#17452f]",children:a}),(0,b.jsx)("h2",{className:"mt-2 text-2xl font-bold tracking-[-0.025em] text-[#17201a] sm:text-3xl",children:c}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#667168] sm:text-[15px]",children:d})]})]}),f?(0,b.jsx)("div",{className:"flex shrink-0 flex-col gap-2 sm:flex-row",children:f}):null]})]})}])},137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},67693,a=>a.a(async(b,c)=>{try{var d=a.i(137936),e=a.i(905246);a.i(570396);var f=a.i(673727),g=a.i(87921),h=a.i(713095),i=b([g]);async function j(a){let b=String(a.get("workspace_id")??"");(await (0,g.getUserWorkspaceOptions)()).some(a=>a.id===b)||(0,f.redirect)("/dashboard?workspace=invalid"),(await (0,e.cookies)()).set(g.selectedWorkspaceCookieName,b,{httpOnly:!0,sameSite:"lax",secure:!0,path:"/",maxAge:31536e3}),(0,f.redirect)("/dashboard")}[g]=i.then?(await i)():i,(0,h.ensureServerEntryExports)([j]),(0,d.registerServerReference)(j,"4068e27ed13f1f3adac9ee8279e91982c5554507df",null),a.s(["switchWorkspaceAction",0,j]),c()}catch(a){c(a)}},!1),784930,a=>{"use strict";let b=(0,a.i(892277).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);a.s(["ArrowLeft",0,b],784930)},95679,a=>{"use strict";let b=(0,a.i(892277).default)("user-round",[["circle",{cx:"12",cy:"8",r:"5",key:"1hypcn"}],["path",{d:"M20 21a8 8 0 0 0-16 0",key:"rfgkzh"}]]);a.s(["UserRound",0,b],95679)},104857,a=>{"use strict";let b=(0,a.i(892277).default)("calendar-check-2",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8",key:"bce9hv"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m16 20 2 2 4-4",key:"13tcca"}]]);a.s(["CalendarCheck2",0,b],104857)},394640,a=>{"use strict";let b=(0,a.i(892277).default)("message-square-text",[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"M7 11h10",key:"1twpyw"}],["path",{d:"M7 15h6",key:"d9of3u"}],["path",{d:"M7 7h8",key:"af5zfr"}]]);a.s(["MessageSquareText",0,b],394640)},553207,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(87921),g=b([f]);[f]=g.then?(await g)():g;let t=(0,e.resolveDatabaseUrl)();function h(){return t?(0,d.neon)(t):null}async function i(){let a=await (0,f.getUserWorkspaceAccess)();if(!a.ok)throw Error("A valid workspace membership is required for dashboard data");return a.workspaceId}function j(a,b=""){return null==a?b:String(a)}function k(a,b=0){let c=Number(a);return Number.isFinite(c)?c:b}function l(a){if(!a)return"Ej bokad";let b=a instanceof Date?a:new Date(String(a));return Number.isNaN(b.getTime())?"Ej bokad":new Intl.DateTimeFormat("sv-SE",{dateStyle:"medium",timeStyle:"short"}).format(b)}function m(a){let b=a.trim();return b.length>0?b:null}class u extends Error{constructor(){super("A booking already exists during the selected time."),this.name="BookingTimeConflictError"}}async function n(a={}){let b=h(),c=a.includeCustomers??!0,d=a.includeBookings??!0,e={customersCount:0,activeCustomersCount:0,bookingsCount:0,confirmedBookingsCount:0,customerEventsCount:0};if(!b||!c&&!d)return e;let f=await i();try{let a=(c&&d?await b`
      select
        (select count(*) from customers where workspace_id = ${f}) as customers_count,
        (select count(*) from customers where workspace_id = ${f} and status = 'active') as active_customers_count,
        (select count(*) from bookings where workspace_id = ${f}) as bookings_count,
        (select count(*) from bookings where workspace_id = ${f} and status = 'confirmed') as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id = ${f}) as customer_events_count
    `:c?await b`
      select
        (select count(*) from customers where workspace_id = ${f}) as customers_count,
        (select count(*) from customers where workspace_id = ${f} and status = 'active') as active_customers_count,
        0 as bookings_count,
        0 as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id = ${f} and booking_id is null) as customer_events_count
    `:await b`
      select
        0 as customers_count,
        0 as active_customers_count,
        (select count(*) from bookings where workspace_id = ${f}) as bookings_count,
        (select count(*) from bookings where workspace_id = ${f} and status = 'confirmed') as confirmed_bookings_count,
        0 as customer_events_count
    `)[0]??{};return{customersCount:k(a.customers_count),activeCustomersCount:k(a.active_customers_count),bookingsCount:k(a.bookings_count),confirmedBookingsCount:k(a.confirmed_bookings_count),customerEventsCount:k(a.customer_events_count)}}catch(a){return console.error("Failed to read dashboard stats",a),e}}async function o(){let a=h();if(!a)return[];let b=await i();try{return(await a`
      select
        id,
        name,
        customer_type,
        city,
        status,
        primary_service_slug,
        notes
      from customers
      where workspace_id = ${b}
      order by created_at desc
      limit 20
    `).map(a=>({id:j(a.id),name:j(a.name,"Namnlös kund"),type:"company"===j(a.customer_type)?"Företag":"Privatkund",city:j(a.city,"Okänd ort"),status:j(a.status,"prospect"),service:j(a.primary_service_slug,"Ej valt"),notes:j(a.notes,"Ingen notering")}))}catch(a){return console.error("Failed to read dashboard customers",a),[]}}async function p(){let a=h();if(!a)return[];let b=await i();try{return(await a`
      select
        id,
        name,
        city,
        status,
        primary_service_slug
      from customers
      where workspace_id = ${b}
      order by created_at desc
      limit 50
    `).map(a=>({id:j(a.id),name:j(a.name,"Namnlös kund"),city:j(a.city,"Okänd ort"),status:j(a.status,"prospect"),service:j(a.primary_service_slug,"Ej valt")}))}catch(a){return console.error("Failed to read dashboard customer options",a),[]}}async function q(a){let b=h();if(!b)throw Error("Missing database connection for dashboard customer creation");let c=await i(),d=await b`
    insert into customers (
      workspace_id,
      name,
      email,
      phone,
      company_name,
      customer_type,
      city,
      status,
      source,
      primary_service_category_slug,
      primary_service_slug,
      notes
    )
    values (
      ${c},
      ${a.name.trim()},
      ${m(a.email)},
      ${m(a.phone)},
      ${m(a.companyName)},
      ${a.customerType},
      ${m(a.city)},
      ${a.status},
      'dashboard_manual',
      ${m(a.serviceCategorySlug)},
      ${m(a.serviceSlug)},
      ${m(a.notes)}
    )
    returning id
  `,e=j(d[0]?.id);if(!e)throw Error("Customer creation did not return an id");return e}async function r(a){let b=h();if(!b)throw Error("Missing database connection for dashboard booking creation");let c=await i(),d=await b`
    select id
    from customers
    where workspace_id = ${c}
      and id = ${a.customerId}
    limit 1
  `,e=j(d[0]?.id);if(!e)throw Error("Selected customer does not exist");if((await b`
    select id
    from bookings
    where workspace_id = ${c}
      and status not in ('cancelled', 'no_show')
      and starts_at is not null
      and ends_at is not null
      and starts_at < ${a.endsAt}::timestamptz
      and ends_at > ${a.startsAt}::timestamptz
    limit 1
  `)[0])throw new u;let f=await b`
    insert into bookings (
      workspace_id,
      customer_id,
      title,
      service,
      service_category_slug,
      service_slug,
      city,
      status,
      starts_at,
      ends_at,
      source,
      notes
    )
    values (
      ${c},
      ${e},
      ${a.title.trim()},
      ${m(a.service)},
      ${m(a.serviceCategorySlug)},
      ${m(a.serviceSlug)},
      ${m(a.city)},
      ${a.status},
      ${a.startsAt}::timestamptz,
      ${a.endsAt}::timestamptz,
      'dashboard_manual',
      ${m(a.notes)}
    )
    returning id
  `,g=j(f[0]?.id);if(!g)throw Error("Booking creation did not return an id");return await b`
    update customers
    set status = 'active',
        updated_at = now()
    where id = ${e}
      and workspace_id = ${c}
      and status = 'prospect'
  `,await b`
    insert into customer_events (
      workspace_id,
      customer_id,
      booking_id,
      event_type,
      title,
      description
    )
    values (
      ${c},
      ${e},
      ${g},
      'booking_created',
      'Bokning skapad fran lead',
      'Lead konverterades till bokning och kunden markerades som aktiv.'
    )
  `,g}async function s(a){let b=h();if(!b)return null;let c=await i();try{let d=(await b`
      select
        id,
        name,
        email,
        phone,
        company_name,
        customer_type,
        city,
        status,
        source,
        primary_service_slug,
        notes,
        created_at
      from customers
      where workspace_id = ${c}
        and id = ${a}
      limit 1
    `)[0];if(!d)return null;let e=await b`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        c.name as customer_name
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${c}
        and b.customer_id = ${a}
      order by b.starts_at asc nulls last, b.created_at desc
      limit 20
    `,f=await b`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id = ${c}
        and customer_id = ${a}
      order by created_at desc
      limit 20
    `;return{customer:{id:j(d.id),name:j(d.name,"Namnlös kund"),type:"company"===j(d.customer_type)?"Företag":"Privatkund",city:j(d.city,"Okänd ort"),status:j(d.status,"prospect"),service:j(d.primary_service_slug,"Ej valt"),notes:j(d.notes,"Ingen notering"),email:j(d.email,"Ingen e-post"),phone:j(d.phone,"Inget telefonnummer"),companyName:j(d.company_name,"Ej företag"),source:j(d.source,"Okänd källa"),createdAt:l(d.created_at)},bookings:e.map(a=>({id:j(a.id),time:l(a.starts_at),title:j(a.title,"Namnlös bokning"),customer:j(a.customer_name,"Okänd kund"),status:j(a.status,"requested"),city:j(a.city,"Okänd ort"),service:j(a.service,"Ej vald tjänst")})),events:f.map(a=>({id:j(a.id),type:j(a.event_type,"note"),title:j(a.title,"Namnlös händelse"),description:j(a.description,"Ingen beskrivning"),createdAt:l(a.created_at)}))}}catch(a){return console.error("Failed to read dashboard customer detail",a),null}}a.s(["BookingTimeConflictError",0,u,"createDashboardBooking",0,r,"createDashboardCustomer",0,q,"getDashboardCustomerDetail",0,s,"getDashboardCustomerOptions",0,p,"getDashboardCustomers",0,o,"getDashboardStats",0,n]),c()}catch(a){c(a)}},!1),679767,a=>{"use strict";let b=(0,a.i(892277).default)("activity",[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]);a.s(["Activity",0,b],679767)},40870,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(137936),f=a.i(546767),g=a.i(612147),h=a.i(395936);a.i(570396);var i=a.i(673727),j=a.i(679767),k=a.i(784930),l=a.i(104857),m=a.i(394640),n=a.i(95679),o=a.i(238444),p=a.i(553207),q=a.i(87921),r=a.i(906077),s=b([p,q,r]);[p,q,r]=s.then?(await s)():s;let z=(0,g.resolveDatabaseUrl)(),A={sv:{prospect:"Prospekt",active:"Aktiv",paused:"Pausad",lost:"Förlorad"},en:{prospect:"Prospect",active:"Active",paused:"Paused",lost:"Lost"}},B={sv:{draft:"Utkast",requested:"Förfrågad",confirmed:"Bekräftad",completed:"Klar",cancelled:"Avbokad",no_show:"Uteblev"},en:{draft:"Draft",requested:"Requested",confirmed:"Confirmed",completed:"Completed",cancelled:"Cancelled",no_show:"No-show"}},C={sv:{note:"Notering",call:"Samtal",email:"E-post",booking:"Bokning",status_change:"Statusändring",ai_conversation:"AI-dialog"},en:{note:"Note",call:"Call",email:"Email",booking:"Booking",status_change:"Status change",ai_conversation:"AI conversation"}},D={sv:{access:"Du saknar behörighet att lägga till noteringar.",disabled:"Noteringar är inte tillgängliga just nu.",title:"Rubriken saknas eller är för lång.",note:"Noteringen saknas eller är för lång.",save:"Noteringen kunde inte sparas. Försök igen eller kontrollera konfigurationen."},en:{access:"You do not have permission to add notes.",disabled:"Notes are not available right now.",title:"The title is missing or too long.",note:"The note is missing or too long.",save:"The note could not be saved. Try again or check the configuration."}};function t(a,b){return String(a.get(b)??"").trim()}function u(a,b){return"en"===b?`${a}${a.includes("?")?"&":"?"}lang=en`:a}function v(a){return a.trim().toLocaleLowerCase("sv-SE")}async function w(){let a=await (0,q.getUserWorkspaceAccess)();if(!a.ok||!(0,q.canManageWorkspaceSettings)(a))throw Error("An owner or admin workspace membership is required for customer notes");return a.workspaceId}function x(a,b,c){(0,i.redirect)(u(`/dashboard/kunder/${a}?error=${b}`,c))}let E=async function(a,b){let c="en"===t(b,"lang")?"en":"sv",d=await (0,q.getUserWorkspaceAccess)();d.ok&&(0,q.canManageWorkspaceSettings)(d)&&await (0,r.hasDashboardModuleAccess)("customer_crm")||x(a,"access",c);let e=t(b,"title"),g=t(b,"note");(!e||e.length>140)&&x(a,"title",c),(!g||g.length>1e3)&&x(a,"note",c),z||x(a,"disabled",c);let h=(0,f.neon)(z),j=await w();try{let b=await h`
      insert into customer_events (workspace_id, customer_id, booking_id, event_type, title, description, metadata)
      select workspace_id, id, null, 'note', ${e}, ${g}, jsonb_build_object('source', 'dashboard_manual')
      from customers
      where workspace_id = ${j} and id = ${a}
      returning id
    `;b[0]?.id||x(a,"save",c)}catch(b){console.error("Failed to create dashboard customer note",b),x(a,"save",c)}(0,i.redirect)(u(`/dashboard/kunder/${a}?note=created`,c))};async function y({params:a,searchParams:b}){let[{id:c},e]=await Promise.all([a,b??Promise.resolve(void 0)]),f=await (0,p.getDashboardCustomerDetail)(c);f||(0,i.notFound)();let{customer:g,bookings:q,events:r}=f,s=a=>{let b=e?.[a];return Array.isArray(b)?b[0]:b},t="en"===s("lang")?"en":"sv",w="en"===t,x=s("error"),z=x?D[t][x]:void 0,F=E.bind(null,g.id),G=A[t],H=B[t],I=C[t],J=w?[{label:"Status",value:G[g.status]??g.status,helper:"Current CRM status",icon:n.UserRound,tone:"bg-[#e9f2ec] text-[#17452f]"},{label:"Bookings",value:String(q.length),helper:"Connected bookings",icon:l.CalendarCheck2,tone:"bg-[#edf0f8] text-[#405582]"},{label:"Events",value:String(r.length),helper:"Recorded activities",icon:j.Activity,tone:"bg-[#f8f0df] text-[#8a6722]"},{label:"Notes",value:"Internal",helper:"Controlled customer notes",icon:m.MessageSquareText,tone:"bg-[#f0ece8] text-[#6d5948]"}]:[{label:"Status",value:G[g.status]??g.status,helper:"Aktuell CRM-status",icon:n.UserRound,tone:"bg-[#e9f2ec] text-[#17452f]"},{label:"Bokningar",value:String(q.length),helper:"Kopplade bokningar",icon:l.CalendarCheck2,tone:"bg-[#edf0f8] text-[#405582]"},{label:"Händelser",value:String(r.length),helper:"Registrerade aktiviteter",icon:j.Activity,tone:"bg-[#f8f0df] text-[#8a6722]"},{label:"Noteringar",value:"Intern",helper:"Kontrollerad kundnotering",icon:m.MessageSquareText,tone:"bg-[#f0ece8] text-[#6d5948]"}],K="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";return(0,d.jsxs)("div",{className:"grid gap-6",children:[(0,d.jsx)(o.DashboardPageHeader,{eyebrow:w?"Customer profile":"Kundprofil",title:g.name,description:w?"View the customer profile, bookings and history. Internal notes can be saved securely.":"Se kundens profil, bokningar och historik. Interna noteringar kan sparas kontrollerat med åtkomstkod.",icon:n.UserRound,actions:(0,d.jsxs)(h.default,{href:u("/dashboard/kunder",t),className:"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]",children:[(0,d.jsx)(k.ArrowLeft,{className:"h-4 w-4"}),w?"Back to customers":"Tillbaka till kunder"]})}),z?(0,d.jsx)("section",{className:"rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]",children:z}):null,"1"===s("created")?(0,d.jsx)("section",{className:"rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]",children:w?"The customer was created and the profile is ready for the next step.":"Kunden skapades och profilen är redo för nästa steg."}):null,"created"===s("note")?(0,d.jsx)("section",{className:"rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]",children:w?"The note was saved in the customer history. No booking was changed and no email was sent.":"Noteringen sparades i kundhistoriken. Ingen bokning ändrades och ingen e-post skickades."}):null,(0,d.jsx)(o.DashboardMetricGrid,{items:J}),(0,d.jsxs)("section",{className:"grid gap-6 lg:grid-cols-[1fr_360px]",children:[(0,d.jsxs)("div",{className:"grid gap-6",children:[(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:w?"Profile":"Profil"}),(0,d.jsxs)("div",{className:"mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2",children:[(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Customer type:":"Kundtyp:"})," ",g.type]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Location:":"Ort:"})," ",g.city]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Email:":"E-post:"})," ",g.email]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Phone:":"Telefon:"})," ",g.phone]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Company:":"Företag:"})," ",g.companyName]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Service:":"Tjänst:"})," ",g.service]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:w?"Created:":"Skapad:"})," ",g.createdAt]})]}),(0,d.jsxs)("p",{className:"mt-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]",children:[(0,d.jsx)("strong",{children:w?"Notes:":"Notering:"})," ",g.notes]})]}),(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:w?"Add note":"Lägg till notering"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#5b665f]",children:w?"Save an internal note in the customer history. No booking is changed and no email is sent.":"Sparar en intern notering i kundhistoriken. Ingen bokning ändras och ingen e-post skickas."}),(0,d.jsxs)("form",{action:F,className:"mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4",children:[(0,d.jsx)("input",{type:"hidden",name:"lang",value:t}),(0,d.jsxs)("label",{className:"grid gap-2 text-sm font-semibold text-[#17201a]",children:[w?"Title":"Rubrik",(0,d.jsx)("input",{name:"title",type:"text",required:!0,maxLength:140,className:K,placeholder:w?"For example: Follow-up":"Till exempel: Uppföljning"})]}),(0,d.jsxs)("label",{className:"grid gap-2 text-sm font-semibold text-[#17201a]",children:[w?"Note":"Notering",(0,d.jsx)("textarea",{name:"note",required:!0,maxLength:1e3,rows:5,className:K,placeholder:w?"Write an internal customer note...":"Skriv en intern kundnotering..."})]}),(0,d.jsx)("button",{type:"submit",className:"inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]",children:w?"Save note":"Spara notering"})]})]}),(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-[#dfe5dd] pb-4",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:w?"Bookings":"Bokningar"}),(0,d.jsx)("p",{className:"text-sm text-[#5b665f]",children:w?"Bookings connected to the customer.":"Bokningar kopplade till kunden."})]}),(0,d.jsx)("span",{className:"rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]",children:w?"Booking data":"Bokningsdata"})]}),0===q.length?(0,d.jsx)("p",{className:"mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]",children:w?"No bookings were found for this customer.":"Inga bokningar hittades för den här kunden."}):(0,d.jsx)("div",{className:"mt-5 space-y-3",children:q.map(a=>(0,d.jsxs)("div",{className:"grid gap-2 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center",children:[(0,d.jsx)("span",{className:"font-bold text-[#17452f]",children:a.time}),(0,d.jsxs)("span",{children:[(0,d.jsx)("strong",{children:a.title}),(0,d.jsx)("br",{}),(0,d.jsx)("span",{className:"text-sm text-[#5b665f]",children:v(a.title)===v(a.service)?a.city:`${a.city} \xb7 ${a.service}`})]}),(0,d.jsxs)("div",{className:"flex flex-wrap items-center gap-2 sm:justify-end",children:[(0,d.jsx)("span",{className:"rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]",children:H[a.status]??a.status}),(0,d.jsx)(h.default,{href:u(`/dashboard/bokningar/${a.id}`,t),className:"inline-flex min-h-9 items-center justify-center rounded-xl bg-[#173e2b] px-3 py-2 text-xs font-semibold !text-white",children:w?"View booking":"Visa bokning"})]})]},a.id))})]})]}),(0,d.jsxs)("aside",{className:"rounded-3xl bg-[#17452f] p-6 text-white",children:[(0,d.jsx)("h3",{className:"text-xl font-bold",children:w?"Customer history":"Kundhistorik"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-7 text-white/80",children:w?"Internal notes, booking events and other important customer history are collected here.":"Här samlas interna noteringar, bokningshändelser och annan viktig kundhistorik."}),(0,d.jsx)("div",{className:"mt-5 space-y-3",children:0===r.length?(0,d.jsx)("p",{className:"rounded-2xl bg-white/10 p-4 text-sm text-white/80",children:w?"No events were found.":"Inga händelser hittades."}):r.map(a=>(0,d.jsxs)("div",{className:"rounded-2xl bg-white/10 p-4",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between gap-3",children:[(0,d.jsx)("span",{className:"rounded-full bg-white/15 px-3 py-1 text-xs font-semibold",children:I[a.type]??a.type}),(0,d.jsx)("span",{className:"text-xs text-white/70",children:a.createdAt})]}),(0,d.jsx)("p",{className:"mt-3 font-semibold",children:a.title}),(0,d.jsx)("p",{className:"mt-2 text-sm leading-6 text-white/80",children:a.description})]},a.id))})]})]})]})}(0,e.registerServerReference)(E,"60ffef3a08a2a5490d95e5f051d375b4000d8946f6",null),a.s(["$$RSC_SERVER_ACTION_0",0,E,"default",0,y,"dynamic",0,"force-dynamic"]),c()}catch(a){c(a)}},!1),557607,a=>a.a(async(b,c)=>{try{var d=a.i(67693),e=a.i(40870),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s([]),c()}catch(a){c(a)}},!1),56397,a=>a.a(async(b,c)=>{try{var d=a.i(557607),e=a.i(67693),f=a.i(40870),g=b([d,e,f]);[d,e,f]=g.then?(await g)():g,a.s(["4068e27ed13f1f3adac9ee8279e91982c5554507df",()=>e.switchWorkspaceAction,"60ffef3a08a2a5490d95e5f051d375b4000d8946f6",()=>f.$$RSC_SERVER_ACTION_0]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_0kd7zv-._.js.map