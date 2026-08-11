module.exports=[220765,a=>{"use strict";var b=a.i(295946),c=a.i(359920),d=a.i(188506);let e=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function f(a,f){let g=(0,b.getSql)(),h=f.trim();if(!g||!e.test(a)||!h)return!1;try{let b=(await g`
      with latest_plan as (
        select plan_key, status, current_period_end
        from workspace_plans
        where workspace_id = ${a}::uuid
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
        on flag.workspace_id = ${a}::uuid
       and flag.feature_key = catalog.feature_key
      left join workspace_feature_overrides override
        on override.workspace_id = ${a}::uuid
       and override.feature_key = catalog.feature_key
      left join latest_plan plan on true
      left join workspace_feature_trials trial
        on trial.workspace_id = ${a}::uuid
       and trial.feature_key = catalog.feature_key
      where catalog.feature_key = ${h}
        and catalog.is_active = true
      limit 1
    `)[0];if(!b)return!1;let e=new Date,f=(0,d.isWorkspacePlanFeatureIncluded)({planKey:b.plan_key,planStatus:b.plan_status,planPeriodEnd:b.plan_period_end,minimumPlan:b.minimum_plan,now:e}),i=b.trial_ends_at?new Date(String(b.trial_ends_at)):null,j="active"===String(b.trial_status??"")&&!!i&&!Number.isNaN(i.getTime())&&i.getTime()>e.getTime(),k=null===b.admin_override_enabled||void 0===b.admin_override_enabled?null:!!b.admin_override_enabled;return(0,c.resolveWorkspaceFeatureAccess)({includedInPlan:f,trialActive:j,workspaceEnabled:!!b.workspace_enabled,adminOverrideEnabled:k}).hasAccess}catch(a){return console.error("Failed to resolve workspace feature access",a),!1}}a.s(["hasWorkspaceFeatureAccessForWorkspace",0,f])},729276,a=>{"use strict";var b=a.i(53112);let c=b.z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/);b.z.object({reviewerName:b.z.string().trim().min(2).max(80),rating:b.z.coerce.number().int().min(1).max(5),message:b.z.string().trim().min(10).max(1e3),consent:b.z.literal(!0),website:b.z.string().max(0),formStartedAt:b.z.coerce.number().int().positive()}),a.s(["verifiedReviewTokenSchema",0,c])},728154,a=>{"use strict";var b=a.i(666680);a.s(["createVerifiedReviewToken",0,function(){return(0,b.randomBytes)(32).toString("base64url")},"hashVerifiedReviewToken",0,function(a){return(0,b.createHash)("sha256").update(a,"utf8").digest("hex")}])},457198,a=>{"use strict";async function b(a){let{sql:b,actorUserId:c,workspaceId:d,bookingId:e,tokenHash:f,expiresAt:g}=a;return b`
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
       and w.id = ${d}::uuid
       and w.status in ('active', 'trial')
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.id = ${e}::uuid
        and b.workspace_id = ${d}
        and b.status = 'completed'
      limit 1
    ),
    existing as (
      select invitation.status
      from website_review_invitations invitation
      join target on target.booking_id = invitation.booking_id
      where invitation.workspace_id = ${d}::uuid
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
        ${d}::uuid,
        target.booking_id,
        target.customer_id,
        ${f},
        'pending',
        ${g}::timestamptz,
        null,
        null,
        ${c},
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
        ${c},
        ${d}::uuid,
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
  `}a.s(["persistReviewInvitation",0,b])},789852,a=>a.a(async(b,c)=>{try{var d=a.i(295946),e=a.i(729276),f=a.i(87921),g=a.i(220765),h=a.i(906077),i=a.i(728154),j=a.i(457198),k=b([f,h]);[f,h]=k.then?(await k)():k;let v=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,w={companyName:"Service provider",timeZone:"Europe/Stockholm",language:"sv",primaryColor:"#173e2b",accentColor:"#d8ae52",logoUrl:null,homeUrl:null};function l(a,b=""){return null==a?b:String(a)}function m(a){return l(a).trim()||null}function n(a){return!0===a||"true"===a}function o(a,b){let c=l(a).trim();return/^#[0-9a-f]{6}$/i.test(c)?c:b}function p(a){return{companyName:l(a.company_name,w.companyName),timeZone:function(a){let b=l(a).trim();if(!b)return w.timeZone;try{return new Intl.DateTimeFormat("en",{timeZone:b}).format(new Date),b}catch{return w.timeZone}}(a.time_zone),language:"en"===l(a.default_language)?"en":"sv",primaryColor:o(a.primary_color,w.primaryColor),accentColor:o(a.accent_color,w.accentColor),logoUrl:function(a){let b=l(a).trim();if(!b)return null;if(b.startsWith("/")&&!b.startsWith("//"))return b;try{let a=new URL(b);return"https:"===a.protocol?a.toString():null}catch{return null}}(a.logo_url),homeUrl:"active"===l(a.custom_domain_status)?function(a){let b=l(a).trim();if(!b)return null;try{let a=new URL(b.includes("://")?b:`https://${b}`);return"https:"===a.protocol?a.origin:null}catch{return null}}(a.custom_domain):null}}async function q(){let a=await (0,f.getUserWorkspaceAccess)();return a.ok&&(0,f.canManageWorkspaceSettings)(a)&&await (0,h.hasDashboardFeatureAccess)("verified_reviews")?a:null}async function r(){let[a,b]=await Promise.all([q(),Promise.resolve((0,d.getSql)())]);if(!a||!b)return null;try{let c=await b`
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
      where workspace.id = ${a.workspaceId}::uuid
      limit 1
    `;return c[0]?p(c[0]):{...w,companyName:a.workspaceName}}catch(b){return console.error("Failed to read verified review workspace context",b),{...w,companyName:a.workspaceName}}}async function s(){let[a,b]=await Promise.all([q(),Promise.resolve((0,d.getSql)())]);if(!a||!b)return[];try{return(await b`
      select
        booking.id as booking_id,
        booking.title,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        booking.starts_at,
        customer.name as customer_name,
        customer.email as customer_email,
        case
          when invitation.id is null then 'none'
          when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
          else invitation.status
        end as invitation_status,
        invitation.expires_at as invitation_expires_at
      from bookings booking
      left join customers customer
        on customer.id = booking.customer_id
       and customer.workspace_id = booking.workspace_id
      left join website_review_invitations invitation
        on invitation.booking_id = booking.id
       and invitation.workspace_id::text = booking.workspace_id
      where booking.workspace_id = ${a.workspaceId}
        and booking.status = 'completed'
      order by booking.starts_at desc nulls last, booking.created_at desc
      limit 100
    `).flatMap(a=>{let b=l(a.booking_id),c=l(a.invitation_status);return b&&["none","pending","expired","used","revoked"].includes(c)?[{bookingId:b,title:l(a.title,"Completed booking"),service:l(a.service,"Service"),area:m(a.area),startsAt:m(a.starts_at),customerName:m(a.customer_name),customerEmail:m(a.customer_email),invitationStatus:c,invitationExpiresAt:m(a.invitation_expires_at)}]:[]})}catch(a){return console.error("Failed to list review invitation candidates",a),[]}}async function t(a){let[b,c]=await Promise.all([q(),Promise.resolve((0,d.getSql)())]);if(!b)return{ok:!1,code:"access"};if(!c||!v.test(a))return{ok:!1,code:"invalid_booking"};let e=(0,i.createVerifiedReviewToken)(),f=(0,i.hashVerifiedReviewToken)(e),g=new Date(Date.now()+2592e6).toISOString();try{let d=(await (0,j.persistReviewInvitation)({sql:c,actorUserId:b.userId,workspaceId:b.workspaceId,bookingId:a,tokenHash:f,expiresAt:g}))[0];if(!n(d?.target_exists))return{ok:!1,code:"invalid_booking"};if("used"===l(d?.existing_status)&&!d?.invitation_id)return{ok:!1,code:"already_used"};if(!l(d?.invitation_id))return{ok:!1,code:"database"};return{ok:!0,token:e,bookingId:l(d?.booking_id,a),bookingTitle:l(d?.booking_title,"Completed booking"),customerName:m(d?.customer_name),customerEmail:m(d?.customer_email),expiresAt:l(d?.expires_at,g)}}catch(a){return console.error("Failed to issue verified review invitation",a),{ok:!1,code:"database"}}}async function u(a){let b=e.verifiedReviewTokenSchema.safeParse(a),c=(0,d.getSql)();if(!b.success||!c)return{state:"invalid"};let f=(0,i.hashVerifiedReviewToken)(b.data);try{let a=(await c`
      select
        invitation.status,
        invitation.expires_at,
        invitation.workspace_id,
        invitation.booking_id,
        invitation.customer_id,
        workspace.status as workspace_status,
        booking.status as booking_status,
        booking.workspace_id as booking_workspace_id,
        booking.customer_id as booking_customer_id,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        customer.name as customer_name,
        coalesce(nullif(settings.company_name, ''), nullif(workspace.company_name, ''), workspace.name) as company_name,
        settings.time_zone,
        experience.default_language,
        experience.primary_color,
        experience.accent_color,
        experience.logo_url,
        experience.custom_domain,
        experience.custom_domain_status,
        exists (
          select 1
          from website_reviews review
          where review.review_invitation_id = invitation.id
             or (review.booking_id = invitation.booking_id and review.is_verified = true)
        ) as review_exists
      from website_review_invitations invitation
      join workspaces workspace on workspace.id = invitation.workspace_id
      join bookings booking on booking.id = invitation.booking_id
      left join customers customer
        on customer.id = invitation.customer_id
       and customer.workspace_id = booking.workspace_id
      left join workspace_settings settings on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience on experience.workspace_id = workspace.id
      where invitation.token_hash = ${f}
      limit 1
    `)[0];if(!a)return{state:"invalid"};let b=p(a),d=l(a.status);if("used"===d||n(a.review_exists))return{state:"used",...b};if("revoked"===d)return{state:"revoked",...b};if(new Date(l(a.expires_at)).getTime()<=Date.now())return{state:"expired",...b};let e=l(a.workspace_id),h=await (0,g.hasWorkspaceFeatureAccessForWorkspace)(e,"verified_reviews"),i=e===l(a.booking_workspace_id),j=!a.customer_id||l(a.customer_id)===l(a.booking_customer_id);if("pending"!==d||!["active","trial"].includes(l(a.workspace_status))||!h||"completed"!==l(a.booking_status)||!i||!j)return{state:"unavailable",...b};return{state:"valid",...b,customerName:l(a.customer_name,"Customer"),service:l(a.service,"Completed service"),area:m(a.area),bookingId:l(a.booking_id),expiresAt:l(a.expires_at)}}catch(a){return console.error("Failed to read verified review invitation",a),{state:"invalid"}}}a.s(["getReviewInvitationDashboardContext",0,r,"getVerifiedReviewInvitation",0,u,"issueReviewInvitation",0,t,"listReviewInvitationCandidates",0,s]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=src_0uzp~k3._.js.map