module.exports=[714518,a=>{"use strict";let b=(0,a.i(892277).default)("camera",[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]]);a.s(["Camera",0,b],714518)},383178,a=>{"use strict";let b=(0,a.i(892277).default)("list-checks",[["path",{d:"M13 5h8",key:"a7qcls"}],["path",{d:"M13 12h8",key:"h98zly"}],["path",{d:"M13 19h8",key:"c3s6r1"}],["path",{d:"m3 17 2 2 4-4",key:"1jhpwq"}],["path",{d:"m3 7 2 2 4-4",key:"1obspn"}]]);a.s(["ListChecks",0,b],383178)},918635,a=>{"use strict";let b=(0,a.i(892277).default)("sticky-note",[["path",{d:"M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z",key:"1dfntj"}],["path",{d:"M15 3v5a1 1 0 0 0 1 1h5",key:"6s6qgf"}]]);a.s(["StickyNote",0,b],918635)},589717,a=>{"use strict";function b(a){return a.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function c(a,b="Europe/Stockholm"){let d=new Date(a);return Number.isNaN(d.getTime())?a:new Intl.DateTimeFormat("sv-SE",{timeZone:b,dateStyle:"full",timeStyle:"short"}).format(d)}async function d(a){let d=process.env.BREVO_API_KEY,e=process.env.LEAD_FROM_EMAIL;if(!d||!e)return{ok:!1,message:"Brevo är inte konfigurerat."};let f=c(a.previousStartsAt,a.timeZone),g=c(a.startsAt,a.timeZone),h=c(a.endsAt,a.timeZone),i=`Din bokning har flyttats – ${a.companyName}`,j=[`Hej ${a.customerName},`,"",`Din bokning hos ${a.companyName} har f\xe5tt en ny tid.`,"",`Tidigare start: ${f}`,`Ny start: ${g}`,`Ny sluttid: ${h}`,`Tj\xe4nst: ${a.service}`,a.city?`Ort: ${a.city}`:"","","Kontakta företaget om den nya tiden inte passar.","","Med vänliga hälsningar",a.companyName].filter(Boolean).join("\n"),k=`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
      <p>Hej ${b(a.customerName)},</p>
      <p>Din bokning hos <strong>${b(a.companyName)}</strong> har f\xe5tt en ny tid.</p>
      <ul>
        <li><strong>Tidigare start:</strong> ${b(f)}</li>
        <li><strong>Ny start:</strong> ${b(g)}</li>
        <li><strong>Ny sluttid:</strong> ${b(h)}</li>
        <li><strong>Tj\xe4nst:</strong> ${b(a.service)}</li>
        ${a.city?`<li><strong>Ort:</strong> ${b(a.city)}</li>`:""}
      </ul>
      <p>Kontakta f\xf6retaget om den nya tiden inte passar.</p>
      <p>Med v\xe4nliga h\xe4lsningar<br />${b(a.companyName)}</p>
    </div>
  `;try{let b,c=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":d,"Content-Type":"application/json"},body:JSON.stringify({sender:(b=e.match(/^(.+?)\s*<([^>]+)>$/))?{name:b[1].trim(),email:b[2].trim()}:{name:"Proffera",email:e.trim()},to:[{email:a.customerEmail,name:a.customerName}],subject:i,textContent:j,htmlContent:k})}),f=await c.json().catch(()=>({}));if(!c.ok)return{ok:!1,message:f.message??f.code??"Kunde inte skicka ombokningsmejl."};return{ok:!0,providerId:f.messageId??null}}catch{return{ok:!1,message:"Kunde inte kontakta Brevo."}}}a.s(["sendBookingRescheduleEmail",0,d])},634384,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(600375),g=a.i(87921),h=b([g]);[g]=h.then?(await h)():h;let l=(0,e.resolveDatabaseUrl)();function i(a,b=""){return null==a?b:String(a)}function j(a,b){if(!a)return"Ej bokad";let c=a instanceof Date?a:new Date(String(a));return Number.isNaN(c.getTime())?"Ej bokad":new Intl.DateTimeFormat("sv-SE",{dateStyle:"medium",timeStyle:"short",timeZone:b}).format(c)}async function k(a){if(!l)return null;let b=await (0,g.getUserWorkspaceAccess)();if(!b.ok)throw Error("A valid workspace membership is required for dashboard data");let c=(0,d.neon)(l);try{let[d,e]=await Promise.all([c`
      select
        b.id,
        b.customer_id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        b.ends_at,
        b.source,
        b.notes,
        b.created_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name as customer_company_name,
        c.customer_type,
        c.city as customer_city,
        c.status as customer_status,
        c.source as customer_source,
        c.primary_service_slug as customer_service_slug,
        c.notes as customer_notes,
        c.created_at as customer_created_at
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${b.workspaceId}
        and b.id = ${a}
      limit 1
      `,c`
        select time_zone
        from workspace_settings
        where workspace_id = ${b.workspaceId}
        limit 1
      `]),g=(0,f.resolveBookingTimeZone)(e[0]?.time_zone),h=d[0];if(!h)return null;let k=await c`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id = ${b.workspaceId}
        and booking_id = ${a}
      order by created_at desc
      limit 20
    `,l=i(h.customer_id);return{booking:{id:i(h.id),time:j(h.starts_at,g),title:i(h.title,"Namnlös bokning"),customer:i(h.customer_name,"Okänd kund"),status:i(h.status,"requested"),city:i(h.city,"Okänd ort"),service:i(h.service,"Ej vald tjänst"),customerId:l,endsAt:j(h.ends_at,g),source:i(h.source,"Okänd källa"),notes:i(h.notes,"Ingen notering"),createdAt:j(h.created_at,g)},customer:l?{id:l,name:i(h.customer_name,"Namnlös kund"),type:"company"===i(h.customer_type)?"Företag":"Privatkund",city:i(h.customer_city,"Okänd ort"),status:i(h.customer_status,"prospect"),service:i(h.customer_service_slug,"Ej valt"),notes:i(h.customer_notes,"Ingen notering"),email:i(h.customer_email,"Ingen e-post"),phone:i(h.customer_phone,"Inget telefonnummer"),companyName:i(h.customer_company_name,"Ej företag"),source:i(h.customer_source,"Okänd källa"),createdAt:j(h.customer_created_at,g)}:null,events:k.map(a=>({id:i(a.id),type:i(a.event_type,"note"),title:i(a.title,"Namnlös händelse"),description:i(a.description,"Ingen beskrivning"),createdAt:j(a.created_at,g)}))}}catch(a){return console.error("Failed to read dashboard booking detail",a),null}}a.s(["getDashboardBookingDetailInStockholm",0,k]),c()}catch(a){c(a)}},!1),827744,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(600375),g=a.i(87921),h=b([g]);[g]=h.then?(await h)():h;let j=(0,e.resolveDatabaseUrl)();class k extends Error{code;constructor(a){super(a),this.code=a,this.name="BookingRescheduleValidationError"}}async function i(a,b){if(!j)throw Error("Missing database connection for dashboard booking reschedule");let c=await (0,g.getUserWorkspaceAccess)();if(!c.ok||!(0,g.canManageWorkspaceSettings)(c))throw Error("An owner or admin workspace membership is required for booking updates");let e=(0,d.neon)(j),h=await e`
    select time_zone
    from workspace_settings
    where workspace_id = ${c.workspaceId}
    limit 1
  `,i=(0,f.resolveBookingTimeZone)(h[0]?.time_zone),l=(0,f.parseLocalDateTime)(b);if(!l)throw new k("time");let m=(0,f.localDateTimeToUtc)(l,i);if(!(0,f.isValidLocalTime)(l,m,i)||Number.isNaN(m.getTime()))throw new k("time");if(m<=new Date)throw new k("past");let n=(await e`
    select
      b.id,
      b.workspace_id,
      b.customer_id,
      b.staff_id,
      b.status,
      b.service,
      b.city,
      b.starts_at,
      b.ends_at,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone
    from bookings b
    left join customers c
      on c.id = b.customer_id
     and c.workspace_id = b.workspace_id
    where b.workspace_id = ${c.workspaceId}
      and b.id = ${a}
    limit 1
  `)[0];if(!n)throw Error("Booking reschedule did not match a booking");if(!["requested","confirmed"].includes(String(n.status)))throw new k("status");let o=new Date(String(n.starts_at)),p=new Date(String(n.ends_at)),q=p.getTime()-o.getTime();if(!Number.isFinite(q)||q<=0)throw new k("time");let r=new Date(m.getTime()+q);if((await e`
    select id
    from bookings
    where workspace_id = ${c.workspaceId}
      and id <> ${a}
      and status not in ('cancelled', 'no_show')
      and starts_at is not null
      and ends_at is not null
      and starts_at < ${r.toISOString()}::timestamptz
      and ends_at > ${m.toISOString()}::timestamptz
    limit 1
  `)[0])throw new k("conflict");if(n.staff_id&&String(n.workspace_id)===c.workspaceId){let a=String(n.staff_id),b=(await e`
      select
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${c.workspaceId}
            and ss.staff_id = ${a}::uuid
            and ss.is_active = true
        ) as has_schedule,
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${c.workspaceId}
            and ss.staff_id = ${a}::uuid
            and ss.is_active = true
            and ss.weekday = extract(dow from (${m.toISOString()}::timestamptz at time zone ${i}))::int
            and ss.start_time <= (${m.toISOString()}::timestamptz at time zone ${i})::time
            and ss.end_time >= (${r.toISOString()}::timestamptz at time zone ${i})::time
            and (${m.toISOString()}::timestamptz at time zone ${i})::date = (${r.toISOString()}::timestamptz at time zone ${i})::date
        ) as inside_schedule,
        exists(
          select 1 from workspace_staff_time_off t
          where t.workspace_id = ${c.workspaceId}
            and t.staff_id = ${a}::uuid
            and t.starts_at < ${r.toISOString()}::timestamptz
            and t.ends_at > ${m.toISOString()}::timestamptz
        ) as has_time_off
    `)[0];if(b?.has_time_off||b?.has_schedule&&!b?.inside_schedule)throw new k("conflict")}return o.getTime()===m.getTime()?{changed:!1,timeZone:i,notification:null}:(await e`
    with updated_booking as (
      update bookings
      set starts_at = ${m.toISOString()}::timestamptz,
          ends_at = ${r.toISOString()}::timestamptz,
          updated_at = now()
      where workspace_id = ${c.workspaceId}
        and id = ${a}
        and status in ('requested', 'confirmed')
      returning id, workspace_id, customer_id
    ),
    updated_job as (
      update workspace_service_jobs job
      set scheduled_starts_at = ${m.toISOString()}::timestamptz,
          scheduled_ends_at = ${r.toISOString()}::timestamptz,
          updated_at = now()
      from updated_booking
      where job.booking_id = updated_booking.id
        and job.workspace_id = ${c.workspaceId}::uuid
        and job.status not in ('completed', 'cancelled')
      returning job.id, job.workspace_id
    ),
    job_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        summary,
        metadata
      )
      select
        workspace_id,
        id,
        'status_changed',
        'Service job schedule synchronized with its booking.',
        jsonb_build_object(
          'source', 'dashboard_booking_reschedule',
          'previous_starts_at', ${o.toISOString()},
          'previous_ends_at', ${p.toISOString()},
          'starts_at', ${m.toISOString()},
          'ends_at', ${r.toISOString()}
        )
      from updated_job
      returning id
    )
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
      workspace_id,
      customer_id,
      id,
      'booking',
      'Bokning ombokad',
      'Bokningens tid ändrades.',
      jsonb_build_object(
        'source', 'dashboard_manual',
        'event_subtype', 'booking_rescheduled',
        'previous_starts_at', ${o.toISOString()},
        'previous_ends_at', ${p.toISOString()},
        'starts_at', ${m.toISOString()},
        'ends_at', ${r.toISOString()}
      )
    from updated_booking
  `,{changed:!0,timeZone:i,notification:{customerName:String(n.customer_name??"Kund"),customerEmail:String(n.customer_email??""),customerPhone:String(n.customer_phone??""),service:String(n.service??"Bokning"),city:String(n.city??""),previousStartsAt:o.toISOString(),startsAt:m.toISOString(),endsAt:r.toISOString()}})}a.s(["BookingRescheduleValidationError",0,k,"rescheduleDashboardBooking",0,i]),c()}catch(a){c(a)}},!1),338147,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(600375),g=a.i(998332),h=a.i(87921),i=b([g,h]);[g,h]=i.then?(await i)():i;let l=(0,e.resolveDatabaseUrl)(),m=["requested","confirmed","completed","cancelled"];async function j(){let a=await (0,h.getUserWorkspaceAccess)();if(!a.ok||!(0,h.canManageWorkspaceSettings)(a))throw Error("An owner or admin workspace membership is required for booking updates");return a}async function k(a,b){let c=l?(0,d.neon)(l):null;if(!c)throw Error("Missing database connection for dashboard booking status update");let e=(await j()).workspaceId,h=await c`
    select time_zone
    from workspace_settings
    where workspace_id = ${e}
    limit 1
  `,i=(0,f.resolveBookingTimeZone)(h[0]?.time_zone),k=(await c`
    with existing_booking as (
      select
        b.id,
        b.workspace_id,
        b.customer_id,
        b.status as old_status,
        b.service,
        b.city,
        b.title,
        b.notes,
        b.starts_at,
        b.ends_at,
        b.staff_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${e}
        and b.id = ${a}
    ),
    updated_booking as (
      update bookings
      set
        status = ${b},
        updated_at = now()
      where workspace_id = ${e}
        and id = ${a}
        and status <> ${b}
      returning
        id,
        workspace_id,
        customer_id,
        status as new_status
    ),
    created_job as (
      insert into workspace_service_jobs (
        workspace_id,
        source_type,
        booking_id,
        customer_id,
        assigned_staff_id,
        status,
        title,
        description,
        service_name,
        city,
        scheduled_starts_at,
        scheduled_ends_at
      )
      select
        ${e}::uuid,
        'booking',
        updated_booking.id,
        updated_booking.customer_id,
        existing_booking.staff_id,
        case when existing_booking.staff_id is null then 'new' else 'assigned' end,
        existing_booking.title,
        coalesce(existing_booking.notes, ''),
        existing_booking.service,
        existing_booking.city,
        existing_booking.starts_at,
        existing_booking.ends_at
      from updated_booking
      join existing_booking on existing_booking.id = updated_booking.id
      where updated_booking.new_status = 'confirmed'
      on conflict (booking_id) where booking_id is not null do nothing
      returning id, workspace_id, booking_id, status
    ),
    created_job_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, to_status, summary, metadata
      )
      select
        workspace_id,
        id,
        'created',
        status,
        'Service job created from confirmed booking.',
        jsonb_build_object('source', 'confirmed_booking', 'booking_id', booking_id)
      from created_job
      returning id
    ),
    source_job_candidate as (
      select
        job.id,
        job.workspace_id,
        job.status as old_status,
        updated_booking.new_status as booking_status
      from workspace_service_jobs job
      join updated_booking on job.booking_id = updated_booking.id
      where job.workspace_id = ${e}::uuid
        and updated_booking.new_status in ('completed', 'cancelled')
        and job.status not in ('completed', 'cancelled')
    ),
    source_job_sync as (
      update workspace_service_jobs job
      set
        status = case when source_job_candidate.booking_status = 'completed' then 'completed' else 'cancelled' end,
        completion_summary = case when source_job_candidate.booking_status = 'completed' then 'Booking source marked completed.' else job.completion_summary end,
        completed_at = case when source_job_candidate.booking_status = 'completed' then now() else job.completed_at end,
        cancelled_at = case when source_job_candidate.booking_status = 'cancelled' then now() else job.cancelled_at end,
        updated_at = now()
      from source_job_candidate
      where job.id = source_job_candidate.id
        and job.workspace_id = source_job_candidate.workspace_id
      returning job.id, job.workspace_id, source_job_candidate.old_status, job.status as new_status, source_job_candidate.booking_status
    ),
    source_job_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata
      )
      select
        workspace_id,
        id,
        'status_changed',
        old_status,
        new_status,
        'Service job synchronized with its booking source.',
        jsonb_build_object('source', 'booking_status_change', 'booking_status', booking_status)
      from source_job_sync
      returning id
    ),
    source_completion_evidence as (
      insert into workspace_service_job_completion_evidence (
        workspace_id, service_job_id, evidence_type, description
      )
      select
        workspace_id,
        id,
        'note',
        'Booking source marked completed.'
      from source_job_sync
      where booking_status = 'completed'
      returning id, workspace_id, service_job_id
    ),
    source_evidence_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata
      )
      select
        workspace_id,
        service_job_id,
        'completion_evidence_added',
        'Completion evidence recorded from booking source.',
        jsonb_build_object('source', 'booking_status_change')
      from source_completion_evidence
      returning id
    ),
    inserted_event as (
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
        updated_booking.workspace_id,
        updated_booking.customer_id,
        updated_booking.id,
        'status_change',
        'Booking status updated',
        'Status changed from ' || existing_booking.old_status || ' to ' || updated_booking.new_status || '.',
        jsonb_build_object(
          'source', 'dashboard_manual',
          'old_status', existing_booking.old_status,
          'new_status', updated_booking.new_status,
          'service_job_id', (select id from created_job limit 1)
        )
      from updated_booking
      join existing_booking on existing_booking.id = updated_booking.id
      returning id
    )
    select
      (select id from existing_booking limit 1) as booking_id,
      (select count(*)::int from updated_booking) as updated_count,
      (select count(*)::int from inserted_event) as event_count,
      (select customer_name from existing_booking limit 1) as customer_name,
      (select customer_email from existing_booking limit 1) as customer_email,
      (select customer_phone from existing_booking limit 1) as customer_phone,
      (select service from existing_booking limit 1) as service,
      (select city from existing_booking limit 1) as city,
      (select starts_at from existing_booking limit 1) as starts_at,
      (select ends_at from existing_booking limit 1) as ends_at
  `)[0];if(!k?.booking_id)throw Error("Booking status update did not match a booking");let m=Number(k.updated_count??0)>0,n=m?{customerName:String(k.customer_name??"Kund"),customerEmail:String(k.customer_email??""),customerPhone:String(k.customer_phone??""),service:String(k.service??"Bokning"),city:String(k.city??""),startsAt:new Date(String(k.starts_at)).toISOString(),endsAt:new Date(String(k.ends_at)).toISOString()}:null,o=null;if(m&&"completed"===b&&(o=n?.customerEmail?"failed":"skipped",n?.customerEmail))try{let b=await (0,g.deliverVerifiedReviewInvitation)(a);o=b.ok?"sent":"email"===b.code||"missing_email"===b.code?"failed":"skipped"}catch(a){console.error("Failed to deliver verified review invitation",a),o="failed"}return{changed:m,timeZone:i,notification:n,reviewInvitationDelivery:o}}a.s(["isDashboardBookingStatus",0,function(a){return m.includes(a)},"updateDashboardBookingStatus",0,k]),c()}catch(a){c(a)}},!1),781461,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(137936),f=a.i(503236),g=a.i(395936);a.i(570396);var h=a.i(673727),i=a.i(679767),j=a.i(784930),k=a.i(661607),l=a.i(714518),m=a.i(589272),n=a.i(880147),o=a.i(383178),p=a.i(56465),q=a.i(918635),r=a.i(238444),s=a.i(589717),t=a.i(856778),u=a.i(4132),v=a.i(634384),w=a.i(827744),x=a.i(338147),y=a.i(87921),z=a.i(906077),A=b([v,w,x,y,z]);[v,w,x,y,z]=A.then?(await A)():A;let G=["requested","confirmed","completed","cancelled"],H={sv:{draft:"Utkast",requested:"Förfrågad",confirmed:"Bekräftad",completed:"Klar",cancelled:"Avbokad",no_show:"Uteblev"},en:{draft:"Draft",requested:"Requested",confirmed:"Confirmed",completed:"Completed",cancelled:"Cancelled",no_show:"No-show"}},I={sv:{prospect:"Prospekt",active:"Aktiv",paused:"Pausad",lost:"Förlorad"},en:{prospect:"Prospect",active:"Active",paused:"Paused",lost:"Lost"}},J={sv:{note:"Notering",call:"Samtal",email:"E-post",booking:"Bokning",booking_rescheduled:"Ombokning",status_change:"Statusändring",ai_conversation:"AI-dialog"},en:{note:"Note",call:"Call",email:"Email",booking:"Booking",booking_rescheduled:"Rescheduled",status_change:"Status change",ai_conversation:"AI conversation"}},K={sv:{access:"Du saknar behörighet att ändra bokningen.",status:"Vald status är ogiltig.",save:"Ändringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.",reschedule_time:"Välj ett giltigt datum och klockslag.",reschedule_past:"Den nya tiden måste ligga i framtiden.",reschedule_conflict:"Den nya tiden krockar med en annan aktiv bokning.",reschedule_status:"En avbokad eller utebliven bokning kan inte flyttas."},en:{access:"You do not have permission to change this booking.",status:"The selected status is invalid.",save:"The change could not be saved. Try again or check the configuration.",reschedule_time:"Select a valid date and time.",reschedule_past:"The new time must be in the future.",reschedule_conflict:"The new time conflicts with another active booking.",reschedule_status:"A cancelled or no-show booking cannot be rescheduled."}},L=new Set(["address","postcode","property type","floors","cleaning","frames & sills","standard windows","large windows","very large / bay windows","hard-access windows","frequency","access","condition","property size","heavy blockage","conservatory size","solar panels","area","heavy dirt / moss","oil / stain treatment","weed treatment","re-sanding","sealing requested","first clean","rear garden access","number of floors","working height","parking","window access","pets at property"]);function B(a,b){return String(a.get(b)??"").trim()}function C(a,b){return"en"===b?`${a}${a.includes("?")?"&":"?"}lang=en`:a}function D(a,b,c){(0,h.redirect)(C(`/dashboard/bokningar/${a}?error=${b}`,c))}async function E(a,b){let c=await (0,y.getUserWorkspaceAccess)();return c.ok&&(0,y.canManageWorkspaceSettings)(c)&&await (0,z.hasDashboardModuleAccess)("online_booking")||D(a,"access",b),c}let M=async function(a,b){let c="en"===B(b,"lang")?"en":"sv",d=await E(a,c),e=B(b,"status");(0,x.isDashboardBookingStatus)(e)||D(a,"status",c);try{let b=await (0,x.updateDashboardBookingStatus)(a,e);if(b.changed&&b.notification&&("confirmed"===e||"cancelled"===e)){let a=b.notification;await Promise.allSettled([a.customerEmail?(0,t.sendBookingStatusEmail)({customerName:a.customerName,customerEmail:a.customerEmail,companyName:d.workspaceName,status:e,service:a.service,startsAt:a.startsAt,endsAt:a.endsAt,city:a.city,timeZone:b.timeZone}):Promise.resolve(null),a.customerPhone?(0,u.sendBookingCustomerSms)({customerPhone:a.customerPhone,companyName:d.workspaceName,status:e,service:a.service,startsAt:a.startsAt,timeZone:b.timeZone}):Promise.resolve(null)])}}catch(b){console.error("Failed to update dashboard booking status",b),D(a,"save",c)}(0,h.redirect)(C(`/dashboard/bokningar/${a}?updated=1`,c))};(0,e.registerServerReference)(M,"60a198232ef4f6771c260fa49a471a036fe23a0882",null);let N=async function(a,b){let c="en"===B(b,"lang")?"en":"sv",d=await E(a,c),e=B(b,"startsAt");try{let b=await (0,w.rescheduleDashboardBooking)(a,e);if(b.changed&&b.notification){let a=b.notification;await Promise.allSettled([a.customerEmail?(0,s.sendBookingRescheduleEmail)({customerName:a.customerName,customerEmail:a.customerEmail,companyName:d.workspaceName,service:a.service,previousStartsAt:a.previousStartsAt,startsAt:a.startsAt,endsAt:a.endsAt,city:a.city,timeZone:b.timeZone}):Promise.resolve(null),a.customerPhone?(0,u.sendBookingCustomerSms)({customerPhone:a.customerPhone,companyName:d.workspaceName,status:"rescheduled",service:a.service,previousStartsAt:a.previousStartsAt,startsAt:a.startsAt,timeZone:b.timeZone}):Promise.resolve(null)])}}catch(b){b instanceof w.BookingRescheduleValidationError&&D(a,`reschedule_${b.code}`,c),console.error("Failed to reschedule dashboard booking",b),D(a,"save",c)}(0,h.redirect)(C(`/dashboard/bokningar/${a}?rescheduled=1`,c))};async function F({params:a,searchParams:b}){let[{id:c},e]=await Promise.all([a,b??Promise.resolve(void 0)]),s=await (0,v.getDashboardBookingDetailInStockholm)(c);s||(0,h.notFound)();let{booking:t,customer:u,events:w}=s,x=a=>{let b=e?.[a];return Array.isArray(b)?b[0]:b},y="en"===x("lang")?"en":"sv",z="en"===y,A=x("error"),B=A?K[y][A]:void 0,D=M.bind(null,t.id),E=N.bind(null,t.id),O=H[y],P=I[y],Q=J[y],R=function(a){let b={estimatedPrice:"",minimumCharge:"",priceLines:[],priceNotice:"",propertyRows:[],customerNote:"",photoPaths:[],rawNote:""},c=a.split(/\r?\n/).map(a=>a.trim()).filter(Boolean),d=new Set,e=!1;for(let a of c){let c=a.indexOf(":");if(c<1)continue;let f=a.slice(0,c).trim(),g=a.slice(c+1).trim(),h=f.toLowerCase();if("pricing"===h){if(e=!0,/^manual quote required:/i.test(g)){b.estimatedPrice="Manual quote",b.priceNotice=g.replace(/^manual quote required:\s*/i,"");continue}for(let a of g.split("|").map(a=>a.trim()).filter(Boolean)){let c=a.match(/^Calculated estimate:\s*(£[\d,.]+)/i);if(c){b.estimatedPrice=c[1];continue}let d=a.match(/^Minimum charge:\s*(£[\d,.]+)/i);if(d){b.minimumCharge=d[1];continue}if(/^(Estimated price|Calculated from)/i.test(a)){b.priceNotice=a;continue}b.priceLines.push(a)}continue}if("additional details"===h||"arrival notes"===h){e=!0,b.customerNote=g;continue}if("photo"===h){e=!0,g.startsWith("primeview-booking/")&&!g.includes("..")&&g.length<=800&&b.photoPaths.length<5&&b.photoPaths.push(g);continue}L.has(h)&&(e=!0,d.has(h)||(d.add(h),b.propertyRows.push({label:f,value:g})))}return e||(b.rawNote=a),b}(t.notes),S=w.some(a=>"booking"===a.type&&/created|skapad|request/i.test(`${a.title} ${a.description}`))?w:[...w,{id:`created-${t.id}`,type:"booking",title:z?"Booking created":"Bokning skapad",description:z?"The booking request was created and connected to this customer.":"Bokningsförfrågan skapades och kopplades till kunden.",createdAt:t.createdAt}],T=z?[{label:"Status",value:O[t.status]??t.status,helper:"Current booking status",icon:k.CalendarClock,tone:"bg-[#e9f2ec] text-[#17452f]"},{label:"Customer",value:t.customer,helper:"Connected customer profile",icon:n.CircleUserRound,tone:"bg-[#edf0f8] text-[#405582]"},{label:"Events",value:String(S.length),helper:"Recorded activities",icon:i.Activity,tone:"bg-[#f8f0df] text-[#8a6722]"},{label:"Action",value:"Available",helper:"Status and time can be updated",icon:p.RefreshCw,tone:"bg-[#f0ece8] text-[#6d5948]"}]:[{label:"Status",value:O[t.status]??t.status,helper:"Aktuell bokningsstatus",icon:k.CalendarClock,tone:"bg-[#e9f2ec] text-[#17452f]"},{label:"Kund",value:t.customer,helper:"Kopplad kundprofil",icon:n.CircleUserRound,tone:"bg-[#edf0f8] text-[#405582]"},{label:"Händelser",value:String(S.length),helper:"Registrerade aktiviteter",icon:i.Activity,tone:"bg-[#f8f0df] text-[#8a6722]"},{label:"Åtgärd",value:"Tillgänglig",helper:"Status och tid kan uppdateras",icon:p.RefreshCw,tone:"bg-[#f0ece8] text-[#6d5948]"}],U="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";return(0,d.jsxs)("div",{className:"grid gap-6",children:[(0,d.jsx)(r.DashboardPageHeader,{eyebrow:z?"Booking profile":"Bokningsprofil",title:t.title,description:z?"View the booking details, connected customer and history. Change the status or reschedule the time securely.":"Se bokningens viktigaste uppgifter, kopplad kund och historik. Ändra status eller flytta tiden kontrollerat.",icon:k.CalendarClock,actions:(0,d.jsxs)(g.default,{href:C("/dashboard/bokningar",y),className:"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]",children:[(0,d.jsx)(j.ArrowLeft,{className:"h-4 w-4"}),z?"Back to bookings":"Tillbaka till bokningar"]})}),B?(0,d.jsx)("section",{className:"rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]",children:B}):null,"1"===x("created")?(0,d.jsx)("section",{className:"rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]",children:z?"The booking was created successfully.":"Bokningen skapades."}):null,"1"===x("updated")?(0,d.jsx)("section",{className:"rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]",children:z?"The status was updated and saved in the history.":"Status uppdaterades och ändringen sparades i historiken."}):null,"1"===x("rescheduled")?(0,d.jsx)("section",{className:"rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]",children:z?"The booking was rescheduled. The previous and new times were saved, and the customer was notified when contact details were available.":"Bokningen flyttades. Den tidigare och nya tiden sparades i historiken och kunden notifierades när kontaktuppgifter fanns."}):null,(0,d.jsx)(r.DashboardMetricGrid,{items:T}),(0,d.jsxs)("section",{className:"grid gap-6 lg:grid-cols-[1fr_360px]",children:[(0,d.jsxs)("div",{className:"grid gap-6",children:[(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Booking":"Bokning"}),(0,d.jsxs)("div",{className:"mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2",children:[(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:"Start:"})," ",t.time]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"End:":"Slut:"})," ",t.endsAt]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"Location:":"Ort:"})," ",t.city]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"Service:":"Tjänst:"})," ",t.service]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"Created:":"Skapad:"})," ",t.createdAt]})]})]}),R.estimatedPrice?(0,d.jsxs)("article",{className:"overflow-hidden rounded-[24px] border border-[#d5e4f5] bg-white shadow-sm",children:[(0,d.jsxs)("div",{className:"flex flex-col gap-4 bg-[#071b42] p-6 text-white sm:flex-row sm:items-end sm:justify-between",children:[(0,d.jsxs)("div",{children:[(0,d.jsxs)("p",{className:"flex items-center gap-2 text-sm font-bold text-[#bcd5ff]",children:[(0,d.jsx)(m.CirclePoundSterling,{className:"h-5 w-5"}),z?"Customer price estimate":"Kundens prisindikation"]}),(0,d.jsx)("p",{className:"mt-2 text-4xl font-black tracking-tight",children:R.estimatedPrice})]}),R.minimumCharge?(0,d.jsxs)("div",{className:"rounded-xl bg-white/10 px-4 py-3 text-sm",children:[(0,d.jsx)("span",{className:"text-white/70",children:z?"Minimum charge":"Minimipris"}),(0,d.jsx)("strong",{className:"ml-2",children:R.minimumCharge})]}):null]}),(0,d.jsxs)("div",{className:"p-6",children:[R.priceLines.length?(0,d.jsx)("div",{className:"grid gap-2",children:R.priceLines.map(a=>(0,d.jsxs)("div",{className:"flex items-start gap-3 rounded-xl border border-[#e3eaf3] bg-[#f8fbff] px-4 py-3 text-sm text-[#34485f]",children:[(0,d.jsx)(o.ListChecks,{className:"mt-0.5 h-4 w-4 shrink-0 text-[#2769b5]"}),(0,d.jsx)("span",{children:a})]},a))}):null,R.priceNotice?(0,d.jsx)("p",{className:"mt-4 rounded-xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#73551b]",children:R.priceNotice}):null]})]}):null,R.propertyRows.length?(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center gap-3",children:[(0,d.jsx)(o.ListChecks,{className:"h-5 w-5 text-[#17452f]"}),(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Property & job details":"Fastighet & jobbdetaljer"})]}),(0,d.jsx)("div",{className:"mt-5 grid gap-3 sm:grid-cols-2",children:R.propertyRows.map(a=>(0,d.jsxs)("div",{className:"rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4",children:[(0,d.jsx)("p",{className:"text-xs font-bold uppercase tracking-wide text-[#718077]",children:a.label}),(0,d.jsx)("p",{className:"mt-1 font-semibold text-[#26362d]",children:a.value})]},a.label.toLowerCase()))})]}):null,R.photoPaths.length?(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center gap-3",children:[(0,d.jsx)(l.Camera,{className:"h-5 w-5 text-[#17452f]"}),(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Property photos":"Fastighetsbilder"})]}),(0,d.jsx)("p",{className:"mt-2 text-sm text-[#5b665f]",children:z?"Photos supplied by the customer for access and price review.":"Bilder som kunden skickade för åtkomst- och prisbedömning."}),(0,d.jsx)("div",{className:"mt-5 grid gap-3 sm:grid-cols-2",children:R.photoPaths.map((a,b)=>{let c=`/api/primeview/booking-photo?bookingId=${encodeURIComponent(t.id)}&pathname=${encodeURIComponent(a)}`;return(0,d.jsx)("a",{href:c,target:"_blank",rel:"noreferrer",className:"overflow-hidden rounded-xl border border-[#e4e9e2] bg-[#f7f9f6]",children:(0,d.jsx)(f.default,{src:c,alt:`Property photo ${b+1}`,width:720,height:480,unoptimized:!0,className:"aspect-[3/2] w-full object-cover"})},a)})})]}):null,R.customerNote||R.rawNote?(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center gap-3",children:[(0,d.jsx)(q.StickyNote,{className:"h-5 w-5 text-[#17452f]"}),(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Customer notes":"Kundnotering"})]}),(0,d.jsx)("p",{className:"mt-4 whitespace-pre-wrap rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]",children:R.customerNote||R.rawNote})]}):null,(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Change time":"Ändra tid"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#5b665f]",children:z?"Select a new start time. The current duration is preserved, conflicts are blocked, and the customer receives SMS and email when contact details are available.":"Välj en ny starttid. Bokningens nuvarande längd behålls, krockar blockeras och kunden får SMS och e-post när kontaktuppgifter finns."}),(0,d.jsxs)("form",{action:E,className:"mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4",children:[(0,d.jsx)("input",{type:"hidden",name:"lang",value:y}),(0,d.jsxs)("label",{className:"grid gap-2 text-sm font-semibold text-[#17201a]",children:[z?"New start time":"Ny starttid",(0,d.jsx)("input",{name:"startsAt",type:"datetime-local",required:!0,className:U})]}),(0,d.jsx)("button",{type:"submit",className:"inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]",children:z?"Reschedule booking":"Flytta bokning"})]})]}),(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Change status":"Ändra status"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#5b665f]",children:z?"Confirmation or cancellation sends email and SMS when the customer has provided contact details.":"Vid bekräftelse eller avbokning skickas e-post och SMS när kunden har lämnat kontaktuppgifter."}),(0,d.jsxs)("form",{action:D,className:"mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4",children:[(0,d.jsx)("input",{type:"hidden",name:"lang",value:y}),(0,d.jsxs)("label",{className:"grid gap-2 text-sm font-semibold text-[#17201a]",children:[z?"New status":"Ny status",(0,d.jsx)("select",{name:"status",defaultValue:G.includes(t.status)?t.status:"requested",className:U,children:G.map(a=>(0,d.jsx)("option",{value:a,children:O[a]},a))})]}),(0,d.jsx)("button",{type:"submit",className:"inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]",children:z?"Update status":"Uppdatera status"})]})]}),(0,d.jsxs)("article",{className:"rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-[#dfe5dd] pb-4",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("h3",{className:"text-xl font-bold text-[#17201a]",children:z?"Connected customer":"Kopplad kund"}),(0,d.jsx)("p",{className:"text-sm text-[#5b665f]",children:z?"Customer details connected to the booking.":"Kunduppgifter kopplade till bokningen."})]}),(0,d.jsx)("span",{className:"rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]",children:z?"Customer data":"Kunddata"})]}),u?(0,d.jsx)("div",{className:"mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139]",children:(0,d.jsxs)("div",{className:"flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("p",{className:"text-lg font-bold text-[#17201a]",children:u.name}),(0,d.jsxs)("p",{className:"mt-1 text-[#5b665f]",children:[u.type," · ",u.city]}),(0,d.jsxs)("p",{className:"mt-3",children:[(0,d.jsx)("strong",{children:"Status:"})," ",P[u.status]??u.status]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"Email:":"E-post:"})," ",u.email]}),(0,d.jsxs)("p",{children:[(0,d.jsx)("strong",{children:z?"Phone:":"Telefon:"})," ",u.phone]})]}),(0,d.jsx)(g.default,{href:C(`/dashboard/kunder/${u.id}`,y),className:"inline-flex min-h-10 items-center justify-center rounded-full bg-[#0f3322] px-4 py-2 text-sm font-bold !text-white shadow-sm",children:z?"View customer profile":"Visa kundprofil"})]})}):(0,d.jsx)("p",{className:"mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]",children:z?"No customer is connected to this booking.":"Ingen kund är kopplad till den här bokningen."})]})]}),(0,d.jsxs)("aside",{className:"rounded-3xl bg-[#17452f] p-6 text-white",children:[(0,d.jsx)("h3",{className:"text-xl font-bold",children:z?"Booking history":"Bokningshistorik"}),(0,d.jsx)("p",{className:"mt-3 text-sm leading-7 text-white/80",children:z?"Status changes, rescheduling and important booking events are collected here.":"Här samlas statusändringar, ombokningar och viktiga händelser kopplade till bokningen."}),(0,d.jsx)("div",{className:"mt-5 space-y-3",children:S.map(a=>(0,d.jsxs)("div",{className:"rounded-2xl bg-white/10 p-4",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between gap-3",children:[(0,d.jsx)("span",{className:"rounded-full bg-white/15 px-3 py-1 text-xs font-semibold",children:Q[a.type]??a.type}),(0,d.jsx)("span",{className:"text-xs text-white/70",children:a.createdAt})]}),(0,d.jsx)("p",{className:"mt-3 font-semibold",children:a.title}),(0,d.jsx)("p",{className:"mt-2 text-sm leading-6 text-white/80",children:a.description})]},a.id))})]})]})]})}(0,e.registerServerReference)(N,"605373ee76df5a9aef8573a60e571f1189191e7b8a",null),a.s(["$$RSC_SERVER_ACTION_0",0,M,"$$RSC_SERVER_ACTION_1",0,N,"default",0,F,"dynamic",0,"force-dynamic"]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_02~~hnu._.js.map