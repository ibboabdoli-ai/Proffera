module.exports=[918622,(e,t,i)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,i)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,i)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},666680,(e,t,i)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},902157,(e,t,i)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},912714,(e,t,i)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(e,t,i)=>{t.exports=e.x("node:os",()=>require("node:os"))},750227,(e,t,i)=>{t.exports=e.x("node:path",()=>require("node:path"))},723862,e=>e.a(async(t,i)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),i()}catch(e){i(e)}},!0),872132,e=>{"use strict";var t=e.i(276269),i=e.i(730216),a=e.i(682923);let r=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function s(e,s){let o=(0,t.getSql)(),n=s.trim();if(!o||!r.test(e)||!n)return!1;try{let t=(await o`
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
      where catalog.feature_key = ${n}
        and catalog.is_active = true
      limit 1
    `)[0];if(!t)return!1;let r=new Date,s=(0,a.isWorkspacePlanFeatureIncluded)({planKey:t.plan_key,planStatus:t.plan_status,planPeriodEnd:t.plan_period_end,minimumPlan:t.minimum_plan,now:r}),d=t.trial_ends_at?new Date(String(t.trial_ends_at)):null,c="active"===String(t.trial_status??"")&&!!d&&!Number.isNaN(d.getTime())&&d.getTime()>r.getTime(),l=null===t.admin_override_enabled||void 0===t.admin_override_enabled?null:!!t.admin_override_enabled;return(0,i.resolveWorkspaceFeatureAccess)({includedInPlan:s,trialActive:c,workspaceEnabled:!!t.workspace_enabled,adminOverrideEnabled:l}).hasAccess}catch(e){return console.error("Failed to resolve workspace feature access",e),!1}}e.s(["hasWorkspaceFeatureAccessForWorkspace",0,s])},356335,e=>e.a(async(t,i)=>{try{var a=e.i(141097),r=t([a]);[a]=r.then?(await r)():r;let n={booking_demo:"online_booking",crm_customers:"customer_crm",lead_inbox:"lead_management",ai_assistant:"ai_chatbot",chat_widget:"ai_chatbot"},d=new Set(["online_booking","customer_crm","lead_management","ai_chatbot","booking_reminders","verified_reviews","media_gallery","quote_management","website_builder","customer_portal","sms","custom_domain","video_upload","multiple_staff","advanced_automation","payments","analytics"]);async function s(){let e=await (0,a.getWorkspaceEntitlements)();return new Set(e.filter(e=>e.hasAccess&&d.has(e.featureKey)).map(e=>e.featureKey))}async function o(e){return(await s()).has(e in n?n[e]:e)}e.s(["hasDashboardFeatureAccess",0,o]),i()}catch(e){i(e)}},!1),599170,e=>{"use strict";var t=e.i(469719);let i=t.z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/),a=t.z.object({reviewerName:t.z.string().trim().min(2).max(80),rating:t.z.coerce.number().int().min(1).max(5),message:t.z.string().trim().min(10).max(1e3),consent:t.z.literal(!0),website:t.z.string().max(0),formStartedAt:t.z.coerce.number().int().positive()});e.s(["verifiedReviewSubmissionSchema",0,a,"verifiedReviewTokenSchema",0,i])},513403,e=>{"use strict";var t=e.i(666680);e.s(["createVerifiedReviewToken",0,function(){return(0,t.randomBytes)(32).toString("base64url")},"hashVerifiedReviewToken",0,function(e){return(0,t.createHash)("sha256").update(e,"utf8").digest("hex")}])},81066,e=>{"use strict";async function t(e){let{sql:t,actorUserId:i,workspaceId:a,bookingId:r,tokenHash:s,expiresAt:o}=e;return t`
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
        ${o}::timestamptz,
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
  `}e.s(["persistReviewInvitation",0,t,"persistVerifiedReviewSubmission",0,i])},378086,e=>e.a(async(t,i)=>{try{var a=e.i(276269),r=e.i(599170),s=e.i(695478),o=e.i(872132),n=e.i(356335),d=e.i(513403),c=e.i(81066),l=t([s,n]);[s,n]=l.then?(await l)():l;let f=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,b={companyName:"Service provider",timeZone:"Europe/Stockholm",language:"sv",primaryColor:"#173e2b",accentColor:"#d8ae52",logoUrl:null,homeUrl:null};function u(e,t=""){return null==e?t:String(e)}function _(e){return u(e).trim()||null}function m(e){return!0===e||"true"===e}function p(e,t){let i=u(e).trim();return/^#[0-9a-f]{6}$/i.test(i)?i:t}async function k(){let e=await (0,s.getUserWorkspaceAccess)();return e.ok&&(0,s.canManageWorkspaceSettings)(e)&&await (0,n.hasDashboardFeatureAccess)("verified_reviews")?e:null}async function v(){let[e,t]=await Promise.all([k(),Promise.resolve((0,a.getSql)())]);if(!e||!t)return null;try{var i;let a=await t`
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
    `;return a[0]?(i=a[0],{companyName:u(i.company_name,b.companyName),timeZone:function(e){let t=u(e).trim();if(!t)return b.timeZone;try{return new Intl.DateTimeFormat("en",{timeZone:t}).format(new Date),t}catch{return b.timeZone}}(i.time_zone),language:"en"===u(i.default_language)?"en":"sv",primaryColor:p(i.primary_color,b.primaryColor),accentColor:p(i.accent_color,b.accentColor),logoUrl:function(e){let t=u(e).trim();if(!t)return null;if(t.startsWith("/")&&!t.startsWith("//"))return t;try{let e=new URL(t);return"https:"===e.protocol?e.toString():null}catch{return null}}(i.logo_url),homeUrl:"active"===u(i.custom_domain_status)?function(e){let t=u(e).trim();if(!t)return null;try{let e=new URL(t.includes("://")?t:`https://${t}`);return"https:"===e.protocol?e.origin:null}catch{return null}}(i.custom_domain):null}):{...b,companyName:e.workspaceName}}catch(t){return console.error("Failed to read verified review workspace context",t),{...b,companyName:e.workspaceName}}}async function w(e){let[t,i]=await Promise.all([k(),Promise.resolve((0,a.getSql)())]);if(!t)return{ok:!1,code:"access"};if(!i||!f.test(e))return{ok:!1,code:"invalid_booking"};let r=(0,d.createVerifiedReviewToken)(),s=(0,d.hashVerifiedReviewToken)(r),o=new Date(Date.now()+2592e6).toISOString();try{let a=(await (0,c.persistReviewInvitation)({sql:i,actorUserId:t.userId,workspaceId:t.workspaceId,bookingId:e,tokenHash:s,expiresAt:o}))[0];if(!m(a?.target_exists))return{ok:!1,code:"invalid_booking"};if("used"===u(a?.existing_status)&&!a?.invitation_id)return{ok:!1,code:"already_used"};if(!u(a?.invitation_id))return{ok:!1,code:"database"};return{ok:!0,token:r,bookingId:u(a?.booking_id,e),bookingTitle:u(a?.booking_title,"Completed booking"),customerName:_(a?.customer_name),customerEmail:_(a?.customer_email),expiresAt:u(a?.expires_at,o)}}catch(e){return console.error("Failed to issue verified review invitation",e),{ok:!1,code:"database"}}}async function g(e,t){let i=r.verifiedReviewTokenSchema.safeParse(e),s=(0,a.getSql)();if(!i.success||!s)return{ok:!1,code:"invalid"};let n=(0,d.hashVerifiedReviewToken)(i.data);try{let e=await s`
      select workspace_id
      from website_review_invitations
      where token_hash = ${n}
      limit 1
    `,i=u(e[0]?.workspace_id);if(!i)return{ok:!1,code:"invalid"};let a=await (0,o.hasWorkspaceFeatureAccessForWorkspace)(i,"verified_reviews");if(!a)return{ok:!1,code:"unavailable"};let r=(await (0,c.persistVerifiedReviewSubmission)({sql:s,tokenHash:n,review:t,featureEnabled:a}))[0],d=u(r?.review_id);if(d&&m(r?.submitted))return{ok:!0,reviewId:d};let l=u(r?.invitation_status);if(!l)return{ok:!1,code:"invalid"};if("used"===l||m(r?.review_exists))return{ok:!1,code:"used"};if("revoked"===l)return{ok:!1,code:"revoked"};if(new Date(u(r?.expires_at)).getTime()<=Date.now())return{ok:!1,code:"expired"};if("active"!==u(r?.workspace_status)&&"trial"!==u(r?.workspace_status)||!m(r?.feature_enabled)||"completed"!==u(r?.booking_status))return{ok:!1,code:"unavailable"};return{ok:!1,code:"database"}}catch(e){return console.error("Failed to submit verified review",e),{ok:!1,code:"database"}}}e.s(["getReviewInvitationDashboardContext",0,v,"issueReviewInvitation",0,w,"submitVerifiedReview",0,g]),i()}catch(e){i(e)}},!1),563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},580632,e=>{e.v(e=>Promise.resolve().then(()=>e(270406)))},180221,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0_ap2t8._.js"].map(t=>e.l(t))).then(()=>t(51441)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_019mxp5._.js"].map(t=>e.l(t))).then(()=>t(689127)))},605794,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_0t9-lld._.js"].map(t=>e.l(t))).then(()=>t(269728)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__06we49a._.js.map