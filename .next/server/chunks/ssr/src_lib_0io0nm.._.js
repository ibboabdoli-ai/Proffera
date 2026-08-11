module.exports=[854723,a=>{"use strict";let b=["SEK","EUR","GBP"],c=["Europe/Amsterdam","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Copenhagen","Europe/Dublin","Europe/Helsinki","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Nicosia","Europe/Paris","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Vienna","Europe/Vilnius","Europe/Warsaw","Europe/Zagreb"],d=[{code:"SE",currency:"SEK",defaultTimeZone:"Europe/Stockholm",labelSv:"Sverige",labelEn:"Sweden"},{code:"AT",currency:"EUR",defaultTimeZone:"Europe/Vienna",labelSv:"Österrike",labelEn:"Austria"},{code:"BE",currency:"EUR",defaultTimeZone:"Europe/Brussels",labelSv:"Belgien",labelEn:"Belgium"},{code:"BG",currency:"EUR",defaultTimeZone:"Europe/Sofia",labelSv:"Bulgarien",labelEn:"Bulgaria"},{code:"HR",currency:"EUR",defaultTimeZone:"Europe/Zagreb",labelSv:"Kroatien",labelEn:"Croatia"},{code:"CY",currency:"EUR",defaultTimeZone:"Europe/Nicosia",labelSv:"Cypern",labelEn:"Cyprus"},{code:"CZ",currency:"EUR",defaultTimeZone:"Europe/Prague",labelSv:"Tjeckien",labelEn:"Czechia"},{code:"DK",currency:"EUR",defaultTimeZone:"Europe/Copenhagen",labelSv:"Danmark",labelEn:"Denmark"},{code:"EE",currency:"EUR",defaultTimeZone:"Europe/Tallinn",labelSv:"Estland",labelEn:"Estonia"},{code:"FI",currency:"EUR",defaultTimeZone:"Europe/Helsinki",labelSv:"Finland",labelEn:"Finland"},{code:"FR",currency:"EUR",defaultTimeZone:"Europe/Paris",labelSv:"Frankrike",labelEn:"France"},{code:"DE",currency:"EUR",defaultTimeZone:"Europe/Berlin",labelSv:"Tyskland",labelEn:"Germany"},{code:"GR",currency:"EUR",defaultTimeZone:"Europe/Athens",labelSv:"Grekland",labelEn:"Greece"},{code:"HU",currency:"EUR",defaultTimeZone:"Europe/Budapest",labelSv:"Ungern",labelEn:"Hungary"},{code:"IE",currency:"EUR",defaultTimeZone:"Europe/Dublin",labelSv:"Irland",labelEn:"Ireland"},{code:"IT",currency:"EUR",defaultTimeZone:"Europe/Rome",labelSv:"Italien",labelEn:"Italy"},{code:"LV",currency:"EUR",defaultTimeZone:"Europe/Riga",labelSv:"Lettland",labelEn:"Latvia"},{code:"LT",currency:"EUR",defaultTimeZone:"Europe/Vilnius",labelSv:"Litauen",labelEn:"Lithuania"},{code:"LU",currency:"EUR",defaultTimeZone:"Europe/Luxembourg",labelSv:"Luxemburg",labelEn:"Luxembourg"},{code:"MT",currency:"EUR",defaultTimeZone:"Europe/Malta",labelSv:"Malta",labelEn:"Malta"},{code:"NL",currency:"EUR",defaultTimeZone:"Europe/Amsterdam",labelSv:"Nederländerna",labelEn:"Netherlands"},{code:"PL",currency:"EUR",defaultTimeZone:"Europe/Warsaw",labelSv:"Polen",labelEn:"Poland"},{code:"PT",currency:"EUR",defaultTimeZone:"Europe/Lisbon",labelSv:"Portugal",labelEn:"Portugal"},{code:"RO",currency:"EUR",defaultTimeZone:"Europe/Bucharest",labelSv:"Rumänien",labelEn:"Romania"},{code:"SK",currency:"EUR",defaultTimeZone:"Europe/Bratislava",labelSv:"Slovakien",labelEn:"Slovakia"},{code:"SI",currency:"EUR",defaultTimeZone:"Europe/Ljubljana",labelSv:"Slovenien",labelEn:"Slovenia"},{code:"ES",currency:"EUR",defaultTimeZone:"Europe/Madrid",labelSv:"Spanien",labelEn:"Spain"},{code:"GB",currency:"GBP",defaultTimeZone:"Europe/London",labelSv:"Storbritannien",labelEn:"United Kingdom"}];function e(a){return d.find(b=>b.code===a)??null}function f(a){return"string"==typeof a&&c.includes(a)}function g(a){return"string"==typeof a&&b.includes(a)}a.s(["DEFAULT_WORKSPACE_MARKET",0,{countryCode:"SE",timeZone:"Europe/Stockholm",billingCurrency:"SEK"},"getWorkspaceMarketCountry",0,e,"getWorkspaceMarketLabel",0,function(a,b){let c=e(a);return c?"en"===b?c.labelEn:c.labelSv:a},"isWorkspaceBillingCurrency",0,g,"isWorkspaceTimeZone",0,f,"resolveWorkspaceMarket",0,function(a){let b=e(String(a.countryCode??""));return b&&f(a.timeZone)&&g(a.billingCurrency)&&b.currency===a.billingCurrency?{countryCode:b.code,timeZone:a.timeZone,billingCurrency:a.billingCurrency}:null}])},600375,a=>{"use strict";var b=a.i(854723);let c=new Map;function d(a){return(0,b.isWorkspaceTimeZone)(a)?a:b.DEFAULT_WORKSPACE_MARKET.timeZone}function e(a,d=b.DEFAULT_WORKSPACE_MARKET.timeZone){let f=Object.fromEntries((function(a){let b=c.get(a);if(b)return b;let d=new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});return c.set(a,d),d})(d).formatToParts(a).filter(a=>"literal"!==a.type).map(a=>[a.type,a.value]));return{year:Number(f.year),month:Number(f.month),day:Number(f.day),hours:Number(f.hour),minutes:Number(f.minute)}}function f(a){let b=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(a);if(!b)return null;let[,c,d,e,f,g]=b,h=[Number(c),Number(d),Number(e),Number(f),Number(g)];if(h.some(a=>!Number.isInteger(a)))return null;let[i,j,k,l,m]=h,n=new Date(Date.UTC(i,j-1,k,l,m));return j<1||j>12||k<1||l<0||l>23||m<0||m>59||n.getUTCFullYear()!==i||n.getUTCMonth()!==j-1||n.getUTCDate()!==k?null:{year:i,month:j,day:k,hours:l,minutes:m}}function g(a,c=b.DEFAULT_WORKSPACE_MARKET.timeZone){let d=Date.UTC(a.year,a.month-1,a.day,a.hours,a.minutes),f=[...new Set([new Date(d-864e5),new Date(d),new Date(d+864e5)].map(a=>{let b;return Date.UTC((b=e(a,c)).year,b.month-1,b.day,b.hours,b.minutes)-a.getTime()}))].map(a=>new Date(d-a));return f.find(b=>h(a,b,c))??f[0]??new Date(NaN)}function h(a,c,d=b.DEFAULT_WORKSPACE_MARKET.timeZone){let f=e(c??g(a,d),d);return f.year===a.year&&f.month===a.month&&f.day===a.day&&f.hours===a.hours&&f.minutes===a.minutes}function i(a){let b=/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(a??"").trim());if(!b)return null;let c=Number(b[1]),d=Number(b[2]);return c<0||c>23||d<0||d>59?null:60*c+d}a.s(["isValidLocalTime",0,h,"localDateTimeToUtc",0,g,"parseLocalDateTime",0,f,"resolveBookingTimeZone",0,d,"validatePublicBookingPolicy",0,function(a){let{startsAt:b,now:c,service:e,bookingHour:j}=a,k=d(a.timeZone),l=f(b);if(!l)return{error:"time"};let m=g(l,k);if(!h(l,m,k)||Number.isNaN(m.getTime())||m<=c)return{error:"time"};if(m.getTime()<c.getTime()+6e4*e.minimumNoticeMinutes)return{error:"notice"};if(m.getTime()>c.getTime()+864e5*e.maximumAdvanceDays)return{error:"advance"};if(!j)return{error:"hours_missing"};let n=i(j.opensAt),o=i(j.closesAt),p=60*l.hours+l.minutes;return j.isClosed||null===n||null===o||p<n||p+e.durationMinutes>o?{error:"hours"}:{error:null,localStart:l,start:m,end:new Date(m.getTime()+6e4*e.durationMinutes)}}])},732056,112512,a=>{"use strict";var b=a.i(666680),c=a.i(546767);function d(a){return a.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function e(a,b){return new Intl.DateTimeFormat("sv-SE",{timeZone:b,dateStyle:"full",timeStyle:"short"}).format(new Date(a))}async function f(a,b,c,d){let e=process.env.BREVO_API_KEY,f=process.env.LEAD_FROM_EMAIL;if(!e||!f)return{ok:!1,message:"Brevo är inte konfigurerat."};try{let g,h=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":e,"Content-Type":"application/json"},body:JSON.stringify({sender:(g=f.match(/^(.+?)\s*<([^>]+)>$/))?{name:g[1].trim(),email:g[2].trim()}:{name:"Proffera",email:f.trim()},to:[a],subject:b,textContent:c,htmlContent:d})}),i=await h.json().catch(()=>({}));return h.ok?{ok:!0,providerId:i.messageId??null}:{ok:!1,message:i.message??"Kunde inte skicka mejl."}}catch{return{ok:!1,message:"Kunde inte kontakta Brevo."}}}async function g(a){let b=`${e(a.oldStartsAt,a.timeZone)}–${e(a.oldEndsAt,a.timeZone)}`,c=a.newStartsAt&&a.newEndsAt?`${e(a.newStartsAt,a.timeZone)}–${e(a.newEndsAt,a.timeZone)}`:null,g="rescheduled"===a.kind,h=g?`Din bokningstid har \xe4ndrats – ${a.companyName}`:`Din bokning \xe4r avbokad – ${a.companyName}`,i=[`Hej ${a.customerName},`,"",g?`Din bokning hos ${a.companyName} har flyttats.`:`Din bokning hos ${a.companyName} har avbokats.`,`Tj\xe4nst: ${a.service}`,`Tidigare tid: ${b}`,c?`Ny tid: ${c}`:"",a.city?`Ort: ${a.city}`:"","",`Hantera dina bokningar: ${a.portalUrl}`].filter(Boolean).join("\n"),j=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><p>Hej ${d(a.customerName)},</p><p>${g?`Din bokning hos <strong>${d(a.companyName)}</strong> har flyttats.`:`Din bokning hos <strong>${d(a.companyName)}</strong> har avbokats.`}</p><ul><li><strong>Tj\xe4nst:</strong> ${d(a.service)}</li><li><strong>Tidigare tid:</strong> ${d(b)}</li>${c?`<li><strong>Ny tid:</strong> ${d(c)}</li>`:""}${a.city?`<li><strong>Ort:</strong> ${d(a.city)}</li>`:""}</ul><p><a href="${d(a.portalUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#fff;padding:13px 20px;text-decoration:none;font-weight:700">Hantera bokningar</a></p><p>Med v\xe4nliga h\xe4lsningar<br>${d(a.companyName)}</p></div>`,k=[f({email:a.customerEmail,name:a.customerName},h,i,j)];if(a.ownerEmail){let e=g?`Kunden har bokat om – ${a.service}`:`Kunden har avbokat – ${a.service}`,h=[`Kund: ${a.customerName}`,`E-post: ${a.customerEmail}`,`Tj\xe4nst: ${a.service}`,`Tidigare tid: ${b}`,c?`Ny tid: ${c}`:"",a.city?`Ort: ${a.city}`:""].filter(Boolean).join("\n"),i=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><h2>${d(e)}</h2><ul><li><strong>Kund:</strong> ${d(a.customerName)}</li><li><strong>E-post:</strong> ${d(a.customerEmail)}</li><li><strong>Tj\xe4nst:</strong> ${d(a.service)}</li><li><strong>Tidigare tid:</strong> ${d(b)}</li>${c?`<li><strong>Ny tid:</strong> ${d(c)}</li>`:""}${a.city?`<li><strong>Ort:</strong> ${d(a.city)}</li>`:""}</ul><p>\xd6ppna Proffera f\xf6r att hantera bokningen.</p></div>`;k.push(f({email:a.ownerEmail,name:a.companyName},e,h,i))}return Promise.allSettled(k)}a.s(["sendBookingChangeEmails",0,g],112512);var h=a.i(532539),i=a.i(612147),j=a.i(600375);let k=(0,i.resolveDatabaseUrl)(),l=(0,h.resolveCustomerPortalSecret)();function m(a){if(!l)throw Error("Missing customer portal secret");return b.default.createHmac("sha256",l).update(a).digest("base64url")}function n(a){try{let[c,d]=a.split(".");if(!c||!d||!l)return null;let e=Buffer.from(d),f=Buffer.from(m(c));if(e.length!==f.length||!b.default.timingSafeEqual(e,f))return null;let g=JSON.parse(Buffer.from(c,"base64url").toString("utf8"));return g.workspaceId&&g.customerId&&Number.isFinite(g.exp)&&g.exp>Math.floor(Date.now()/1e3)?g:null}catch{return null}}let o=a=>({id:String(a.id??""),title:String(a.title??a.service??"Bokning"),service:String(a.service??"Ej angiven"),city:String(a.city??""),status:String(a.status??"requested"),startsAt:new Date(String(a.starts_at)).toISOString(),endsAt:new Date(String(a.ends_at)).toISOString()});async function p(a){let b=n(a);if(!b||!k)return null;let d=(0,c.neon)(k),[e,f,g]=await Promise.all([d`select id, name from customers where id = ${b.customerId} and workspace_id = ${b.workspaceId} limit 1`,d`select time_zone from workspace_settings where workspace_id = ${b.workspaceId} limit 1`,d`select customer_reschedule_enabled, customer_cancel_enabled, cancel_notice_hours from workspace_booking_reminder_settings where workspace_id = ${b.workspaceId} limit 1`]),h=e[0];if(!h)return null;let i=await d`
    select id, title, service, city, status, starts_at, ends_at
    from bookings
    where customer_id = ${b.customerId}
      and workspace_id = ${b.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    order by starts_at asc
    limit 200
  `,l=Date.now(),m=i.map(o),p=g[0];return{timeZone:(0,j.resolveBookingTimeZone)(f[0]?.time_zone),customer:{id:String(h.id),name:String(h.name??"Kund")},upcoming:m.filter(a=>new Date(a.endsAt).getTime()>=l&&"cancelled"!==a.status),history:m.filter(a=>new Date(a.endsAt).getTime()<l||"cancelled"===a.status).reverse(),policy:{customerRescheduleEnabled:!p||!!p.customer_reschedule_enabled,customerCancelEnabled:!p||!!p.customer_cancel_enabled,cancelNoticeHours:p?Number(p.cancel_notice_hours):0}}}async function q(a,b){let d=n(a);if(!d||!k||!/^[0-9a-f-]{36}$/i.test(b))return{ok:!1,error:"invalid"};let e=(0,c.neon)(k),f=(await e`
    with cancelled_booking as (
      update bookings b
      set status = 'cancelled',
          updated_at = now()
      from customers c,
           workspaces w
           left join workspace_settings ws on ws.workspace_id = w.id::text
           left join workspace_booking_reminder_settings ps on ps.workspace_id = w.id::text
      where b.id = ${b}
        and b.customer_id = ${d.customerId}
        and b.workspace_id = ${d.workspaceId}
        and c.id = b.customer_id
        and c.workspace_id = b.workspace_id
        and w.id::text = b.workspace_id
        and coalesce(ps.customer_cancel_enabled, true) = true
        and b.status in ('requested', 'confirmed')
        and b.starts_at > now() + (coalesce(ps.cancel_notice_hours, 0) || ' hours')::interval
        and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
      returning
        b.id,
        b.workspace_id,
        b.customer_id,
        b.service,
        b.city,
        b.starts_at,
        b.ends_at,
        c.name as customer_name,
        c.email as customer_email,
        coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        nullif(ws.contact_email, '') as owner_email,
        coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    ),
    job_candidate as (
      select
        job.id,
        job.workspace_id,
        job.status as old_status
      from workspace_service_jobs job
      join cancelled_booking booking on booking.id = job.booking_id
      where job.workspace_id = ${d.workspaceId}::uuid
        and job.status not in ('completed', 'cancelled')
    ),
    cancelled_job as (
      update workspace_service_jobs job
      set status = 'cancelled',
          cancelled_at = now(),
          updated_at = now()
      from job_candidate candidate
      where job.id = candidate.id
        and job.workspace_id = candidate.workspace_id
      returning job.id, job.workspace_id, candidate.old_status
    ),
    job_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        from_status,
        to_status,
        summary,
        metadata
      )
      select
        workspace_id,
        id,
        'status_changed',
        old_status,
        'cancelled',
        'Service job cancelled because the customer cancelled its booking.',
        jsonb_build_object('source', 'customer_portal_cancellation', 'booking_id', ${b})
      from cancelled_job
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
        'status_change',
        'Bokning avbokad av kund',
        'Kunden avbokade bokningen via Mina bokningar.',
        jsonb_build_object('source', 'customer_portal', 'new_status', 'cancelled')
      from cancelled_booking
      returning id
    )
    select
      id,
      service,
      city,
      starts_at,
      ends_at,
      customer_name,
      customer_email,
      company_name,
      owner_email,
      time_zone
    from cancelled_booking
  `)[0];if(!f)return{ok:!1,error:"not_allowed"};let h=(process.env.NEXT_PUBLIC_APP_URL??process.env.APP_URL??"https://www.proffera.se").replace(/\/$/,"");return await g({kind:"cancelled",customerName:String(f.customer_name),customerEmail:String(f.customer_email),ownerEmail:f.owner_email?String(f.owner_email):void 0,companyName:String(f.company_name),service:String(f.service??"Bokning"),city:String(f.city??""),oldStartsAt:new Date(String(f.starts_at)).toISOString(),oldEndsAt:new Date(String(f.ends_at)).toISOString(),portalUrl:`${h}/mina-bokningar/${encodeURIComponent(a)}`,timeZone:(0,j.resolveBookingTimeZone)(f.time_zone)}),{ok:!0}}a.s(["cancelCustomerCalendarBooking",0,q,"createCustomerCalendarToken",0,function(a){let b,c=(b=JSON.stringify({workspaceId:a.workspaceId,customerId:a.customerId,exp:Math.floor(Date.now()/1e3)+(a.expiresInSeconds??2592e3)}),Buffer.from(b,"utf8").toString("base64url"));return`${c}.${m(c)}`},"getCustomerCalendar",0,p,"verifyCustomerCalendarToken",0,n],732056)}];

//# sourceMappingURL=src_lib_0io0nm.._.js.map