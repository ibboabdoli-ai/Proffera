module.exports=[375918,a=>{"use strict";a.s(["RescheduleSlotPicker",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call RescheduleSlotPicker() from the server but RescheduleSlotPicker is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/app/mina-bokningar/[token]/[bookingId]/boka-om/reschedule-slot-picker.tsx <module evaluation>","RescheduleSlotPicker")},587928,a=>{"use strict";a.s(["RescheduleSlotPicker",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call RescheduleSlotPicker() from the server but RescheduleSlotPicker is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/app/mina-bokningar/[token]/[bookingId]/boka-om/reschedule-slot-picker.tsx","RescheduleSlotPicker")},517824,a=>{"use strict";a.i(375918);var b=a.i(587928);a.n(b)},236023,a=>{"use strict";var b=a.i(907997),c=a.i(137936),d=a.i(544721),e=a.i(395936);a.i(570396);var f=a.i(673727),g=a.i(661607),h=a.i(405667),i=a.i(95679),j=a.i(546767),k=a.i(112512),l=a.i(732056),m=a.i(612147),n=a.i(600375);let o=(0,m.resolveDatabaseUrl)();async function p(a,b){let c=(0,l.verifyCustomerCalendarToken)(a);if(!c||!o||!/^[0-9a-f-]{36}$/i.test(b))return null;let d=(0,j.neon)(o),e=(await d`
    select
      b.id,
      b.service,
      b.status,
      b.starts_at,
      b.ends_at,
      b.staff_id,
      s.name as staff_name,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from bookings b
    left join workspace_staff s on s.id = b.staff_id and s.workspace_id = b.workspace_id
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    left join workspace_booking_reminder_settings ps on ps.workspace_id = b.workspace_id
    where b.id = ${b}
      and b.customer_id = ${c.customerId}
      and b.workspace_id = ${c.workspaceId}
      and coalesce(ps.customer_reschedule_enabled, true) = true
      and b.status in ('requested', 'confirmed')
      and b.starts_at > now()
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `)[0];return e?{id:String(e.id),service:String(e.service??"Bokning"),status:String(e.status),startsAt:new Date(String(e.starts_at)).toISOString(),endsAt:new Date(String(e.ends_at)).toISOString(),staffId:e.staff_id?String(e.staff_id):null,staffName:e.staff_name?String(e.staff_name):null,timeZone:String(e.time_zone)}:null}async function q(a,b,c){let d,e=(0,l.verifyCustomerCalendarToken)(a);if(!e||!o||!/^[0-9a-f-]{36}$/i.test(b))return{ok:!1,error:"invalid"};let f=(0,n.parseLocalDateTime)(c);if(!f)return{ok:!1,error:"time"};let g=(0,j.neon)(o),h=(await g`
    select
      b.id,
      b.service,
      b.city,
      b.staff_id,
      b.status as old_status,
      b.starts_at as old_starts_at,
      b.ends_at as old_ends_at,
      c.name as customer_name,
      c.email as customer_email,
      coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      nullif(ws.contact_email, '') as owner_email,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone,
      sv.duration_minutes,
      sv.buffer_before_minutes,
      sv.buffer_after_minutes,
      sv.minimum_notice_minutes,
      sv.maximum_advance_days,
      coalesce(ps.company_confirmation_required, true) as company_confirmation_required
    from bookings b
    join customers c on c.id = b.customer_id and c.workspace_id = b.workspace_id
    join workspaces w on w.id::text = b.workspace_id
    join workspace_services sv on sv.workspace_id = b.workspace_id and sv.name = b.service and sv.is_active = true
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    left join workspace_booking_reminder_settings ps on ps.workspace_id = b.workspace_id
    where b.id = ${b}
      and b.customer_id = ${e.customerId}
      and b.workspace_id = ${e.workspaceId}
      and coalesce(ps.customer_reschedule_enabled, true) = true
      and b.status in ('requested', 'confirmed')
      and b.starts_at > now()
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `)[0];if(!h)return{ok:!1,error:"not_allowed"};let i=new Date(Date.UTC(f.year,f.month-1,f.day)).getUTCDay();d=h.staff_id?(await g`
      select start_time::text as opens_at, end_time::text as closes_at, false as is_closed
      from workspace_staff_schedules
      where workspace_id = ${e.workspaceId}
        and staff_id = ${String(h.staff_id)}::uuid
        and weekday = ${i}
        and is_active = true
      limit 1
    `)[0]:(await g`
      select opens_at::text as opens_at, closes_at::text as closes_at, is_closed
      from workspace_booking_hours
      where workspace_id = ${e.workspaceId}
        and weekday = ${i}
      limit 1
    `)[0];let m=(0,n.resolveBookingTimeZone)(h.time_zone),p=(0,n.validatePublicBookingPolicy)({startsAt:c,now:new Date,service:{durationMinutes:Math.max(1,Number(h.duration_minutes)||60),bufferBeforeMinutes:Math.max(0,Number(h.buffer_before_minutes)||0),bufferAfterMinutes:Math.max(0,Number(h.buffer_after_minutes)||0),minimumNoticeMinutes:Math.max(0,Number(h.minimum_notice_minutes)||0),maximumAdvanceDays:Math.max(1,Number(h.maximum_advance_days)||365)},bookingHour:d?{opensAt:String(d.opens_at).slice(0,5),closesAt:String(d.closes_at).slice(0,5),isClosed:!!d.is_closed}:null,timeZone:m});if(p.error)return{ok:!1,error:p.error};let{start:q,end:r}=p;if(h.staff_id&&(await g`
      select id
      from workspace_staff_time_off
      where workspace_id = ${e.workspaceId}
        and staff_id = ${String(h.staff_id)}::uuid
        and starts_at < ${r.toISOString()}::timestamptz
        and ends_at > ${q.toISOString()}::timestamptz
      limit 1
    `)[0])return{ok:!1,error:"time_off"};let s=h.staff_id?String(h.staff_id):null;if((await g`
    select id
    from bookings
    where workspace_id = ${e.workspaceId}
      and id <> ${b}
      and status not in ('cancelled', 'no_show')
      and (${s}::uuid is null or staff_id = ${s}::uuid or staff_id is null)
      and starts_at < ${r.toISOString()}::timestamptz
      and ends_at > ${q.toISOString()}::timestamptz
    union all
    select id
    from public_booking_verifications
    where workspace_id = ${e.workspaceId}::uuid
      and consumed_at is null
      and expires_at > now()
      and (${s}::uuid is null or staff_id = ${s}::uuid or staff_id is null)
      and starts_at < ${r.toISOString()}::timestamptz
      and ends_at > ${q.toISOString()}::timestamptz
    limit 1
  `)[0])return{ok:!1,error:"conflict"};let t=h.company_confirmation_required?"requested":"confirmed",u=new Date(String(h.old_starts_at)).toISOString(),v=new Date(String(h.old_ends_at)).toISOString();if(!(await g`
    with updated_booking as (
      update bookings
      set starts_at = ${q.toISOString()}::timestamptz,
          ends_at = ${r.toISOString()}::timestamptz,
          status = ${t},
          updated_at = now()
      where id = ${b}
        and customer_id = ${e.customerId}
        and workspace_id = ${e.workspaceId}
        and status in ('requested', 'confirmed')
        and starts_at > now()
      returning id, workspace_id, customer_id, status
    ),
    updated_job as (
      update workspace_service_jobs job
      set scheduled_starts_at = ${q.toISOString()}::timestamptz,
          scheduled_ends_at = ${r.toISOString()}::timestamptz,
          updated_at = now()
      from updated_booking
      where job.booking_id = updated_booking.id
        and job.workspace_id = ${e.workspaceId}::uuid
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
        'Service job schedule synchronized with a customer reschedule.',
        jsonb_build_object(
          'source', 'customer_portal_reschedule',
          'booking_id', ${b},
          'previous_starts_at', ${u},
          'previous_ends_at', ${v},
          'starts_at', ${q.toISOString()},
          'ends_at', ${r.toISOString()},
          'booking_status', ${t}
        )
      from updated_job
      returning id
    ),
    customer_event as (
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
        'Bokning ombokad av kund',
        'Kunden ändrade bokningstiden via Mina bokningar.',
        jsonb_build_object(
          'source', 'customer_portal',
          'event_subtype', 'booking_rescheduled',
          'previous_starts_at', ${u},
          'previous_ends_at', ${v},
          'starts_at', ${q.toISOString()},
          'ends_at', ${r.toISOString()},
          'old_status', ${String(h.old_status)},
          'new_status', ${t}
        )
      from updated_booking
      returning id
    )
    select id from updated_booking
  `)[0])return{ok:!1,error:"not_allowed"};let w=(process.env.NEXT_PUBLIC_APP_URL??process.env.APP_URL??"https://www.proffera.se").replace(/\/$/,"");return await (0,k.sendBookingChangeEmails)({kind:"rescheduled",customerName:String(h.customer_name),customerEmail:String(h.customer_email),ownerEmail:h.owner_email?String(h.owner_email):void 0,companyName:String(h.company_name),service:String(h.service??"Bokning"),city:String(h.city??""),oldStartsAt:u,oldEndsAt:v,newStartsAt:q.toISOString(),newEndsAt:r.toISOString(),portalUrl:`${w}/mina-bokningar/${encodeURIComponent(a)}`,timeZone:m}),{ok:!0}}let r=(0,m.resolveDatabaseUrl)();async function s(a,b,c){let d=(0,l.verifyCustomerCalendarToken)(a);if(!d||!r||!/^[0-9a-f-]{36}$/i.test(b)||!/^\d{4}-\d{2}-\d{2}$/.test(c))return[];let e=(0,j.neon)(r),f=(await e`
    select b.id, b.service, b.staff_id,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone,
      sv.duration_minutes, sv.buffer_before_minutes, sv.buffer_after_minutes,
      sv.minimum_notice_minutes, sv.maximum_advance_days
    from bookings b
    join workspace_services sv on sv.workspace_id = b.workspace_id and sv.name = b.service and sv.is_active = true
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    where b.id = ${b}
      and b.customer_id = ${d.customerId}
      and b.workspace_id = ${d.workspaceId}
      and b.status in ('requested', 'confirmed')
      and b.starts_at > now()
    limit 1
  `)[0];if(!f)return[];let g=(0,n.parseLocalDateTime)(`${c}T12:00`);if(!g)return[];let h=new Date(Date.UTC(g.year,g.month-1,g.day)).getUTCDay(),i=(f.staff_id?await e`select start_time::text as opens_at, end_time::text as closes_at, false as is_closed from workspace_staff_schedules where workspace_id = ${d.workspaceId} and staff_id = ${String(f.staff_id)}::uuid and weekday = ${h} and is_active = true limit 1`:await e`select opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${d.workspaceId} and weekday = ${h} limit 1`)[0];if(!i||i.is_closed)return[];let k=String(i.opens_at).slice(0,5),m=String(i.closes_at).slice(0,5),[o,p]=k.split(":").map(Number),[q,s]=m.split(":").map(Number);if(![o,p,q,s].every(Number.isFinite))return[];let t=(0,n.resolveBookingTimeZone)(f.time_zone),u={durationMinutes:Math.max(1,Number(f.duration_minutes)||60),bufferBeforeMinutes:Math.max(0,Number(f.buffer_before_minutes)||0),bufferAfterMinutes:Math.max(0,Number(f.buffer_after_minutes)||0),minimumNoticeMinutes:Math.max(0,Number(f.minimum_notice_minutes)||0),maximumAdvanceDays:Math.max(1,Number(f.maximum_advance_days)||365)},v=new Date(`${c}T00:00:00.000Z`),w=new Date(v.getTime()+1728e5),x=f.staff_id?String(f.staff_id):null,[y,z,A]=await Promise.all([e`select starts_at, ends_at from bookings where workspace_id = ${d.workspaceId} and id <> ${b} and status not in ('cancelled', 'no_show') and (${x}::uuid is null or staff_id = ${x}::uuid or staff_id is null) and starts_at < ${w.toISOString()}::timestamptz and ends_at > ${v.toISOString()}::timestamptz`,e`select starts_at, ends_at from public_booking_verifications where workspace_id = ${d.workspaceId}::uuid and consumed_at is null and expires_at > now() and (${x}::uuid is null or staff_id = ${x}::uuid or staff_id is null) and starts_at < ${w.toISOString()}::timestamptz and ends_at > ${v.toISOString()}::timestamptz`,x?e`select starts_at, ends_at from workspace_staff_time_off where workspace_id = ${d.workspaceId} and staff_id = ${x}::uuid and starts_at < ${w.toISOString()}::timestamptz and ends_at > ${v.toISOString()}::timestamptz`:Promise.resolve([])]),B=[...y,...z,...A].map(a=>({start:new Date(String(a.starts_at)).getTime(),end:new Date(String(a.ends_at)).getTime()})),C=60*o+p,D=60*q+s,E=[];for(let a=C;a<D;a+=15){let b=Math.floor(a/60),d=a%60,e=`${c}T${String(b).padStart(2,"0")}:${String(d).padStart(2,"0")}`,f=(0,n.validatePublicBookingPolicy)({startsAt:e,now:new Date,service:u,bookingHour:{opensAt:k,closesAt:m,isClosed:!1},timeZone:t});if(f.error)continue;let g=f.start.getTime(),h=f.end.getTime();B.some(a=>a.start<h&&a.end>g)||E.push({startsAtLocal:e,label:`${String(b).padStart(2,"0")}:${String(d).padStart(2,"0")}`})}return E}var t=a.i(517824);let u={time:"Välj en giltig ledig tid.",notice:"Tiden ligger för nära. Välj en senare tid.",advance:"Tiden ligger för långt fram.",hours:"Tiden ligger utanför bokningstiderna.",hours_missing:"Det finns inga publicerade arbetstider den dagen.",conflict:"Tiden hann bokas av någon annan. Välj en ny tid.",time_off:"Medarbetaren är inte tillgänglig den tiden.",not_allowed:"Bokningen kan inte längre ändras."},v=async function(a,b){var[c,e]=await (0,d.decryptActionBoundArgs)("60835968b2a51d09b1cdf68f48ad085671df8f42af",a);let g=String(b.get("startsAtLocal")??""),h=await q(c,e,g);if(!h.ok){let a=g.slice(0,10);(0,f.redirect)(`/mina-bokningar/${encodeURIComponent(c)}/${e}/boka-om?date=${encodeURIComponent(a)}&error=${h.error}`)}(0,f.redirect)(`/mina-bokningar/${encodeURIComponent(c)}?changed=1`)};async function w({params:a,searchParams:c}){let{token:j,bookingId:k}=await a,l=c?await c:void 0,m=await p(j,k);m||(0,f.notFound)();let n=function(a,b=7){var c;let d,e=(c=new Date,{year:Number((d=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(c).map(a=>[a.type,a.value]))).year),month:Number(d.month),day:Number(d.day)});return Array.from({length:b},(a,b)=>{let c,d={year:(c=new Date(Date.UTC(e.year,e.month-1,e.day+b))).getUTCFullYear(),month:c.getUTCMonth()+1,day:c.getUTCDate()},f=`${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`,g=new Date(Date.UTC(d.year,d.month-1,d.day,12));return{date:f,label:new Intl.DateTimeFormat("sv-SE",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long"}).format(g),shortLabel:new Intl.DateTimeFormat("sv-SE",{timeZone:"UTC",weekday:"short",day:"numeric",month:"short"}).format(g)}})}(m.timeZone,7),o=new Map(await Promise.all(n.map(async a=>[a.date,await s(j,k,a.date)]))),q=n.find(a=>(o.get(a.date)?.length??0)>0)?.date,r=l?.date&&(o.get(l.date)?.length??0)>0?l.date:q??n[0]?.date,x=r?o.get(r)??[]:[],y=n.find(a=>a.date===r);var z,A,B=v.bind(null,(0,d.encryptActionBoundArgs)("60835968b2a51d09b1cdf68f48ad085671df8f42af",j,k));return(0,b.jsx)("main",{className:"min-h-screen bg-[#f4f7f3] px-4 py-8 sm:px-6",children:(0,b.jsxs)("section",{className:"mx-auto max-w-2xl rounded-[28px] border border-[#dfe6df] bg-white p-6 shadow-sm sm:p-8",children:[(0,b.jsx)(e.default,{href:`/mina-bokningar/${encodeURIComponent(j)}`,className:"text-sm font-bold text-[#17452f]",children:"← Till mina bokningar"}),(0,b.jsxs)("div",{className:"mt-6 flex items-center gap-3",children:[(0,b.jsx)("span",{className:"grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ef] text-[#17452f]",children:(0,b.jsx)(g.CalendarClock,{className:"h-6 w-6"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-bold uppercase tracking-[0.16em] text-[#647269]",children:"Boka om"}),(0,b.jsx)("h1",{className:"text-2xl font-bold text-[#17201a]",children:m.service})]})]}),(0,b.jsxs)("div",{className:"mt-6 rounded-2xl bg-[#f4f7f3] p-4 text-sm text-[#344139]",children:[(0,b.jsxs)("p",{className:"flex items-center gap-2",children:[(0,b.jsx)(h.Clock3,{className:"h-4 w-4"}),"Nuvarande tid: ",(0,b.jsx)("strong",{children:(z=m.startsAt,A=m.timeZone,new Intl.DateTimeFormat("sv-SE",{timeZone:A,dateStyle:"full",timeStyle:"short"}).format(new Date(z)))})]}),m.staffName?(0,b.jsxs)("p",{className:"mt-2 flex items-center gap-2",children:[(0,b.jsx)(i.UserRound,{className:"h-4 w-4"}),"Medarbetare: ",(0,b.jsx)("strong",{children:m.staffName})]}):null]}),l?.error?(0,b.jsx)("p",{role:"alert",className:"mt-5 rounded-xl bg-[#fff4f2] p-4 text-sm font-bold text-[#a5362a]",children:u[l.error]??"Tiden kunde inte ändras."}):null,(0,b.jsxs)("div",{className:"mt-7",children:[(0,b.jsx)("h2",{className:"text-lg font-bold text-[#17201a]",children:"Välj dag"}),(0,b.jsx)("div",{className:"mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7",children:n.map(a=>{let c=a.date===r,d=o.get(a.date)?.length??0;return 0===d?(0,b.jsxs)("span",{"aria-disabled":"true",className:"cursor-not-allowed rounded-xl border border-[#e0e5e1] bg-[#f3f5f3] px-3 py-3 text-center text-sm font-bold text-[#a1aaa4]",children:[a.shortLabel,(0,b.jsx)("span",{className:"mt-1 block text-[10px] font-semibold uppercase tracking-wide",children:"Fullbokad"})]},a.date):(0,b.jsxs)(e.default,{href:`/mina-bokningar/${encodeURIComponent(j)}/${k}/boka-om?date=${encodeURIComponent(a.date)}`,className:`rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${c?"border-[#17452f] bg-[#17452f] text-white":"border-[#cfd9d0] bg-white text-[#344139] hover:border-[#17452f]"}`,children:[a.shortLabel,(0,b.jsxs)("span",{className:`mt-1 block text-[10px] font-semibold uppercase tracking-wide ${c?"text-white/75":"text-[#647269]"}`,children:[d," tider"]})]},a.date)})})]}),(0,b.jsxs)("div",{className:"mt-7",children:[(0,b.jsxs)("div",{className:"flex items-end justify-between gap-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h2",{className:"text-lg font-bold text-[#17201a]",children:"Lediga tider"}),y?(0,b.jsx)("p",{className:"mt-1 text-sm text-[#667168]",children:y.label}):null]}),(0,b.jsx)("span",{className:"text-xs font-bold uppercase tracking-[0.12em] text-[#647269]",children:"Endast bokningsbara tider"})]}),x.length>0?(0,b.jsx)(t.RescheduleSlotPicker,{action:B,slots:x,selectedDayLabel:y?.label}):(0,b.jsxs)("div",{className:"mt-4 rounded-2xl border border-dashed border-[#cfd9d0] bg-[#f8faf8] p-6 text-center",children:[(0,b.jsx)("p",{className:"font-bold text-[#344139]",children:"Inga lediga tider under de kommande sju dagarna."}),(0,b.jsx)("p",{className:"mt-1 text-sm text-[#667168]",children:"Kontakta företaget om du behöver hjälp med en ny tid."})]})]})]})})}(0,c.registerServerReference)(v,"60835968b2a51d09b1cdf68f48ad085671df8f42af",null),a.s(["$$RSC_SERVER_ACTION_0",0,v,"default",0,w,"dynamic",0,"force-dynamic"],236023)}];

//# sourceMappingURL=src_app_mina-bokningar_%5Btoken%5D_%5BbookingId%5D_boka-om_0drl1fd._.js.map