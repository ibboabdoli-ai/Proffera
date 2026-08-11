module.exports=[905786,e=>{"use strict";function t(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function a(e,t="Europe/Stockholm"){let r=new Date(e);return Number.isNaN(r.getTime())?e:new Intl.DateTimeFormat("sv-SE",{timeZone:t,dateStyle:"full",timeStyle:"short"}).format(r)}async function r(e){let r=process.env.BREVO_API_KEY,i=process.env.LEAD_FROM_EMAIL;if(!r||!i)return{ok:!1,message:"Brevo är inte konfigurerat."};let s=a(e.previousStartsAt,e.timeZone),n=a(e.startsAt,e.timeZone),o=a(e.endsAt,e.timeZone),d=`Din bokning har flyttats – ${e.companyName}`,l=[`Hej ${e.customerName},`,"",`Din bokning hos ${e.companyName} har f\xe5tt en ny tid.`,"",`Tidigare start: ${s}`,`Ny start: ${n}`,`Ny sluttid: ${o}`,`Tj\xe4nst: ${e.service}`,e.city?`Ort: ${e.city}`:"","","Kontakta företaget om den nya tiden inte passar.","","Med vänliga hälsningar",e.companyName].filter(Boolean).join("\n"),c=`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
      <p>Hej ${t(e.customerName)},</p>
      <p>Din bokning hos <strong>${t(e.companyName)}</strong> har f\xe5tt en ny tid.</p>
      <ul>
        <li><strong>Tidigare start:</strong> ${t(s)}</li>
        <li><strong>Ny start:</strong> ${t(n)}</li>
        <li><strong>Ny sluttid:</strong> ${t(o)}</li>
        <li><strong>Tj\xe4nst:</strong> ${t(e.service)}</li>
        ${e.city?`<li><strong>Ort:</strong> ${t(e.city)}</li>`:""}
      </ul>
      <p>Kontakta f\xf6retaget om den nya tiden inte passar.</p>
      <p>Med v\xe4nliga h\xe4lsningar<br />${t(e.companyName)}</p>
    </div>
  `;try{let t,a=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":r,"Content-Type":"application/json"},body:JSON.stringify({sender:(t=i.match(/^(.+?)\s*<([^>]+)>$/))?{name:t[1].trim(),email:t[2].trim()}:{name:"Proffera",email:i.trim()},to:[{email:e.customerEmail,name:e.customerName}],subject:d,textContent:l,htmlContent:c})}),s=await a.json().catch(()=>({}));if(!a.ok)return{ok:!1,message:s.message??s.code??"Kunde inte skicka ombokningsmejl."};return{ok:!0,providerId:s.messageId??null}}catch{return{ok:!1,message:"Kunde inte kontakta Brevo."}}}e.s(["sendBookingRescheduleEmail",0,r])},119382,e=>{"use strict";function t(e,a="Europe/Stockholm"){return new Intl.DateTimeFormat("sv-SE",{timeZone:a,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(e))}async function a(e){let a,r,i=process.env.BREVO_API_KEY,s=process.env.BREVO_SMS_SENDER?.trim();if(!i||!s)return{ok:!1,skipped:!0,message:"Brevo SMS är inte aktiverat."};let n=(r=e.customerPhone.replace(/[^\d+]/g,""),/^\+[1-9]\d{6,14}$/.test(r)?r:/^00[1-9]\d{6,14}$/.test(r)?`+${r.slice(2)}`:/^0\d{7,12}$/.test(r)?`+46${r.slice(1)}`:null);if(!n)return{ok:!1,skipped:!0,message:"Kundens telefonnummer är ogiltigt."};if("confirmed"===e.status)a=`Din bokning hos ${e.companyName} \xe4r bekr\xe4ftad: ${e.service}, ${t(e.startsAt,e.timeZone)}.`;else if("cancelled"===e.status)a=`Din bokning hos ${e.companyName} \xe4r avbokad: ${e.service}, ${t(e.startsAt,e.timeZone)}. Kontakta f\xf6retaget f\xf6r ny tid.`;else{let r=e.previousStartsAt?` fr\xe5n ${t(e.previousStartsAt,e.timeZone)}`:"";a=`Din bokning hos ${e.companyName} har flyttats${r} till ${t(e.startsAt,e.timeZone)}: ${e.service}.`}try{let e=await fetch("https://api.brevo.com/v3/transactionalSMS/sms",{method:"POST",headers:{"api-key":i,"Content-Type":"application/json"},body:JSON.stringify({sender:s.slice(0,11),recipient:n,content:a,type:"transactional"})}),t=await e.json().catch(()=>({}));if(!e.ok)return{ok:!1,skipped:!1,message:t.message??t.code??"Kunde inte skicka SMS via Brevo."};return{ok:!0,skipped:!1,providerId:t.messageId??null}}catch{return{ok:!1,skipped:!1,message:"Kunde inte kontakta Brevo SMS."}}}e.s(["sendBookingCustomerSms",0,a])},45751,e=>e.a(async(t,a)=>{try{var r=e.i(598323),i=e.i(263124),s=e.i(456298),n=e.i(695478),o=t([n]);[n]=o.then?(await o)():o;let l=(0,i.resolveDatabaseUrl)();class c extends Error{code;constructor(e){super(e),this.code=e,this.name="CalendarMoveValidationError"}}async function d(e){if(!l)throw Error("Missing database connection for calendar move");let t=await (0,n.getUserWorkspaceAccess)();if(!t.ok||!(0,n.canManageWorkspaceSettings)(t))throw Error("Owner or admin workspace access is required");let a=(0,r.neon)(l),i=await a`
    select time_zone
    from workspace_settings
    where workspace_id = ${t.workspaceId}
    limit 1
  `,o=(0,s.resolveBookingTimeZone)(i[0]?.time_zone),d=(0,s.parseLocalDateTime)(e.localStartsAt);if(!d)throw new c("time");let u=(0,s.localDateTimeToUtc)(d,o);if(!(0,s.isValidLocalTime)(d,u,o)||Number.isNaN(u.getTime()))throw new c("time");if(u<=new Date)throw new c("past");let m=(await a`
    select
      b.id,
      b.customer_id,
      b.status,
      b.service,
      b.city,
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
    where b.id = ${e.bookingId}
      and b.workspace_id = ${t.workspaceId}
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `)[0];if(!m)throw Error("Booking not found");if(["cancelled","no_show","completed"].includes(String(m.status)))throw new c("status");let p=new Date(String(m.starts_at)),f=new Date(String(m.ends_at)),h=f.getTime()-p.getTime();if(!Number.isFinite(h)||h<=0)throw new c("time");let g=new Date(u.getTime()+h);if((await a`
    select id
    from bookings
    where workspace_id = ${t.workspaceId}
      and id <> ${e.bookingId}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${g.toISOString()}::timestamptz
      and ends_at > ${u.toISOString()}::timestamptz
      and source in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `)[0])throw new c("conflict");let w=e.staffId.trim();if(w){if(!(await a`
      select id
      from workspace_staff
      where id = ${w}
        and workspace_id = ${t.workspaceId}
        and is_active = true
      limit 1
    `)[0])throw new c("staff");let r=(await a`
      select
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${t.workspaceId}
            and ss.staff_id = ${w}::uuid
            and ss.is_active = true
        ) as has_schedule,
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${t.workspaceId}
            and ss.staff_id = ${w}::uuid
            and ss.is_active = true
            and ss.weekday = extract(dow from (${u.toISOString()}::timestamptz at time zone ${o}))::int
            and ss.start_time <= (${u.toISOString()}::timestamptz at time zone ${o})::time
            and ss.end_time >= (${g.toISOString()}::timestamptz at time zone ${o})::time
            and (${u.toISOString()}::timestamptz at time zone ${o})::date = (${g.toISOString()}::timestamptz at time zone ${o})::date
        ) as inside_schedule,
        exists(
          select 1 from workspace_staff_time_off t
          where t.workspace_id = ${t.workspaceId}
            and t.staff_id = ${w}::uuid
            and t.starts_at < ${g.toISOString()}::timestamptz
            and t.ends_at > ${u.toISOString()}::timestamptz
        ) as has_time_off
    `)[0];if(r?.has_time_off)throw new c("staff_time_off");if(r?.has_schedule&&!r?.inside_schedule)throw new c("staff_hours");if((await a`
      select id
      from bookings
      where workspace_id = ${t.workspaceId}
        and staff_id = ${w}::uuid
        and id <> ${e.bookingId}
        and status not in ('cancelled', 'no_show')
        and starts_at < ${g.toISOString()}::timestamptz
        and ends_at > ${u.toISOString()}::timestamptz
      limit 1
    `)[0])throw new c("staff_conflict")}if(p.getTime()===u.getTime()&&String(m.staff_id??"")===w)return{workspaceName:t.workspaceName,timeZone:o,notification:null};if(!(await a`
    update bookings
    set starts_at = ${u.toISOString()}::timestamptz,
        ends_at = ${g.toISOString()}::timestamptz,
        staff_id = ${w||null}::uuid,
        updated_at = now()
    where id = ${e.bookingId}
      and workspace_id = ${t.workspaceId}
    returning id
  `)[0])throw Error("Calendar move failed");return await a`
    insert into customer_events (
      workspace_id, customer_id, booking_id, event_type, title, description, metadata
    ) values (
      ${t.workspaceId},
      ${m.customer_id?String(m.customer_id):null},
      ${e.bookingId},
      'booking_rescheduled',
      'Bokning flyttad i kalender',
      'Bokningens tid eller tilldelade medarbetare ändrades i kalendern.',
      jsonb_build_object(
        'source', 'dashboard_calendar_drag_drop',
        'previous_starts_at', ${p.toISOString()},
        'previous_ends_at', ${f.toISOString()},
        'starts_at', ${u.toISOString()},
        'ends_at', ${g.toISOString()},
        'previous_staff_id', ${String(m.staff_id??"")},
        'staff_id', ${w}
      )
    )
  `,{workspaceName:t.workspaceName,timeZone:o,notification:{customerName:String(m.customer_name??"Kund"),customerEmail:String(m.customer_email??""),customerPhone:String(m.customer_phone??""),service:String(m.service??"Bokning"),city:String(m.city??""),previousStartsAt:p.toISOString(),startsAt:u.toISOString(),endsAt:g.toISOString()}}}e.s(["CalendarMoveValidationError",0,c,"moveDashboardCalendarBooking",0,d]),a()}catch(e){a(e)}},!1),19161,e=>e.a(async(t,a)=>{try{var r=e.i(89171),i=e.i(905786),s=e.i(119382),n=e.i(45751),o=t([n]);async function d(e){try{let t=await e.json(),a=String(t.bookingId??"").trim(),o=String(t.localStartsAt??"").trim(),d=String(t.staffId??"").trim();if(!a||!o)return r.NextResponse.json({ok:!1,error:"time"},{status:400});let l=await (0,n.moveDashboardCalendarBooking)({bookingId:a,localStartsAt:o,staffId:d});if(l.notification){let e=l.notification;await Promise.allSettled([e.customerEmail?(0,i.sendBookingRescheduleEmail)({customerName:e.customerName,customerEmail:e.customerEmail,companyName:l.workspaceName,service:e.service,previousStartsAt:e.previousStartsAt,startsAt:e.startsAt,endsAt:e.endsAt,city:e.city,timeZone:l.timeZone}):Promise.resolve(null),e.customerPhone?(0,s.sendBookingCustomerSms)({customerPhone:e.customerPhone,companyName:l.workspaceName,status:"rescheduled",service:e.service,previousStartsAt:e.previousStartsAt,startsAt:e.startsAt,timeZone:l.timeZone}):Promise.resolve(null)])}return r.NextResponse.json({ok:!0})}catch(e){if(e instanceof n.CalendarMoveValidationError)return r.NextResponse.json({ok:!1,error:e.code},{status:409});return console.error("Failed to move dashboard calendar booking",e),r.NextResponse.json({ok:!1,error:"save"},{status:500})}}[n]=o.then?(await o)():o,e.s(["POST",0,d,"dynamic",0,"force-dynamic"]),a()}catch(e){a(e)}},!1),241539,e=>e.a(async(t,a)=>{try{var r=e.i(747909),i=e.i(174017),s=e.i(996250),n=e.i(759756),o=e.i(561916),d=e.i(174677),l=e.i(869741),c=e.i(316795),u=e.i(487718),m=e.i(995169),p=e.i(47587),f=e.i(666012),h=e.i(570101),g=e.i(626937),w=e.i(10372),_=e.i(193695);e.i(820232);var k=e.i(600220),v=e.i(19161),S=t([v]);[v]=S.then?(await S)():S;let b=new r.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/dashboard/calendar/move/route",pathname:"/api/dashboard/calendar/move",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/dashboard/calendar/move/route.ts",nextConfigOutput:"",userland:v,...{}}),{workAsyncStorage:$,workUnitAsyncStorage:R,serverHooks:E}=b;async function y(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),b.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let r="/api/dashboard/calendar/move/route";r=r.replace(/\/index$/,"")||"/";let s=await b.prepare(e,t,{srcPage:r,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:v,params:S,nextConfig:y,parsedUrl:$,isDraftMode:R,prerenderManifest:E,routerServerContext:A,isOnDemandRevalidate:N,revalidateOnlyGenerated:I,resolvedPathname:x,clientReferenceManifest:O,serverActionsManifest:C}=s,T=(0,l.normalizeAppPath)(r),P=!!(E.dynamicRoutes[T]||E.routes[x]),D=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,$,!1):t.end("This page could not be found"),null);if(P&&!R){let e=!!E.routes[x],t=E.dynamicRoutes[T];if(t&&!1===t.fallback&&!e){if(y.adapterPath)return await D();throw new _.NoFallbackError}}let M=null;!P||b.isDev||R||(M=x,M="/index"===M?"/":M);let B=!0===b.isDev||!P,j=P&&!B;C&&O&&(0,d.setManifestsSingleton)({page:r,clientReferenceManifest:O,serverActionsManifest:C});let z=e.method||"GET",q=(0,o.getTracer)(),H=q.getActiveScopeSpan(),K=!!(null==A?void 0:A.isWrappedByNextServer),U=!!(0,n.getRequestMeta)(e,"minimalMode"),F=(0,n.getRequestMeta)(e,"incrementalCache")||await b.getIncrementalCache(e,y,E,U);null==F||F.resetRequestCache(),globalThis.__incrementalCache=F;let Z={params:S,previewProps:E.preview,renderOpts:{experimental:{authInterrupts:!!y.experimental.authInterrupts},cacheComponents:!!y.cacheComponents,supportsDynamicResponse:B,incrementalCache:F,cacheLifeProfiles:y.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,i)=>b.onRequestError(e,t,r,i,A)},sharedContext:{buildId:v}},V=new c.NodeNextRequest(e),L=new c.NodeNextResponse(t),W=u.NextRequestAdapter.fromNodeNextRequest(V,(0,u.signalFromNodeResponse)(t));try{let s,n=async e=>b.handle(W,Z).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=q.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=a.get("next.route");if(i){let t=`${z} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",i),s.updateName(t))}else e.updateName(`${z} ${r}`)}),d=async s=>{var o,d;let l=async({previousCacheEntry:i})=>{try{if(!U&&N&&I&&!i)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await n(s);e.fetchMetrics=Z.renderOpts.fetchMetrics;let o=Z.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let d=Z.renderOpts.collectedTags;if(!P)return await (0,f.sendResponse)(V,L,r,Z.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(r.headers);d&&(t[w.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==Z.renderOpts.collectedRevalidate&&!(Z.renderOpts.collectedRevalidate>=w.INFINITE_CACHE)&&Z.renderOpts.collectedRevalidate,i=void 0===Z.renderOpts.collectedExpire||Z.renderOpts.collectedExpire>=w.INFINITE_CACHE?void 0:Z.renderOpts.collectedExpire;return{value:{kind:k.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:i}}}}catch(t){throw(null==i?void 0:i.isStale)&&await b.onRequestError(e,t,{routerKind:"App Router",routePath:r,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:N})},!1,A),t}},c=await b.handleResponse({req:e,nextConfig:y,cacheKey:M,routeKind:i.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:E,isRoutePPREnabled:!1,isOnDemandRevalidate:N,revalidateOnlyGenerated:I,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:U});if(!P)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==k.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(d=c.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});U||t.setHeader("x-nextjs-cache",N?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),R&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,h.fromNodeOutgoingHttpHeaders)(c.value.headers);return U&&P||u.delete(w.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,g.getCacheControlHeader)(c.cacheControl)),await (0,f.sendResponse)(V,L,new Response(c.value.body,{headers:u,status:c.value.status||200})),null};K&&H?await d(H):(s=q.getActiveScopeSpan(),await q.withPropagatedContext(e.headers,()=>q.trace(m.BaseServerSpan.handleRequest,{spanName:`${z} ${r}`,kind:o.SpanKind.SERVER,attributes:{"http.method":z,"http.target":e.url}},d),void 0,!K))}catch(t){if(t instanceof _.NoFallbackError||await b.onRequestError(e,t,{routerKind:"App Router",routePath:T,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:N})},!1,A),P)throw t;return await (0,f.sendResponse)(V,L,new Response(null,{status:500})),null}}e.s(["handler",0,y,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:$,workUnitAsyncStorage:R})},"routeModule",0,b,"serverHooks",0,E,"workAsyncStorage",0,$,"workUnitAsyncStorage",0,R]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_0e~iwxl._.js.map