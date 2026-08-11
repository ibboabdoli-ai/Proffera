module.exports=[952083,a=>{"use strict";function b(a){return a.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function c(a){let c,d=process.env.BREVO_API_KEY,e=process.env.LEAD_FROM_EMAIL;if(!d||!e)return{ok:!1,code:"configuration",message:"Brevo is not configured."};let f=(c=e.match(/^(.+?)\s*<([^>]+)>$/))?{name:c[1].trim(),email:c[2].trim()}:{name:"Proffera",email:e.trim()},g=function(a){let c="en"===a.language?"en":"sv",d=a.timeZone||"Europe/Stockholm",e=function(a,b,c){let d=new Date(a);if(Number.isNaN(d.getTime()))return a;try{return new Intl.DateTimeFormat("en"===b?"en-GB":"sv-SE",{dateStyle:"long",timeStyle:"short",timeZone:c}).format(d)}catch{return d.toISOString()}}(a.expiresAt,c,d);if("en"===c){let c=`How did we do? – ${a.companyName}`;return{subject:c,text:[`Hello ${a.customerName},`,"",`Thank you for choosing ${a.companyName}.`,`Your completed booking: ${a.bookingTitle}`,"\nShare your experience using your secure, one-time review link:",a.reviewUrl,"",`The link expires on ${e}.`,"\nKind regards,",a.companyName].join("\n"),html:`
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
    `}catch(a){console.error("Failed to audit verified review invitation email delivery",a)}}async function k(a){var b;let c=await (0,f.issueReviewInvitation)(a);if(!c.ok)return c;let e=(b=c.token,new URL(`/review/${encodeURIComponent(b)}`,function(a=process.env){return i(a.PROFFERA_APP_URL)??i(a.NEXT_PUBLIC_APP_URL)??i(a.VERCEL_PROJECT_PRODUCTION_URL)??i(a.VERCEL_URL)??"https://www.proffera.se"}()).toString());if(!c.customerEmail)return await j({bookingId:c.bookingId,outcome:"failed",failureCode:"missing_email",expiresAt:c.expiresAt}),{ok:!1,code:"missing_email",invitation:c,reviewUrl:e,emailError:"The completed booking does not have a customer email address."};let g=await (0,f.getReviewInvitationDashboardContext)(),h=await (0,d.sendVerifiedReviewInvitationEmail)({customerName:c.customerName??"Customer",customerEmail:c.customerEmail,companyName:g?.companyName??"Proffera",bookingTitle:c.bookingTitle,reviewUrl:e,expiresAt:c.expiresAt,language:g?.language==="en"?"en":"sv",timeZone:g?.timeZone??"Europe/Stockholm"});return(await j({bookingId:c.bookingId,outcome:h.ok?"sent":"failed",providerId:h.ok?h.providerId:null,failureCode:h.ok?null:h.code,expiresAt:c.expiresAt}),h.ok)?{ok:!0,invitation:c,reviewUrl:e,providerId:h.providerId}:{ok:!1,code:"email",invitation:c,reviewUrl:e,emailError:h.message}}[f,g]=h.then?(await h)():h,a.s(["deliverVerifiedReviewInvitation",0,k]),c()}catch(a){c(a)}},!1),983594,a=>{"use strict";let b=["new","assigned","in_progress","completed","cancelled"],c={new:["assigned","in_progress","cancelled"],assigned:["in_progress","cancelled"],in_progress:["completed","cancelled"],completed:[],cancelled:[]};a.s(["canTransitionWorkspaceServiceJob",0,function(a,b){return c[a].includes(b)},"getWorkspaceServiceJobTransitions",0,function(a){return c[a]},"isWorkspaceServiceJobStatus",0,function(a){return"string"==typeof a&&b.includes(a)}])},278126,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(998332),g=a.i(983594),h=a.i(87921),i=b([f,h]);[f,h]=i.then?(await i)():i;let t=(0,e.resolveDatabaseUrl)(),u=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function j(){return t?(0,d.neon)(t):null}function k(a){return null==a?"":String(a)}function l(a){return k(a).trim()||null}async function m(a=!1){let b=await (0,h.getUserWorkspaceAccess)();if(!b.ok||a&&!(0,h.canManageWorkspaceSettings)(b))throw Error(a?"An owner or admin workspace membership is required for service job changes":"Workspace access is required for service jobs");return b}function n(a){return{id:k(a.id),sourceType:k(a.source_type),quoteRequestId:k(a.quote_request_id),quoteOfferId:k(a.quote_offer_id),bookingId:k(a.booking_id),customerId:k(a.customer_id),customerName:k(a.customer_name),assignedStaffId:k(a.assigned_staff_id),assignedStaffName:k(a.assigned_staff_name),status:k(a.status),title:k(a.title),description:k(a.description),serviceName:k(a.service_name),city:k(a.city),scheduledStartsAt:k(a.scheduled_starts_at),scheduledEndsAt:k(a.scheduled_ends_at),currency:k(a.currency),totalMinor:null===a.total_minor||void 0===a.total_minor?null:Number(a.total_minor),completionSummary:k(a.completion_summary),completedAt:k(a.completed_at),cancelledAt:k(a.cancelled_at),createdAt:k(a.created_at),updatedAt:k(a.updated_at)}}let v=`
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
  `)[0])throw Error("Service job note did not match the active workspace")}a.s(["addDashboardWorkspaceServiceJobNote",0,s,"assignDashboardWorkspaceServiceJob",0,q,"getDashboardWorkspaceServiceJobDetail",0,p,"getDashboardWorkspaceServiceJobs",0,o,"transitionDashboardWorkspaceServiceJob",0,r]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=src_08dvlp9._.js.map