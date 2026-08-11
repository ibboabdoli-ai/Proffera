module.exports=[164240,(a,b,c)=>{"use strict";function d(a){if("function"!=typeof WeakMap)return null;var b=new WeakMap,c=new WeakMap;return(d=function(a){return a?c:b})(a)}c._=function(a,b){if(!b&&a&&a.__esModule)return a;if(null===a||"object"!=typeof a&&"function"!=typeof a)return{default:a};var c=d(b);if(c&&c.has(a))return c.get(a);var e={__proto__:null},f=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var g in a)if("default"!==g&&Object.prototype.hasOwnProperty.call(a,g)){var h=f?Object.getOwnPropertyDescriptor(a,g):null;h&&(h.get||h.set)?Object.defineProperty(e,g,h):e[g]=a[g]}return e.default=a,c&&c.set(a,e),e}},500790,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js <module evaluation>"))},784707,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/app-dir/link.js"))},297647,a=>{"use strict";a.i(500790);var b=a.i(784707);a.n(b)},395936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={default:function(){return i},useLinkStatus:function(){return h.useLinkStatus}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(164240),g=a.r(907997),h=f._(a.r(297647));function i(a){let b=a.legacyBehavior,c="string"==typeof a.children||"number"==typeof a.children||"string"==typeof a.children?.type,d=a.children?.type?.$$typeof===Symbol.for("react.client.reference");return!b||c||d||(a.children?.type?.$$typeof===Symbol.for("react.lazy")?console.error("Using a Lazy Component as a direct child of `<Link legacyBehavior>` from a Server Component is not supported. If you need legacyBehavior, wrap your Lazy Component in a Client Component that renders the Link's `<a>` tag."):console.error("Using a Server Component as a direct child of `<Link legacyBehavior>` is not supported. If you need legacyBehavior, wrap your Server Component in a Client Component that renders the Link's `<a>` tag.")),(0,g.jsx)(h.default,{...a})}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},708174,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation>","default")},990697,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs","default")},653808,a=>{"use strict";a.i(708174);var b=a.i(990697);a.n(b)},892277,a=>{"use strict";var b=a.i(800717);let c=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var d=a.i(653808);a.s(["default",0,(a,e)=>{let f=(0,b.forwardRef)(({className:f,...g},h)=>(0,b.createElement)(d.default,{ref:h,iconNode:e,className:((...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim())(`lucide-${c(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,f),...g}));return f.displayName=c(a),f}],892277)},238444,a=>{"use strict";var b=a.i(907997);a.s(["DashboardDataPanel",0,function({title:a,description:c,count:d,children:e}){return(0,b.jsxs)("section",{className:"overflow-hidden rounded-[24px] border border-[#e0e5dd] bg-white shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]",children:[(0,b.jsxs)("div",{className:"flex flex-col gap-3 border-b border-[#e5e9e2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h3",{className:"text-lg font-bold tracking-tight text-[#17201a]",children:a}),(0,b.jsx)("p",{className:"mt-1 text-sm leading-6 text-[#667168]",children:c})]}),(0,b.jsxs)("span",{className:"inline-flex w-fit items-center rounded-full bg-[#eaf2ec] px-3 py-1.5 text-xs font-bold text-[#17452f]",children:[d," ",1===d?"post":"poster"]})]}),e]})},"DashboardMetricGrid",0,function({items:a}){return(0,b.jsx)("section",{className:"grid gap-3 sm:grid-cols-2 xl:grid-cols-4","aria-label":"Sidöversikt",children:a.map(a=>(0,b.jsxs)("article",{className:"rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_10px_26px_rgba(20,43,32,0.035)] transition hover:-translate-y-0.5 hover:border-[#cfd8cd] hover:shadow-[0_14px_30px_rgba(20,43,32,0.07)]",children:[(0,b.jsxs)("div",{className:"flex items-start justify-between gap-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-[11px] font-bold uppercase tracking-[0.1em] text-[#778179]",children:a.label}),(0,b.jsx)("p",{className:"mt-3 text-3xl font-bold tracking-tight text-[#173e2b]",children:a.value})]}),(0,b.jsx)("span",{className:`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`,children:(0,b.jsx)(a.icon,{className:"h-[18px] w-[18px]","aria-hidden":"true"})})]}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-5 text-[#6a756d]",children:a.helper})]},a.label))})},"DashboardPageHeader",0,function({eyebrow:a,title:c,description:d,icon:e,actions:f}){return(0,b.jsxs)("section",{className:"relative overflow-hidden rounded-[24px] border border-[#dfe5dd] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.05)] sm:px-7 sm:py-7 lg:px-8",children:[(0,b.jsx)("div",{className:"absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#eaf2ec] blur-2xl","aria-hidden":"true"}),(0,b.jsxs)("div",{className:"relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",children:[(0,b.jsxs)("div",{className:"flex max-w-3xl items-start gap-4",children:[(0,b.jsx)("span",{className:"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#173e2b] text-white shadow-lg shadow-[#173e2b]/15",children:(0,b.jsx)(e,{className:"h-5 w-5","aria-hidden":"true"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-bold uppercase tracking-[0.14em] text-[#17452f]",children:a}),(0,b.jsx)("h2",{className:"mt-2 text-2xl font-bold tracking-[-0.025em] text-[#17201a] sm:text-3xl",children:c}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#667168] sm:text-[15px]",children:d})]})]}),f?(0,b.jsx)("div",{className:"flex shrink-0 flex-col gap-2 sm:flex-row",children:f}):null]})]})}])},137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},67693,a=>a.a(async(b,c)=>{try{var d=a.i(137936),e=a.i(905246);a.i(570396);var f=a.i(673727),g=a.i(87921),h=a.i(713095),i=b([g]);async function j(a){let b=String(a.get("workspace_id")??"");(await (0,g.getUserWorkspaceOptions)()).some(a=>a.id===b)||(0,f.redirect)("/dashboard?workspace=invalid"),(await (0,e.cookies)()).set(g.selectedWorkspaceCookieName,b,{httpOnly:!0,sameSite:"lax",secure:!0,path:"/",maxAge:31536e3}),(0,f.redirect)("/dashboard")}[g]=i.then?(await i)():i,(0,h.ensureServerEntryExports)([j]),(0,d.registerServerReference)(j,"4068e27ed13f1f3adac9ee8279e91982c5554507df",null),a.s(["switchWorkspaceAction",0,j]),c()}catch(a){c(a)}},!1),672607,a=>{"use strict";let b=(0,a.i(892277).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",0,b],672607)},784930,a=>{"use strict";let b=(0,a.i(892277).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);a.s(["ArrowLeft",0,b],784930)},737185,a=>{"use strict";let b=(0,a.i(892277).default)("file-text",[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);a.s(["FileText",0,b],737185)},527792,a=>{"use strict";let b=(0,a.i(892277).default)("clipboard-check",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]]);a.s(["ClipboardCheck",0,b],527792)},95133,a=>{"use strict";let b=(0,a.i(892277).default)("circle-x",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);a.s(["XCircle",0,b],95133)},679767,a=>{"use strict";let b=(0,a.i(892277).default)("activity",[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]);a.s(["Activity",0,b],679767)},952083,a=>{"use strict";function b(a){return a.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function c(a){let c,d=process.env.BREVO_API_KEY,e=process.env.LEAD_FROM_EMAIL;if(!d||!e)return{ok:!1,code:"configuration",message:"Brevo is not configured."};let f=(c=e.match(/^(.+?)\s*<([^>]+)>$/))?{name:c[1].trim(),email:c[2].trim()}:{name:"Proffera",email:e.trim()},g=function(a){let c="en"===a.language?"en":"sv",d=a.timeZone||"Europe/Stockholm",e=function(a,b,c){let d=new Date(a);if(Number.isNaN(d.getTime()))return a;try{return new Intl.DateTimeFormat("en"===b?"en-GB":"sv-SE",{dateStyle:"long",timeStyle:"short",timeZone:c}).format(d)}catch{return d.toISOString()}}(a.expiresAt,c,d);if("en"===c){let c=`How did we do? – ${a.companyName}`;return{subject:c,text:[`Hello ${a.customerName},`,"",`Thank you for choosing ${a.companyName}.`,`Your completed booking: ${a.bookingTitle}`,"\nShare your experience using your secure, one-time review link:",a.reviewUrl,"",`The link expires on ${e}.`,"\nKind regards,",a.companyName].join("\n"),html:`
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
        <p>Hello ${b(a.customerName)},</p>
        <p>Thank you for choosing <strong>${b(a.companyName)}</strong>.</p>
        <p>Your completed booking: <strong>${b(a.bookingTitle)}</strong></p>
        <p style="margin:28px 0;">
          <a href="${b(a.reviewUrl)}" style="display:inline-block;border-radius:12px;background:#173e2b;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700;">Leave a verified review</a>
        </p>
        <p>This secure link can be used once and expires on ${b(e)}.</p>
        <p>Kind regards<br />${b(a.companyName)}</p>
      </div>
    `}}let f=`Hur gick det? – ${a.companyName}`;return{subject:f,text:[`Hej ${a.customerName},`,"",`Tack f\xf6r att du valde ${a.companyName}.`,`Din slutf\xf6rda bokning: ${a.bookingTitle}`,"\nDela din upplevelse via din säkra engångslänk:",a.reviewUrl,"",`L\xe4nken g\xe4ller till ${e}.`,"\nMed vänliga hälsningar",a.companyName].join("\n"),html:`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
      <p>Hej ${b(a.customerName)},</p>
      <p>Tack f\xf6r att du valde <strong>${b(a.companyName)}</strong>.</p>
      <p>Din slutf\xf6rda bokning: <strong>${b(a.bookingTitle)}</strong></p>
      <p style="margin:28px 0;">
        <a href="${b(a.reviewUrl)}" style="display:inline-block;border-radius:12px;background:#173e2b;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700;">L\xe4mna ett verifierat omd\xf6me</a>
      </p>
      <p>Den s\xe4kra l\xe4nken kan anv\xe4ndas en g\xe5ng och g\xe4ller till ${b(e)}.</p>
      <p>Med v\xe4nliga h\xe4lsningar<br />${b(a.companyName)}</p>
    </div>
  `}}(a);try{let b=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":d,"Content-Type":"application/json"},body:JSON.stringify({sender:f,to:[{email:a.customerEmail,name:a.customerName}],subject:g.subject,textContent:g.text,htmlContent:g.html})}),c=await b.json().catch(()=>({}));if(!b.ok)return{ok:!1,code:"provider",message:c.message??c.code??"Brevo rejected the review invitation email."};return{ok:!0,providerId:c.messageId??null}}catch{return{ok:!1,code:"network",message:"Could not contact Brevo."}}}a.s(["sendVerifiedReviewInvitationEmail",0,c])},998332,a=>a.a(async(b,c)=>{try{var d=a.i(952083),e=a.i(295946),f=a.i(789852),g=a.i(87921),h=b([f,g]);function i(a){let b=a?.trim();if(!b)return null;try{let a=new URL(b.includes("://")?b:`https://${b}`),c="localhost"===a.hostname||"127.0.0.1"===a.hostname;if("https:"!==a.protocol&&!(c&&"http:"===a.protocol))return null;return a.origin}catch{return null}}async function j(a){let[b,c]=await Promise.all([(0,g.getUserWorkspaceAccess)(),Promise.resolve((0,e.getSql)())]);if(b.ok&&c)try{await c`
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      ) values (
        ${b.userId},
        ${b.workspaceId}::uuid,
        ${"sent"===a.outcome?"website_review.invitation_email_sent":"website_review.invitation_email_failed"},
        ${"sent"===a.outcome?"Verified review invitation email sent":"Verified review invitation email delivery failed"},
        null,
        ${JSON.stringify({booking_id:a.bookingId,invitation_id:a.invitationId??null,outcome:a.outcome,provider_id:a.providerId??null,failure_code:a.failureCode??null,expires_at:a.expiresAt})}::jsonb
      )
    `}catch(a){console.error("Failed to audit verified review invitation email delivery",a)}}async function k(a){var b;let c=await (0,f.issueReviewInvitation)(a);if(!c.ok)return c;let e=(b=c.token,new URL(`/review/${encodeURIComponent(b)}`,function(a=process.env){return i(a.PROFFERA_APP_URL)??i(a.NEXT_PUBLIC_APP_URL)??i(a.VERCEL_PROJECT_PRODUCTION_URL)??i(a.VERCEL_URL)??"https://www.proffera.se"}()).toString());if(!c.customerEmail)return await j({bookingId:c.bookingId,outcome:"failed",failureCode:"missing_email",expiresAt:c.expiresAt}),{ok:!1,code:"missing_email",invitation:c,reviewUrl:e,emailError:"The completed booking does not have a customer email address."};let g=await (0,f.getReviewInvitationDashboardContext)(),h=await (0,d.sendVerifiedReviewInvitationEmail)({customerName:c.customerName??"Customer",customerEmail:c.customerEmail,companyName:g?.companyName??"Proffera",bookingTitle:c.bookingTitle,reviewUrl:e,expiresAt:c.expiresAt,language:g?.language==="en"?"en":"sv",timeZone:g?.timeZone??"Europe/Stockholm"});return(await j({bookingId:c.bookingId,outcome:h.ok?"sent":"failed",providerId:h.ok?h.providerId:null,failureCode:h.ok?null:h.code,expiresAt:c.expiresAt}),h.ok)?{ok:!0,invitation:c,reviewUrl:e,providerId:h.providerId}:{ok:!1,code:"email",invitation:c,reviewUrl:e,emailError:h.message}}[f,g]=h.then?(await h)():h,a.s(["deliverVerifiedReviewInvitation",0,k]),c()}catch(a){c(a)}},!1),585670,a=>{"use strict";let b=(0,a.i(892277).default)("user-round-check",[["path",{d:"M2 21a8 8 0 0 1 13.292-6",key:"bjp14o"}],["circle",{cx:"10",cy:"8",r:"5",key:"o932ke"}],["path",{d:"m16 19 2 2 4-4",key:"1b14m6"}]]);a.s(["UserRoundCheck",0,b],585670)},983594,a=>{"use strict";let b=["new","assigned","in_progress","completed","cancelled"],c={new:["assigned","in_progress","cancelled"],assigned:["in_progress","cancelled"],in_progress:["completed","cancelled"],completed:[],cancelled:[]};a.s(["canTransitionWorkspaceServiceJob",0,function(a,b){return c[a].includes(b)},"getWorkspaceServiceJobTransitions",0,function(a){return c[a]},"isWorkspaceServiceJobStatus",0,function(a){return"string"==typeof a&&b.includes(a)}])},278126,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(998332),g=a.i(983594),h=a.i(87921),i=b([f,h]);[f,h]=i.then?(await i)():i;let t=(0,e.resolveDatabaseUrl)(),u=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function j(){return t?(0,d.neon)(t):null}function k(a){return null==a?"":String(a)}function l(a){return k(a).trim()||null}async function m(a=!1){let b=await (0,h.getUserWorkspaceAccess)();if(!b.ok||a&&!(0,h.canManageWorkspaceSettings)(b))throw Error(a?"An owner or admin workspace membership is required for service job changes":"Workspace access is required for service jobs");return b}function n(a){return{id:k(a.id),sourceType:k(a.source_type),quoteRequestId:k(a.quote_request_id),quoteOfferId:k(a.quote_offer_id),bookingId:k(a.booking_id),customerId:k(a.customer_id),customerName:k(a.customer_name),assignedStaffId:k(a.assigned_staff_id),assignedStaffName:k(a.assigned_staff_name),status:k(a.status),title:k(a.title),description:k(a.description),serviceName:k(a.service_name),city:k(a.city),scheduledStartsAt:k(a.scheduled_starts_at),scheduledEndsAt:k(a.scheduled_ends_at),currency:k(a.currency),totalMinor:null===a.total_minor||void 0===a.total_minor?null:Number(a.total_minor),completionSummary:k(a.completion_summary),completedAt:k(a.completed_at),cancelledAt:k(a.cancelled_at),createdAt:k(a.created_at),updatedAt:k(a.updated_at)}}let v=`
  select
    job.id,
    job.source_type,
    job.quote_request_id,
    job.quote_offer_id,
    job.booking_id,
    job.customer_id,
    coalesce(customer.name, quote_request.customer_name, '') as customer_name,
    job.assigned_staff_id,
    coalesce(staff.name, '') as assigned_staff_name,
    job.status,
    job.title,
    job.description,
    job.service_name,
    job.city,
    job.scheduled_starts_at,
    job.scheduled_ends_at,
    job.currency,
    job.total_minor,
    job.completion_summary,
    job.completed_at,
    job.cancelled_at,
    job.created_at,
    job.updated_at
  from workspace_service_jobs job
  left join customers customer
    on customer.id = job.customer_id
   and customer.workspace_id = job.workspace_id::text
  left join workspace_quote_requests quote_request
    on quote_request.id = job.quote_request_id
   and quote_request.workspace_id = job.workspace_id
  left join workspace_staff staff
    on staff.id = job.assigned_staff_id
   and staff.workspace_id = job.workspace_id::text
`;async function o(){let a=j();if(!a)return[];let b=await m();return(await a.query(`${v}
    where job.workspace_id = $1::uuid
    order by
      case job.status
        when 'in_progress' then 0
        when 'assigned' then 1
        when 'new' then 2
        when 'completed' then 3
        else 4
      end,
      job.scheduled_starts_at asc nulls last,
      job.created_at desc`,[b.workspaceId])).map(a=>n(a))}async function p(a){if(!u.test(a))return null;let b=j();if(!b)return null;let c=await m(),[d,e,f,g,h,i]=await Promise.all([b.query(`${v}
      where job.workspace_id = $1::uuid
        and job.id = $2::uuid
      limit 1`,[c.workspaceId,a]),b`
      select id, event_type, from_status, to_status, summary, created_at
      from workspace_service_job_events
      where workspace_id = ${c.workspaceId}::uuid
        and service_job_id = ${a}::uuid
      order by created_at desc
      limit 100
    `,b`
      select id, body, created_at
      from workspace_service_job_notes
      where workspace_id = ${c.workspaceId}::uuid
        and service_job_id = ${a}::uuid
      order by created_at desc
      limit 100
    `,b`
      select id, kind, file_name, content_type, byte_size, created_at
      from workspace_service_job_attachments
      where workspace_id = ${c.workspaceId}::uuid
        and service_job_id = ${a}::uuid
      order by created_at desc
      limit 100
    `,b`
      select id, evidence_type, description, attachment_id, created_at
      from workspace_service_job_completion_evidence
      where workspace_id = ${c.workspaceId}::uuid
        and service_job_id = ${a}::uuid
      order by created_at desc
      limit 100
    `,b`
      select id, name
      from workspace_staff
      where workspace_id = ${c.workspaceId}
        and is_active = true
      order by sort_order asc, name asc
    `]);return d[0]?{job:n(d[0]),events:e.map(a=>({id:k(a.id),eventType:k(a.event_type),fromStatus:k(a.from_status),toStatus:k(a.to_status),summary:k(a.summary),createdAt:k(a.created_at)})),notes:f.map(a=>({id:k(a.id),body:k(a.body),createdAt:k(a.created_at)})),attachments:g.map(a=>({id:k(a.id),kind:k(a.kind),fileName:k(a.file_name),contentType:k(a.content_type),byteSize:null===a.byte_size||void 0===a.byte_size?null:Number(a.byte_size),createdAt:k(a.created_at)})),evidence:h.map(a=>({id:k(a.id),evidenceType:k(a.evidence_type),description:k(a.description),attachmentId:k(a.attachment_id),createdAt:k(a.created_at)})),staff:i.map(a=>({id:k(a.id),name:k(a.name)}))}:null}async function q(a,b){if(!u.test(a)||!u.test(b))throw Error("Invalid service job assignment");let c=j();if(!c)throw Error("Missing database connection for service job assignment");let d=await m(!0);if(!(await c`
    with current_job as (
      select id, workspace_id, status, assigned_staff_id
      from workspace_service_jobs
      where id = ${a}::uuid
        and workspace_id = ${d.workspaceId}::uuid
        and status in ('new', 'assigned', 'in_progress')
      for update
    ),
    target_staff as (
      select
        current.id as job_id,
        current.workspace_id,
        current.status,
        current.assigned_staff_id,
        staff.id as staff_id
      from current_job current
      join workspace_staff staff
        on staff.id = ${b}::uuid
       and staff.workspace_id = current.workspace_id::text
       and staff.is_active = true
    ),
    assigned_job as (
      update workspace_service_jobs job
      set
        assigned_staff_id = target.staff_id,
        status = case when job.status = 'new' then 'assigned' else job.status end,
        updated_at = now()
      from target_staff target
      where job.id = target.job_id
        and job.workspace_id = target.workspace_id
        and job.assigned_staff_id is distinct from target.staff_id
      returning
        job.id,
        job.workspace_id,
        target.status as old_status,
        job.status as new_status,
        target.staff_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        id,
        'assigned',
        old_status,
        new_status,
        'Service job assigned to an active staff member.',
        jsonb_build_object('staff_id', staff_id),
        ${d.userId}
      from assigned_job
      returning id
    )
    select id from assigned_job
    union all
    select job_id as id
    from target_staff
    where assigned_staff_id = staff_id
    limit 1
  `)[0])throw Error("Service job assignment did not match an active staff member")}async function r(a,b,c){if(!(0,g.isWorkspaceServiceJobStatus)(b))throw Error("Invalid service job status");if(!u.test(a))throw Error("Invalid service job");let d=j();if(!d)throw Error("Missing database connection for service job status update");let e=await m(!0),h=await d`
    select status
    from workspace_service_jobs
    where id = ${a}::uuid
      and workspace_id = ${e.workspaceId}::uuid
    limit 1
  `,i=k(h[0]?.status);if(!(0,g.isWorkspaceServiceJobStatus)(i)||!(0,g.canTransitionWorkspaceServiceJob)(i,b))throw Error("Invalid service job transition");let n=l(c);if("completed"===b&&(!n||n.length>5e3))throw Error("Completion evidence is required when completing a service job");let o=`Service job status changed from ${i} to ${b}.`,p=await d`
    with updated_job as (
      update workspace_service_jobs
      set
        status = ${b},
        completion_summary = case when ${b} = 'completed' then ${n} else completion_summary end,
        completed_at = case when ${b} = 'completed' then now() else completed_at end,
        cancelled_at = case when ${b} = 'cancelled' then now() else cancelled_at end,
        updated_at = now()
      where id = ${a}::uuid
        and workspace_id = ${e.workspaceId}::uuid
        and status = ${i}
      returning id, workspace_id, booking_id, customer_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        id,
        'status_changed',
        ${i},
        ${b},
        ${o},
        jsonb_build_object('source', 'dashboard'),
        ${e.userId}
      from updated_job
      returning id
    ),
    completion_evidence as (
      insert into workspace_service_job_completion_evidence (
        workspace_id, service_job_id, evidence_type, description, created_by_user_id
      )
      select workspace_id, id, 'note', ${n}, ${e.userId}
      from updated_job
      where ${b} = 'completed'
      returning id, workspace_id, service_job_id
    ),
    evidence_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        service_job_id,
        'completion_evidence_added',
        'Completion evidence recorded.',
        jsonb_build_object('evidence_type', 'note'),
        ${e.userId}
      from completion_evidence
      returning id
    ),
    customer_timeline_event as (
      insert into customer_events (
        workspace_id,
        customer_id,
        booking_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        workspace_id::text,
        customer_id,
        booking_id,
        'status_change',
        'Service job updated',
        ${o},
        jsonb_build_object(
          'source', 'dashboard_service_job',
          'service_job_id', id,
          'from_status', ${i},
          'to_status', ${b}
        )
      from updated_job
      where customer_id is not null
      returning id
    ),
    synced_booking as (
      update bookings booking
      set
        status = case when ${b} = 'completed' then 'completed' else 'cancelled' end,
        updated_at = now()
      from updated_job job
      where booking.id = job.booking_id
        and booking.workspace_id = job.workspace_id::text
        and ${b} in ('completed', 'cancelled')
        and booking.status not in ('completed', 'cancelled', 'no_show')
      returning booking.id
    )
    select id, booking_id from updated_job
  `;if(!p[0])throw Error("Service job status did not update");let q=k(p[0].booking_id);if("completed"===b&&q)try{await (0,f.deliverVerifiedReviewInvitation)(q)}catch(a){console.error("Failed to deliver verified review invitation after service job completion",a)}}async function s(a,b){let c=l(b);if(!c||c.length>5e3)throw Error("Service job note must be between 1 and 5000 characters");if(!u.test(a))throw Error("Invalid service job");let d=j();if(!d)throw Error("Missing database connection for service job notes");let e=await m(!0);if(!(await d`
    with inserted_note as (
      insert into workspace_service_job_notes (workspace_id, service_job_id, body, author_user_id)
      select ${e.workspaceId}::uuid, job.id, ${c}, ${e.userId}
      from workspace_service_jobs job
      where job.id = ${a}::uuid
        and job.workspace_id = ${e.workspaceId}::uuid
      returning id, workspace_id, service_job_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        service_job_id,
        'note_added',
        'Service job note added.',
        jsonb_build_object('note_id', id),
        ${e.userId}
      from inserted_note
      returning id
    )
    select id from inserted_note
  `)[0])throw Error("Service job note did not match the active workspace")}a.s(["addDashboardWorkspaceServiceJobNote",0,s,"assignDashboardWorkspaceServiceJob",0,q,"getDashboardWorkspaceServiceJobDetail",0,p,"getDashboardWorkspaceServiceJobs",0,o,"transitionDashboardWorkspaceServiceJob",0,r]),c()}catch(a){c(a)}},!1),385426,a=>a.a(async(b,c)=>{try{var d=a.i(67693),e=a.i(219548),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s([]),c()}catch(a){c(a)}},!1),532998,a=>a.a(async(b,c)=>{try{var d=a.i(385426),e=a.i(67693),f=a.i(219548),g=b([d,e,f]);[d,e,f]=g.then?(await g)():g,a.s(["4068e27ed13f1f3adac9ee8279e91982c5554507df",()=>e.switchWorkspaceAction,"60060e1fd86596328c0d8f730f5ae10431d3d4cef0",()=>f.$$RSC_SERVER_ACTION_2,"6067ceee7d51a4e5a6d88d0cbd5dfdbb5bc14696ee",()=>f.$$RSC_SERVER_ACTION_0,"60f9e5712debce91d6da934af0e2500ca472c2e37d",()=>f.$$RSC_SERVER_ACTION_1]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_127gmov._.js.map