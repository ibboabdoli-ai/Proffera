module.exports=[927776,e=>e.a(async(t,a)=>{try{var i=e.i(666680),n=e.i(972942);e.i(133151);var r=e.i(79832),s=e.i(276269),o=t([r]);async function l(e,t){let a=(0,s.getSql)();if(!a)return{ok:!1,code:"database"};try{let r=(await a`
      select id, company_name, contact_person, email, status
      from company_registrations
      where id = ${e}::uuid
      limit 1
    `)[0];if(!r||"approved"!==String(r.status))return{ok:!1,code:"invalid"};let s=(0,i.randomBytes)(32).toString("base64url"),o=(0,i.createHash)("sha256").update(s).digest("hex"),l=new Date(Date.now()+1728e5);await a`
      insert into workspace_invitations (
        company_registration_id,
        email,
        token_hash,
        status,
        expires_at
      ) values (
        ${e}::uuid,
        ${String(r.email).trim().toLowerCase()},
        ${o},
        'pending',
        ${l.toISOString()}::timestamptz
      )
      on conflict (company_registration_id) do update set
        email = excluded.email,
        token_hash = excluded.token_hash,
        status = 'pending',
        expires_at = excluded.expires_at,
        accepted_at = null,
        workspace_id = null,
        updated_at = now()
    `;let u=new URL(`/aktivera/${s}`,t).toString(),d=await (0,n.sendWorkspaceInvitationEmail)({companyName:String(r.company_name),contactName:String(r.contact_person),email:String(r.email),activationUrl:u,expiresInHours:48});return d.ok?{ok:!0}:{ok:!1,code:`email_${d.code}`}}catch(e){return console.error("Failed to create workspace invitation",e),{ok:!1,code:"database"}}}[r]=o.then?(await o)():o,e.s(["createWorkspaceInvitation",0,l]),a()}catch(e){a(e)}},!1),315691,e=>e.a(async(t,a)=>{try{var i=e.i(89171),n=e.i(927776),r=e.i(27399),s=e.i(276269),o=t([n,r]);[n,r]=o.then?(await o)():o;let d=["pending","approved","rejected","paused"],c=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function l(e,t,a){let n=new URL("/admin/foretag",e.url);return t&&a&&n.searchParams.set(t,a),i.NextResponse.redirect(n)}async function u(e){let t=await (0,r.getCompanyAdmin)(),a=new URL(e.url),i=e.headers.get("origin");if(!t||i&&i!==a.origin)return l(e,"access","forbidden");let o=await e.formData(),u=String(o.get("id")??""),p=String(o.get("action")??""),g=String(o.get("status")??""),m=String(o.get("services")??""),h=(0,s.getSql)();if(!h)return l(e,"access","database");if("workspace_access"===p){let a=String(o.get("workspace_id")??""),i=String(o.get("plan_key")??""),n=String(o.get("plan_status")??"");if(!c.test(a))return l(e,"access","invalid");let r=(await h`
      select coalesce(p.plan_key, 'none') as plan_key, coalesce(p.status, 'none') as plan_status
      from workspaces w
      left join lateral (
        select plan_key, status
        from workspace_plans
        where workspace_id = w.id
        order by created_at desc
        limit 1
      ) p on true
      where w.id = ${a}::uuid
      limit 1
    `)[0];return await h`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${t.userId},
        ${a}::uuid,
        'billing.manual_change_blocked',
        'Manual plan or subscription status changes are blocked because Stripe is the source of truth',
        ${JSON.stringify({plan_key:r?.plan_key??null,status:r?.plan_status??null})}::jsonb,
        ${JSON.stringify({blocked:!0,requested_plan_key:i||null,requested_status:n||null})}::jsonb
      )
    `,l(e,"access","read_only")}if(!c.test(u))return l(e,"access","invalid");if("invite"===p){let i=await h`
      select cr.id, cr.company_name, cr.email, cr.status,
             wi.status as invitation_status, wi.expires_at
      from company_registrations cr
      left join workspace_invitations wi on wi.company_registration_id = cr.id
      where cr.id = ${u}::uuid
      limit 1
    `,r=await (0,n.createWorkspaceInvitation)(u,a.origin);return await h`
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      ) values (
        ${t.userId},
        'company.invitation_requested',
        ${`Workspace invitation requested for company registration ${u}`},
        ${JSON.stringify(i[0]??null)}::jsonb,
        ${JSON.stringify({registration_id:u,result:r.ok?"sent":r.code})}::jsonb
      )
    `,l(e,"invite",r.ok?"sent":r.code)}let _=(await h`
    select id, status, services
    from company_registrations
    where id = ${u}::uuid
    limit 1
  `)[0];if(!_)return l(e,"access","missing");let v=d.includes(g)?g:String(_.status),w=m.trim(),f=w.length>0&&w.length<=300?w:String(_.services??"");return v===String(_.status)&&f===String(_.services??"")||await h.transaction(e=>[e`
      update company_registrations
      set status = ${v}, services = ${f}, updated_at = now()
      where id = ${u}::uuid
    `,e`
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      ) values (
        ${t.userId},
        'company.registration_updated',
        ${`Company registration ${u} updated from Company Admin`},
        ${JSON.stringify({registration_id:u,status:_.status,services:_.services})}::jsonb,
        ${JSON.stringify({registration_id:u,status:v,services:f})}::jsonb
      )
    `]),l(e)}e.s(["POST",0,u]),a()}catch(e){a(e)}},!1),655393,e=>e.a(async(t,a)=>{try{var i=e.i(747909),n=e.i(174017),r=e.i(996250),s=e.i(759756),o=e.i(561916),l=e.i(174677),u=e.i(869741),d=e.i(316795),c=e.i(487718),p=e.i(995169),g=e.i(47587),m=e.i(666012),h=e.i(570101),_=e.i(626937),v=e.i(10372),w=e.i(193695);e.i(820232);var f=e.i(600220),y=e.i(315691),R=t([y]);[y]=R.then?(await R)():R;let k=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/company-admin/route",pathname:"/api/company-admin",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/company-admin/route.ts",nextConfigOutput:"",userland:y,...{}}),{workAsyncStorage:b,workUnitAsyncStorage:E,serverHooks:x}=k;async function S(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),k.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let i="/api/company-admin/route";i=i.replace(/\/index$/,"")||"/";let r=await k.prepare(e,t,{srcPage:i,multiZoneDraftMode:!1});if(!r)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:y,params:R,nextConfig:S,parsedUrl:b,isDraftMode:E,prerenderManifest:x,routerServerContext:C,isOnDemandRevalidate:$,revalidateOnlyGenerated:N,resolvedPathname:A,clientReferenceManifest:O,serverActionsManifest:P}=r,T=(0,u.normalizeAppPath)(i),q=!!(x.dynamicRoutes[T]||x.routes[A]),I=async()=>((null==C?void 0:C.render404)?await C.render404(e,t,b,!1):t.end("This page could not be found"),null);if(q&&!E){let e=!!x.routes[A],t=x.dynamicRoutes[T];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await I();throw new w.NoFallbackError}}let H=null;!q||k.isDev||E||(H=A,H="/index"===H?"/":H);let U=!0===k.isDev||!q,j=q&&!U;P&&O&&(0,l.setManifestsSingleton)({page:i,clientReferenceManifest:O,serverActionsManifest:P});let D=e.method||"GET",M=(0,o.getTracer)(),F=M.getActiveScopeSpan(),L=!!(null==C?void 0:C.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),B=(0,s.getRequestMeta)(e,"incrementalCache")||await k.getIncrementalCache(e,S,x,K);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let W={params:R,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:U,incrementalCache:B,cacheLifeProfiles:S.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,i,n)=>k.onRequestError(e,t,i,n,C)},sharedContext:{buildId:y}},J=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),V=c.NextRequestAdapter.fromNodeNextRequest(J,(0,c.signalFromNodeResponse)(t));try{let r,s=async e=>k.handle(V,W).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=M.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${D} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),r&&r!==e&&(r.setAttribute("http.route",n),r.updateName(t))}else e.updateName(`${D} ${i}`)}),l=async r=>{var o,l;let u=async({previousCacheEntry:n})=>{try{if(!K&&$&&N&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await s(r);e.fetchMetrics=W.renderOpts.fetchMetrics;let o=W.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let l=W.renderOpts.collectedTags;if(!q)return await (0,m.sendResponse)(J,G,i,W.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[v.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==W.renderOpts.collectedRevalidate&&!(W.renderOpts.collectedRevalidate>=v.INFINITE_CACHE)&&W.renderOpts.collectedRevalidate,n=void 0===W.renderOpts.collectedExpire||W.renderOpts.collectedExpire>=v.INFINITE_CACHE?void 0:W.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await k.onRequestError(e,t,{routerKind:"App Router",routePath:i,routeType:"route",revalidateReason:(0,g.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:$})},!1,C),t}},d=await k.handleResponse({req:e,nextConfig:S,cacheKey:H,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:$,revalidateOnlyGenerated:N,responseGenerator:u,waitUntil:a.waitUntil,isMinimalMode:K});if(!q)return null;if((null==d||null==(o=d.value)?void 0:o.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",$?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,h.fromNodeOutgoingHttpHeaders)(d.value.headers);return K&&q||c.delete(v.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,_.getCacheControlHeader)(d.cacheControl)),await (0,m.sendResponse)(J,G,new Response(d.value.body,{headers:c,status:d.value.status||200})),null};L&&F?await l(F):(r=M.getActiveScopeSpan(),await M.withPropagatedContext(e.headers,()=>M.trace(p.BaseServerSpan.handleRequest,{spanName:`${D} ${i}`,kind:o.SpanKind.SERVER,attributes:{"http.method":D,"http.target":e.url}},l),void 0,!L))}catch(t){if(t instanceof w.NoFallbackError||await k.onRequestError(e,t,{routerKind:"App Router",routePath:T,routeType:"route",revalidateReason:(0,g.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:$})},!1,C),q)throw t;return await (0,m.sendResponse)(J,G,new Response(null,{status:500})),null}}e.s(["handler",0,S,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:E})},"routeModule",0,k,"serverHooks",0,x,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,E]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_0h0s0~t._.js.map