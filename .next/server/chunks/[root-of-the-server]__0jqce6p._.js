module.exports=[918622,(e,t,i)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,i)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,i)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,i)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,i)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,i)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,i)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,i)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,i)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),i()}catch(e){i(e)}},!0),3459,e=>{"use strict";var t=e.i(666680),i=e.i(276269);async function a(e){let a=function(e=process.env){let t=e.PUBLIC_FORM_RATE_LIMIT_SECRET?.trim();return t||(e.VERCEL_ENV||"production"===e.NODE_ENV?null:"proffera-public-form-rate-limit-v1")}(),r=(0,i.getSql)();if(!a||!r||e.maxAttempts<1||e.windowSeconds<1)return!1;try{let i=await r`
      insert into public_submission_rate_limits (
        scope,
        fingerprint,
        window_started_at,
        attempts,
        created_at,
        updated_at
      )
      values (
        ${e.scope},
        ${function({scope:e,requestHeaders:i,identity:a=""},r){let s=a.trim().toLowerCase();return(0,t.createHash)("sha256").update(`${r}:${e}:${i.get("x-forwarded-for")?.split(",")[0]?.trim()||i.get("x-real-ip")?.trim()||"unknown"}:${s}`).digest("hex")}(e,a)},
        now(),
        1,
        now(),
        now()
      )
      on conflict (scope, fingerprint)
      do update set
        attempts = case
          when public_submission_rate_limits.window_started_at <= now() - (${e.windowSeconds} * interval '1 second') then 1
          else public_submission_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public_submission_rate_limits.window_started_at <= now() - (${e.windowSeconds} * interval '1 second') then now()
          else public_submission_rate_limits.window_started_at
        end,
        updated_at = now()
      returning attempts
    `;return Number(i[0]?.attempts??e.maxAttempts+1)<=e.maxAttempts}catch(e){return console.error("Failed to apply public form rate limit",e),!1}}e.s(["allowPublicSubmission",0,a],3459)},872132,e=>{"use strict";var t=e.i(276269),i=e.i(730216),a=e.i(682923);let r=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function s(e,s){let n=(0,t.getSql)(),o=s.trim();if(!n||!r.test(e)||!o)return!1;try{let t=(await n`
      with latest_plan as (
        select plan_key, status, current_period_end
        from workspace_plans
        where workspace_id = ${e}::uuid
        order by created_at desc
        limit 1
      )
      select
        catalog.minimum_plan,
        coalesce(flag.enabled, false) as workspace_enabled,
        override.enabled as admin_override_enabled,
        plan.plan_key,
        plan.status as plan_status,
        plan.current_period_end as plan_period_end,
        trial.status as trial_status,
        trial.ends_at as trial_ends_at
      from feature_catalog catalog
      left join workspace_feature_flags flag
        on flag.workspace_id = ${e}::uuid
       and flag.feature_key = catalog.feature_key
      left join workspace_feature_overrides override
        on override.workspace_id = ${e}::uuid
       and override.feature_key = catalog.feature_key
      left join latest_plan plan on true
      left join workspace_feature_trials trial
        on trial.workspace_id = ${e}::uuid
       and trial.feature_key = catalog.feature_key
      where catalog.feature_key = ${o}
        and catalog.is_active = true
      limit 1
    `)[0];if(!t)return!1;let r=new Date,s=(0,a.isWorkspacePlanFeatureIncluded)({planKey:t.plan_key,planStatus:t.plan_status,planPeriodEnd:t.plan_period_end,minimumPlan:t.minimum_plan,now:r}),l=t.trial_ends_at?new Date(String(t.trial_ends_at)):null,d="active"===String(t.trial_status??"")&&!!l&&!Number.isNaN(l.getTime())&&l.getTime()>r.getTime(),c=null===t.admin_override_enabled||void 0===t.admin_override_enabled?null:!!t.admin_override_enabled;return(0,i.resolveWorkspaceFeatureAccess)({includedInPlan:s,trialActive:d,workspaceEnabled:!!t.workspace_enabled,adminOverrideEnabled:c}).hasAccess}catch(e){return console.error("Failed to resolve workspace feature access",e),!1}}e.s(["hasWorkspaceFeatureAccessForWorkspace",0,s])},356335,e=>e.a(async(t,i)=>{try{var a=e.i(141097),r=t([a]);[a]=r.then?(await r)():r;let o={booking_demo:"online_booking",crm_customers:"customer_crm",lead_inbox:"lead_management",ai_assistant:"ai_chatbot",chat_widget:"ai_chatbot"},l=new Set(["online_booking","customer_crm","lead_management","ai_chatbot","booking_reminders","verified_reviews","media_gallery","quote_management","website_builder","customer_portal","sms","custom_domain","video_upload","multiple_staff","advanced_automation","payments","analytics"]);async function s(){let e=await (0,a.getWorkspaceEntitlements)();return new Set(e.filter(e=>e.hasAccess&&l.has(e.featureKey)).map(e=>e.featureKey))}async function n(e){return(await s()).has(e in o?o[e]:e)}e.s(["hasDashboardFeatureAccess",0,n]),i()}catch(e){i(e)}},!1),599170,e=>{"use strict";var t=e.i(469719);let i=t.z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/),a=t.z.object({reviewerName:t.z.string().trim().min(2).max(80),rating:t.z.coerce.number().int().min(1).max(5),message:t.z.string().trim().min(10).max(1e3),consent:t.z.literal(!0),website:t.z.string().max(0),formStartedAt:t.z.coerce.number().int().positive()});e.s(["verifiedReviewSubmissionSchema",0,a,"verifiedReviewTokenSchema",0,i])},513403,e=>{"use strict";var t=e.i(666680);e.s(["createVerifiedReviewToken",0,function(){return(0,t.randomBytes)(32).toString("base64url")},"hashVerifiedReviewToken",0,function(e){return(0,t.createHash)("sha256").update(e,"utf8").digest("hex")}])},81066,e=>{"use strict";async function t(e){let{sql:t,actorUserId:i,workspaceId:a,bookingId:r,tokenHash:s,expiresAt:n}=e;return t`
    with target as (
      select
        b.id as booking_id,
        b.customer_id,
        b.title,
        c.name as customer_name,
        c.email as customer_email
      from bookings b
      join workspaces w
        on w.id::text = b.workspace_id
       and w.id = ${a}::uuid
       and w.status in ('active', 'trial')
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.id = ${r}::uuid
        and b.workspace_id = ${a}
        and b.status = 'completed'
      limit 1
    ),
    existing as (
      select invitation.status
      from website_review_invitations invitation
      join target on target.booking_id = invitation.booking_id
      where invitation.workspace_id = ${a}::uuid
      limit 1
    ),
    issued as (
      insert into website_review_invitations (
        workspace_id,
        booking_id,
        customer_id,
        token_hash,
        status,
        expires_at,
        used_at,
        revoked_at,
        created_by_user_id,
        updated_at
      )
      select
        ${a}::uuid,
        target.booking_id,
        target.customer_id,
        ${s},
        'pending',
        ${n}::timestamptz,
        null,
        null,
        ${i},
        now()
      from target
      on conflict (workspace_id, booking_id) do update
      set
        customer_id = excluded.customer_id,
        token_hash = excluded.token_hash,
        status = 'pending',
        expires_at = excluded.expires_at,
        used_at = null,
        revoked_at = null,
        created_by_user_id = excluded.created_by_user_id,
        updated_at = now()
      where website_review_invitations.status <> 'used'
      returning id, booking_id, customer_id, expires_at
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      )
      select
        ${i},
        ${a}::uuid,
        'website_review.invitation_issued',
        'Verified review invitation issued for completed booking',
        jsonb_build_object(
          'booking_id', issued.booking_id,
          'status', coalesce((select status from existing limit 1), 'none')
        ),
        jsonb_build_object(
          'booking_id', issued.booking_id,
          'status', 'pending',
          'expires_at', issued.expires_at
        )
      from issued
      returning id
    )
    select
      exists(select 1 from target) as target_exists,
      (select status from existing limit 1) as existing_status,
      (select id from issued limit 1) as invitation_id,
      (select expires_at from issued limit 1) as expires_at,
      (select booking_id from target limit 1) as booking_id,
      (select title from target limit 1) as booking_title,
      (select customer_name from target limit 1) as customer_name,
      (select customer_email from target limit 1) as customer_email,
      exists(select 1 from audited) as audited
  `}async function i(e){let{sql:t,tokenHash:i,review:a,featureEnabled:r}=e;return t`
    with locked as (
      select
        invitation.id as invitation_id,
        invitation.workspace_id,
        invitation.booking_id,
        invitation.customer_id,
        invitation.status as invitation_status,
        invitation.expires_at,
        workspace.status as workspace_status,
        booking.status as booking_status,
        booking.workspace_id as booking_workspace_id,
        booking.customer_id as booking_customer_id,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        ${r}::boolean as feature_enabled
      from website_review_invitations invitation
      join workspaces workspace on workspace.id = invitation.workspace_id
      join bookings booking on booking.id = invitation.booking_id
      left join customers customer
        on customer.id = invitation.customer_id
       and customer.workspace_id = booking.workspace_id
      where invitation.token_hash = ${i}
      for update of invitation
    ),
    eligible as (
      select *
      from locked
      where invitation_status = 'pending'
        and expires_at > now()
        and workspace_status in ('active', 'trial')
        and feature_enabled = true
        and booking_status = 'completed'
        and workspace_id::text = booking_workspace_id
        and (
          customer_id is null
          or customer_id = booking_customer_id
        )
        and not exists (
          select 1
          from website_reviews existing_review
          where existing_review.review_invitation_id = invitation_id
             or (existing_review.booking_id = locked.booking_id and existing_review.is_verified = true)
        )
    ),
    created as (
      insert into website_reviews (
        workspace_id,
        reviewer_name,
        rating,
        service,
        area,
        message,
        status,
        review_invitation_id,
        booking_id,
        customer_id,
        is_verified,
        verified_at
      )
      select
        eligible.workspace_id,
        ${a.reviewerName},
        ${a.rating},
        eligible.service,
        eligible.area,
        ${a.message},
        'pending',
        eligible.invitation_id,
        eligible.booking_id,
        eligible.customer_id,
        true,
        now()
      from eligible
      on conflict do nothing
      returning id, review_invitation_id
    ),
    consumed as (
      update website_review_invitations invitation
      set
        status = 'used',
        used_at = now(),
        updated_at = now()
      from created
      where invitation.id = created.review_invitation_id
      returning invitation.id
    )
    select
      (select id from created limit 1) as review_id,
      exists(select 1 from consumed) as submitted,
      (select invitation_status from locked limit 1) as invitation_status,
      (select expires_at from locked limit 1) as expires_at,
      (select booking_status from locked limit 1) as booking_status,
      (select workspace_status from locked limit 1) as workspace_status,
      (select feature_enabled from locked limit 1) as feature_enabled,
      exists(
        select 1
        from website_reviews review
        join locked on true
        where review.review_invitation_id = locked.invitation_id
           or (review.booking_id = locked.booking_id and review.is_verified = true)
      ) as review_exists
  `}e.s(["persistReviewInvitation",0,t,"persistVerifiedReviewSubmission",0,i])},378086,e=>e.a(async(t,i)=>{try{var a=e.i(276269),r=e.i(599170),s=e.i(695478),n=e.i(872132),o=e.i(356335),l=e.i(513403),d=e.i(81066),c=t([s,o]);[s,o]=c.then?(await c)():c;let k=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,h={companyName:"Service provider",timeZone:"Europe/Stockholm",language:"sv",primaryColor:"#173e2b",accentColor:"#d8ae52",logoUrl:null,homeUrl:null};function u(e,t=""){return null==e?t:String(e)}function _(e){return u(e).trim()||null}function p(e){return!0===e||"true"===e}function m(e,t){let i=u(e).trim();return/^#[0-9a-f]{6}$/i.test(i)?i:t}async function w(){let e=await (0,s.getUserWorkspaceAccess)();return e.ok&&(0,s.canManageWorkspaceSettings)(e)&&await (0,o.hasDashboardFeatureAccess)("verified_reviews")?e:null}async function v(){let[e,t]=await Promise.all([w(),Promise.resolve((0,a.getSql)())]);if(!e||!t)return null;try{var i;let a=await t`
      select
        coalesce(nullif(settings.company_name, ''), nullif(workspace.company_name, ''), workspace.name) as company_name,
        settings.time_zone,
        experience.default_language,
        experience.primary_color,
        experience.accent_color,
        experience.logo_url,
        experience.custom_domain,
        experience.custom_domain_status
      from workspaces workspace
      left join workspace_settings settings on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience on experience.workspace_id = workspace.id
      where workspace.id = ${e.workspaceId}::uuid
      limit 1
    `;return a[0]?(i=a[0],{companyName:u(i.company_name,h.companyName),timeZone:function(e){let t=u(e).trim();if(!t)return h.timeZone;try{return new Intl.DateTimeFormat("en",{timeZone:t}).format(new Date),t}catch{return h.timeZone}}(i.time_zone),language:"en"===u(i.default_language)?"en":"sv",primaryColor:m(i.primary_color,h.primaryColor),accentColor:m(i.accent_color,h.accentColor),logoUrl:function(e){let t=u(e).trim();if(!t)return null;if(t.startsWith("/")&&!t.startsWith("//"))return t;try{let e=new URL(t);return"https:"===e.protocol?e.toString():null}catch{return null}}(i.logo_url),homeUrl:"active"===u(i.custom_domain_status)?function(e){let t=u(e).trim();if(!t)return null;try{let e=new URL(t.includes("://")?t:`https://${t}`);return"https:"===e.protocol?e.origin:null}catch{return null}}(i.custom_domain):null}):{...h,companyName:e.workspaceName}}catch(t){return console.error("Failed to read verified review workspace context",t),{...h,companyName:e.workspaceName}}}async function f(e){let[t,i]=await Promise.all([w(),Promise.resolve((0,a.getSql)())]);if(!t)return{ok:!1,code:"access"};if(!i||!k.test(e))return{ok:!1,code:"invalid_booking"};let r=(0,l.createVerifiedReviewToken)(),s=(0,l.hashVerifiedReviewToken)(r),n=new Date(Date.now()+2592e6).toISOString();try{let a=(await (0,d.persistReviewInvitation)({sql:i,actorUserId:t.userId,workspaceId:t.workspaceId,bookingId:e,tokenHash:s,expiresAt:n}))[0];if(!p(a?.target_exists))return{ok:!1,code:"invalid_booking"};if("used"===u(a?.existing_status)&&!a?.invitation_id)return{ok:!1,code:"already_used"};if(!u(a?.invitation_id))return{ok:!1,code:"database"};return{ok:!0,token:r,bookingId:u(a?.booking_id,e),bookingTitle:u(a?.booking_title,"Completed booking"),customerName:_(a?.customer_name),customerEmail:_(a?.customer_email),expiresAt:u(a?.expires_at,n)}}catch(e){return console.error("Failed to issue verified review invitation",e),{ok:!1,code:"database"}}}async function g(e,t){let i=r.verifiedReviewTokenSchema.safeParse(e),s=(0,a.getSql)();if(!i.success||!s)return{ok:!1,code:"invalid"};let o=(0,l.hashVerifiedReviewToken)(i.data);try{let e=await s`
      select workspace_id
      from website_review_invitations
      where token_hash = ${o}
      limit 1
    `,i=u(e[0]?.workspace_id);if(!i)return{ok:!1,code:"invalid"};let a=await (0,n.hasWorkspaceFeatureAccessForWorkspace)(i,"verified_reviews");if(!a)return{ok:!1,code:"unavailable"};let r=(await (0,d.persistVerifiedReviewSubmission)({sql:s,tokenHash:o,review:t,featureEnabled:a}))[0],l=u(r?.review_id);if(l&&p(r?.submitted))return{ok:!0,reviewId:l};let c=u(r?.invitation_status);if(!c)return{ok:!1,code:"invalid"};if("used"===c||p(r?.review_exists))return{ok:!1,code:"used"};if("revoked"===c)return{ok:!1,code:"revoked"};if(new Date(u(r?.expires_at)).getTime()<=Date.now())return{ok:!1,code:"expired"};if("active"!==u(r?.workspace_status)&&"trial"!==u(r?.workspace_status)||!p(r?.feature_enabled)||"completed"!==u(r?.booking_status))return{ok:!1,code:"unavailable"};return{ok:!1,code:"database"}}catch(e){return console.error("Failed to submit verified review",e),{ok:!1,code:"database"}}}e.s(["getReviewInvitationDashboardContext",0,v,"issueReviewInvitation",0,f,"submitVerifiedReview",0,g]),i()}catch(e){i(e)}},!1),665798,e=>e.a(async(t,i)=>{try{var a=e.i(89171),r=e.i(599170),s=e.i(3459),n=e.i(378086),o=e.i(513403),l=t([n]);async function d(e,t){let i,{token:l}=await t.params,d=r.verifiedReviewTokenSchema.safeParse(l);if(!d.success)return a.NextResponse.json({error:"This review link is invalid."},{status:404,headers:{"Cache-Control":"no-store"}});try{i=await e.json()}catch{return a.NextResponse.json({error:"Please check the form and try again."},{status:400})}let c=r.verifiedReviewSubmissionSchema.safeParse(i);if(!c.success)return a.NextResponse.json({error:"Please complete the review form with valid details."},{status:400,headers:{"Cache-Control":"no-store"}});let u=c.data;if(u.website)return a.NextResponse.json({ok:!0},{status:201});let _=Date.now()-u.formStartedAt;if(_<2500||_>864e5)return a.NextResponse.json({error:"Please wait a moment and try again."},{status:400});if(!await (0,s.allowPublicSubmission)({scope:"verified_review",requestHeaders:e.headers,identity:(0,o.hashVerifiedReviewToken)(d.data),maxAttempts:4,windowSeconds:1800}))return a.NextResponse.json({error:"Too many attempts. Please wait before trying again."},{status:429,headers:{"Cache-Control":"no-store"}});let p=await (0,n.submitVerifiedReview)(d.data,u);if(!p.ok){let e="invalid"===p.code?404:"database"===p.code?503:409,t="expired"===p.code?"This review link has expired.":"used"===p.code?"This review link has already been used.":"revoked"===p.code?"This review link is no longer active.":"unavailable"===p.code?"This booking is not eligible for a review.":"database"===p.code?"The review could not be submitted right now.":"This review link is invalid.";return a.NextResponse.json({error:t},{status:e,headers:{"Cache-Control":"no-store"}})}return a.NextResponse.json({ok:!0},{status:201,headers:{"Cache-Control":"no-store"}})}[n]=l.then?(await l)():l,e.s(["POST",0,d,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),i()}catch(e){i(e)}},!1),261735,e=>e.a(async(t,i)=>{try{var a=e.i(747909),r=e.i(174017),s=e.i(996250),n=e.i(759756),o=e.i(561916),l=e.i(174677),d=e.i(869741),c=e.i(316795),u=e.i(487718),_=e.i(995169),p=e.i(47587),m=e.i(666012),w=e.i(570101),v=e.i(626937),f=e.i(10372),g=e.i(193695);e.i(820232);var k=e.i(600220),h=e.i(665798),b=t([h]);[h]=b.then?(await b)():b;let y=new a.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/reviews/[token]/route",pathname:"/api/reviews/[token]",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/reviews/[token]/route.ts",nextConfigOutput:"",userland:h,...{}}),{workAsyncStorage:R,workUnitAsyncStorage:C,serverHooks:S}=y;async function x(e,t,i){i.requestMeta&&(0,n.setRequestMeta)(e,i.requestMeta),y.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/reviews/[token]/route";a=a.replace(/\/index$/,"")||"/";let s=await y.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:h,params:b,nextConfig:x,parsedUrl:R,isDraftMode:C,prerenderManifest:S,routerServerContext:E,isOnDemandRevalidate:j,revalidateOnlyGenerated:T,resolvedPathname:N,clientReferenceManifest:A,serverActionsManifest:P}=s,$=(0,d.normalizeAppPath)(a),q=!!(S.dynamicRoutes[$]||S.routes[N]),I=async()=>((null==E?void 0:E.render404)?await E.render404(e,t,R,!1):t.end("This page could not be found"),null);if(q&&!C){let e=!!S.routes[N],t=S.dynamicRoutes[$];if(t&&!1===t.fallback&&!e){if(x.adapterPath)return await I();throw new g.NoFallbackError}}let D=null;!q||y.isDev||C||(D=N,D="/index"===D?"/":D);let O=!0===y.isDev||!q,U=q&&!O;P&&A&&(0,l.setManifestsSingleton)({page:a,clientReferenceManifest:A,serverActionsManifest:P});let F=e.method||"GET",H=(0,o.getTracer)(),M=H.getActiveScopeSpan(),V=!!(null==E?void 0:E.isWrappedByNextServer),z=!!(0,n.getRequestMeta)(e,"minimalMode"),W=(0,n.getRequestMeta)(e,"incrementalCache")||await y.getIncrementalCache(e,x,S,z);null==W||W.resetRequestCache(),globalThis.__incrementalCache=W;let K={params:b,previewProps:S.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:O,incrementalCache:W,cacheLifeProfiles:x.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,i,a,r)=>y.onRequestError(e,t,a,r,E)},sharedContext:{buildId:h}},L=new c.NodeNextRequest(e),B=new c.NodeNextResponse(t),Z=u.NextRequestAdapter.fromNodeNextRequest(L,(0,u.signalFromNodeResponse)(t));try{let s,n=async e=>y.handle(Z,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let i=H.getRootSpanAttributes();if(!i)return;if(i.get("next.span_type")!==_.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${i.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=i.get("next.route");if(r){let t=`${F} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",r),s.updateName(t))}else e.updateName(`${F} ${a}`)}),l=async s=>{var o,l;let d=async({previousCacheEntry:r})=>{try{if(!z&&j&&T&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await n(s);e.fetchMetrics=K.renderOpts.fetchMetrics;let o=K.renderOpts.pendingWaitUntil;o&&i.waitUntil&&(i.waitUntil(o),o=void 0);let l=K.renderOpts.collectedTags;if(!q)return await (0,m.sendResponse)(L,B,a,K.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,w.toNodeOutgoingHttpHeaders)(a.headers);l&&(t[f.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let i=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,r=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:k.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:i,expire:r}}}}catch(t){throw(null==r?void 0:r.isStale)&&await y.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:j})},!1,E),t}},c=await y.handleResponse({req:e,nextConfig:x,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:j,revalidateOnlyGenerated:T,responseGenerator:d,waitUntil:i.waitUntil,isMinimalMode:z});if(!q)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==k.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});z||t.setHeader("x-nextjs-cache",j?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,w.fromNodeOutgoingHttpHeaders)(c.value.headers);return z&&q||u.delete(f.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,v.getCacheControlHeader)(c.cacheControl)),await (0,m.sendResponse)(L,B,new Response(c.value.body,{headers:u,status:c.value.status||200})),null};V&&M?await l(M):(s=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(_.BaseServerSpan.handleRequest,{spanName:`${F} ${a}`,kind:o.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},l),void 0,!V))}catch(t){if(t instanceof g.NoFallbackError||await y.onRequestError(e,t,{routerKind:"App Router",routePath:$,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:j})},!1,E),q)throw t;return await (0,m.sendResponse)(L,B,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:C})},"routeModule",0,y,"serverHooks",0,S,"workAsyncStorage",0,R,"workUnitAsyncStorage",0,C]),i()}catch(e){i(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0jqce6p._.js.map