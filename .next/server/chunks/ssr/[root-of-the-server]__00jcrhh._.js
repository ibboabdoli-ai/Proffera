module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},295946,a=>{"use strict";var b=a.i(546767);let c=(0,a.i(612147).resolveDatabaseUrl)();a.s(["getSql",0,function(){return c?(0,b.neon)(c):null}])},666680,(a,b,c)=>{b.exports=a.x("node:crypto",()=>require("node:crypto"))},902157,(a,b,c)=>{b.exports=a.x("node:fs",()=>require("node:fs"))},912714,(a,b,c)=>{b.exports=a.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(a,b,c)=>{b.exports=a.x("node:os",()=>require("node:os"))},750227,(a,b,c)=>{b.exports=a.x("node:path",()=>require("node:path"))},723862,a=>a.a(async(b,c)=>{try{let b=await a.y("pg-587764f78a6c7a9c");a.n(b),c()}catch(a){c(a)}},!0),532539,a=>{"use strict";let b=["BETTER_AUTH_SECRET","AUTH_SECRET"];function c(a=process.env){if("preview"===a.VERCEL_ENV)return a.PROFFERA_PREVIEW_AUTH_SECRET?.trim()||null;for(let c of b){let b=a[c]?.trim();if(b)return b}return null}a.s(["resolveAuthSecret",0,c,"resolveCustomerPortalSecret",0,function(a=process.env){return"preview"===a.VERCEL_ENV?c(a):a.CUSTOMER_PORTAL_SECRET?.trim()||c(a)}])},465112,a=>{"use strict";a.s(["DialectAdapterBase",0,class{get supportsCreateIfNotExists(){return!0}get supportsMultipleConnections(){return!0}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!1}get supportsOutput(){return!1}}])},898663,a=>{"use strict";var b=a.i(89287);let c=/"/g,d=/[\\'"]/g;class e extends b.DefaultQueryCompiler{visitOrAction(a){this.append("or "),this.append(a.action)}getCurrentParameterPlaceholder(){return"?"}getLeftExplainOptionsWrapper(){return""}getRightExplainOptionsWrapper(){return""}getLeftIdentifierWrapper(){return'"'}getRightIdentifierWrapper(){return'"'}getAutoIncrement(){return"autoincrement"}sanitizeIdentifier(a){return a.replace(c,'""')}sanitizeJSONPathMemberValue(a){return a.replace(d,a=>"\\"===a?"\\\\":"'"===a?"''":'\\"')}visitDefaultInsertValue(a){this.append("null")}}a.s(["SqliteQueryCompiler",0,e])},683190,a=>{"use strict";var b=a.i(465112);class c extends b.DialectAdapterBase{get supportsMultipleConnections(){return!1}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!0}async acquireMigrationLock(a,b){}async releaseMigrationLock(a,b){}}a.s(["SqliteAdapter",0,c])},178227,a=>a.a(async(b,c)=>{try{var d=a.i(905246),e=a.i(109307),f=b([e]);async function g(){return(0,e.getAuth)().api.getSession({headers:await (0,d.headers)()})}[e]=f.then?(await f)():f,a.s(["getServerSession",0,g]),c()}catch(a){c(a)}},!1),676746,a=>{"use strict";a.s(["selectWorkspaceMembership",0,function(a,b){return a.find(a=>a.workspaceId===b)??a[0]??null}])},437519,a=>{"use strict";let b=["owner","admin","staff","viewer"];a.s(["canRoleManageWorkspaceMembers",0,function(a){return"owner"===a},"canRoleManageWorkspaceSettings",0,function(a){return"owner"===a||"admin"===a},"isWorkspaceRole",0,function(a){return"string"==typeof a&&b.includes(a)}])},87921,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(905246),f=a.i(178227),g=a.i(612147),h=a.i(676746),i=a.i(437519),j=b([f]);[f]=j.then?(await j)():j;let o=["active","trial"],p="proffera_workspace_id",q=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function k(){let a=(0,g.resolveDatabaseUrl)();return a?(0,d.neon)(a):null}function l(a,b=""){return null==a?b:String(a)}async function m(){let a=await (0,f.getServerSession)();if(!a)return{ok:!1,reason:"no_session"};let b=a.user?.id;if(!b)return{ok:!1,reason:"no_user"};let c=k();if(!c)return{ok:!1,reason:"workspace_not_allowed"};try{let a=await (0,e.cookies)(),d=a.get(p)?.value??"",f=q.test(d)?d:"";if(!(await c`
      select id
      from "user"
      where id = ${b}
      limit 1
    `)[0])return{ok:!1,reason:"no_user"};let g=await c`
      select
        wm.workspace_id,
        wm.role,
        w.slug as workspace_slug,
        w.name as workspace_name,
        w.status as workspace_status
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${b}
        and w.status in ('active', 'trial')
      order by wm.created_at asc
    `;if(!g[0])return{ok:!1,reason:"no_membership"};let j=g.flatMap(a=>{let b=a.role,c=a.workspace_status,d=l(a.workspace_id),e=l(a.workspace_slug),f=l(a.workspace_name);return(0,i.isWorkspaceRole)(b)&&"string"==typeof c&&o.includes(c)&&d&&e&&f?[{workspaceId:d,workspaceSlug:e,workspaceName:f,workspaceStatus:c,role:b}]:[]}),k=(0,h.selectWorkspaceMembership)(j,f);if(!k)return{ok:!1,reason:"workspace_not_allowed"};return{ok:!0,userId:b,...k}}catch(a){return console.error("Failed to read workspace access",a),{ok:!1,reason:"workspace_not_allowed"}}}async function n(){let a=await (0,f.getServerSession)(),b=a?.user?.id,c=k();if(!b||!c)return[];try{return(await c`
      select w.id, w.name, w.slug, wm.role
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${b}
        and w.status in ('active', 'trial')
      order by w.name asc, wm.created_at asc
    `).flatMap(a=>{let b=l(a.id),c=l(a.name),d=l(a.slug),e=a.role;return b&&c&&d&&(0,i.isWorkspaceRole)(e)?[{id:b,name:c,slug:d,role:e}]:[]})}catch(a){return console.error("Failed to read workspace options",a),[]}}a.s(["canManageWorkspaceMembers",0,function(a){return a.ok&&(0,i.canRoleManageWorkspaceMembers)(a.role)},"canManageWorkspaceSettings",0,function(a){return a.ok&&(0,i.canRoleManageWorkspaceSettings)(a.role)},"getUserWorkspaceAccess",0,m,"getUserWorkspaceOptions",0,n,"selectedWorkspaceCookieName",0,p]),c()}catch(a){c(a)}},!1),785978,a=>{"use strict";let b=(0,a.i(892277).default)("shield-check",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["ShieldCheck",0,b],785978)},104857,a=>{"use strict";let b=(0,a.i(892277).default)("calendar-check-2",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8",key:"bce9hv"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m16 20 2 2 4-4",key:"13tcca"}]]);a.s(["CalendarCheck2",0,b],104857)},881005,a=>{"use strict";let b=(0,a.i(892277).default)("map-pin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);a.s(["MapPin",0,b],881005)},29581,a=>{"use strict";let b=(0,a.i(892277).default)("phone",[["path",{d:"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",key:"9njp5v"}]]);a.s(["Phone",0,b],29581)},903062,a=>{"use strict";let b=(0,a.i(892277).default)("mail",[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]]);a.s(["Mail",0,b],903062)},671213,a=>{"use strict";let b=(0,a.i(892277).default)("sparkles",[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]]);a.s(["Sparkles",0,b],671213)},208106,a=>{"use strict";let b=(0,a.i(892277).default)("badge-check",[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["BadgeCheck",0,b],208106)},723351,a=>{"use strict";let b=(0,a.i(892277).default)("arrow-right",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);a.s(["ArrowRight",0,b],723351)},833532,a=>{"use strict";let b=(0,a.i(892277).default)("star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);a.s(["Star",0,b],833532)},334076,a=>{"use strict";var b=a.i(53112);let c=a=>b.z.string().trim().max(a).optional().transform(a=>a||null);b.z.object({reviewerName:b.z.string().trim().min(2).max(80),rating:b.z.coerce.number().int().min(1).max(5),service:c(120),area:c(120),message:b.z.string().trim().min(10).max(1e3),consent:b.z.literal(!0),website:b.z.string().max(0),formStartedAt:b.z.coerce.number().int().positive()}),a.s(["primeViewWorkspaceSlug",0,"primeview-window-care"])},880804,a=>{"use strict";let b=(0,a.i(892277).default)("house",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]]);a.s(["House",0,b],880804)},93092,a=>{"use strict";let b=(0,a.i(892277).default)("wrench",[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",key:"1ngwbx"}]]);a.s(["Wrench",0,b],93092)},97096,a=>{"use strict";var b=a.i(53112);let c=["pending","approved","rejected"],d=b.z.string().trim().max(120).transform(a=>a||null),e=b.z.object({reviewerName:b.z.string().trim().min(2).max(80),rating:b.z.coerce.number().int().min(1).max(5),service:d,area:d,message:b.z.string().trim().min(10).max(1e3)}),f=b.z.object({ownerReply:b.z.string().trim().max(1e3).transform(a=>a||null),isFeatured:b.z.boolean()});async function g(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e,nextStatus:f}=a;return b`
    with previous as (
      select id, workspace_id, status
      from website_reviews
      where id = ${e}::uuid
        and workspace_id = ${d}::uuid
      for update
    ),
    updated as (
      update website_reviews r
      set
        status = ${f},
        moderated_at = now(),
        moderated_by_user_id = ${c},
        published_at = case when ${f} = 'approved' then coalesce(r.published_at, now()) else null end,
        is_featured = case when ${f} = 'approved' then r.is_featured else false end,
        updated_at = now()
      from previous p
      where r.id = p.id
        and p.status <> ${f}
      returning
        r.id,
        r.workspace_id,
        p.status as previous_status,
        r.status as next_status
    )
    insert into admin_audit_logs (
      admin_user_id, workspace_id, action, reason, previous_value, new_value
    )
    select
      ${c},
      updated.workspace_id,
      'website_review.status_updated',
      'Website review moderation changed from workspace dashboard',
      jsonb_build_object(
        'review_id', updated.id,
        'status', updated.previous_status
      ),
      jsonb_build_object(
        'review_id', updated.id,
        'status', updated.next_status
      )
    from updated
    returning id
  `}async function h(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e,review:f}=a;return b`
    with previous as (
      select id, workspace_id, reviewer_name, rating, service, area, message
      from website_reviews
      where id = ${e}::uuid
        and workspace_id = ${d}::uuid
      for update
    ),
    changed as (
      select
        previous.*,
        array_remove(array[
          case when previous.reviewer_name is distinct from ${f.reviewerName} then 'reviewer_name' end,
          case when previous.rating is distinct from ${f.rating} then 'rating' end,
          case when previous.service is distinct from ${f.service} then 'service' end,
          case when previous.area is distinct from ${f.area} then 'area' end,
          case when previous.message is distinct from ${f.message} then 'message' end
        ], null)::text[] as changed_fields
      from previous
      where (previous.reviewer_name, previous.rating, previous.service, previous.area, previous.message)
        is distinct from (${f.reviewerName}, ${f.rating}, ${f.service}, ${f.area}, ${f.message})
    ),
    updated as (
      update website_reviews review_row
      set
        reviewer_name = ${f.reviewerName},
        rating = ${f.rating},
        service = ${f.service},
        area = ${f.area},
        message = ${f.message},
        updated_at = now()
      from changed
      where review_row.id = changed.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${c},
        updated.workspace_id,
        'website_review.content_updated',
        'Website review content edited from workspace dashboard',
        jsonb_build_object('review_id', updated.id),
        jsonb_build_object(
          'review_id', updated.id,
          'changed_fields', to_jsonb(changed.changed_fields)
        )
      from updated
      join changed on changed.id = updated.id
      returning id
    )
    select previous.id
    from previous
    where not exists (select 1 from changed)
    union all
    select updated.id
    from updated
    where exists (select 1 from audited)
    limit 1
  `}async function i(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e,presentation:f}=a;return b`
    with previous as (
      select
        id,
        workspace_id,
        owner_reply,
        owner_replied_at,
        is_featured,
        status,
        is_verified
      from website_reviews
      where id = ${e}::uuid
        and workspace_id = ${d}::uuid
      for update
    ),
    eligible as (
      select *
      from previous
      where status = 'approved'
        and is_verified = true
    ),
    changed as (
      select
        eligible.*,
        array_remove(array[
          case when eligible.owner_reply is distinct from ${f.ownerReply} then 'owner_reply' end,
          case when eligible.is_featured is distinct from ${f.isFeatured} then 'is_featured' end
        ], null)::text[] as changed_fields
      from eligible
      where (eligible.owner_reply, eligible.is_featured)
        is distinct from (${f.ownerReply}, ${f.isFeatured})
    ),
    updated as (
      update website_reviews review_row
      set
        owner_reply = ${f.ownerReply},
        owner_replied_at = case
          when changed.owner_reply is distinct from ${f.ownerReply}
            then case when ${f.ownerReply}::text is null then null else now() end
          else changed.owner_replied_at
        end,
        is_featured = ${f.isFeatured},
        updated_at = now()
      from changed
      where review_row.id = changed.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${c},
        updated.workspace_id,
        'website_review.presentation_updated',
        'Website review owner reply or featured state changed from workspace dashboard',
        jsonb_build_object(
          'review_id', updated.id,
          'owner_reply_present', changed.owner_reply is not null,
          'is_featured', changed.is_featured
        ),
        jsonb_build_object(
          'review_id', updated.id,
          'owner_reply_present', ${f.ownerReply}::text is not null,
          'is_featured', ${f.isFeatured},
          'changed_fields', to_jsonb(changed.changed_fields)
        )
      from updated
      join changed on changed.id = updated.id
      returning id
    )
    select eligible.id
    from eligible
    where not exists (select 1 from changed)
    union all
    select updated.id
    from updated
    where exists (select 1 from audited)
    limit 1
  `}async function j(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e}=a;return b`
    with previous as (
      select id, workspace_id, status, is_verified
      from website_reviews
      where id = ${e}::uuid
        and workspace_id = ${d}::uuid
      for update
    ),
    deleted as (
      delete from website_reviews review_row
      using previous
      where review_row.id = previous.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${c},
        deleted.workspace_id,
        'website_review.deleted',
        'Website review permanently deleted from workspace dashboard',
        jsonb_build_object(
          'review_id', deleted.id,
          'status', previous.status,
          'is_verified', previous.is_verified
        ),
        jsonb_build_object(
          'review_id', deleted.id,
          'deleted', true
        )
      from deleted
      join previous on previous.id = deleted.id
      returning id
    )
    select deleted.id
    from deleted
    where exists (select 1 from audited)
  `}a.s(["isWebsiteReviewStatus",0,function(a){return"string"==typeof a&&c.includes(a)},"persistWebsiteReviewDeletion",0,j,"persistWebsiteReviewEdit",0,h,"persistWebsiteReviewModeration",0,g,"persistWebsiteReviewPresentation",0,i,"websiteReviewEditSchema",0,e,"websiteReviewPresentationSchema",0,f])},115873,a=>a.a(async(b,c)=>{try{var d=a.i(295946),e=a.i(97096),f=a.i(87921),g=b([f]);[f]=g.then?(await g)():g;let s=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function h(a,b=""){return null==a?b:String(a)}function i(a){return h(a).trim()||null}function j(a){return!0===a||"true"===a}function k(a){var b;let c,d=h(a.id),e=h(a.reviewer_name),f=(b=a.rating,c=Number(b),Number.isInteger(c)&&c>=1&&c<=5?c:0),g=h(a.message),k=h(a.published_at);return d&&e&&f&&g&&k?{id:d,reviewerName:e,rating:f,service:i(a.service),area:i(a.area),message:g,publishedAt:k,isVerified:j(a.is_verified),ownerReply:i(a.owner_reply),ownerRepliedAt:i(a.owner_replied_at),isFeatured:j(a.is_featured)}:null}async function l(a){let b=(0,d.getSql)();if(!b||!a)return[];try{return(await b`
      select
        review.id,
        review.reviewer_name,
        review.rating,
        review.service,
        review.area,
        review.message,
        review.published_at,
        review.is_verified,
        review.owner_reply,
        review.owner_replied_at,
        review.is_featured
      from website_reviews review
      join workspaces workspace on workspace.id = review.workspace_id
      where workspace.slug = ${a}
        and workspace.status in ('active', 'trial')
        and review.status = 'approved'
        and review.is_verified = true
      order by review.is_featured desc, review.published_at desc nulls last, review.created_at desc
      limit 6
    `).flatMap(a=>{let b=k(a);return b?[b]:[]})}catch(a){return console.error("Failed to read published website reviews",a),[]}}async function m(a){let b=(0,d.getSql)();if(!b||!a)return{count:0,averageRating:null};try{let c=await b`
      select
        count(*)::int as review_count,
        avg(review.rating)::numeric(10,2) as average_rating
      from website_reviews review
      join workspaces workspace on workspace.id = review.workspace_id
      where workspace.slug = ${a}
        and workspace.status in ('active', 'trial')
        and review.status = 'approved'
        and review.is_verified = true
    `,d=Number(c[0]?.review_count??0),e=c[0]?.average_rating===null||c[0]?.average_rating===void 0?null:Number(c[0].average_rating);return{count:Number.isFinite(d)?d:0,averageRating:null!==e&&Number.isFinite(e)?e:null}}catch(a){return console.error("Failed to read published website review summary",a),{count:0,averageRating:null}}}async function n(){let[a,b]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!a.ok||!(0,f.canManageWorkspaceSettings)(a)||!b)return[];try{return(await b`
      select
        id,
        reviewer_name,
        rating,
        service,
        area,
        message,
        status,
        created_at,
        published_at,
        is_verified,
        owner_reply,
        owner_replied_at,
        is_featured
      from website_reviews
      where workspace_id = ${a.workspaceId}::uuid
      order by
        case status when 'pending' then 0 when 'approved' then 1 else 2 end,
        is_featured desc,
        created_at desc
      limit 100
    `).flatMap(a=>{let b=k({...a,published_at:a.published_at??a.created_at}),c=a.status;return b&&(0,e.isWebsiteReviewStatus)(c)?[{...b,status:c,createdAt:h(a.created_at)}]:[]})}catch(a){return console.error("Failed to read dashboard website reviews",a),[]}}async function o(a,b){let[c,g]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.ok||!(0,f.canManageWorkspaceSettings)(c)||!g||!s.test(a)||!(0,e.isWebsiteReviewStatus)(b))return!1;try{let d=await (0,e.persistWebsiteReviewModeration)({sql:g,actorUserId:c.userId,workspaceId:c.workspaceId,reviewId:a,nextStatus:b});return!!d[0]?.id}catch(a){return console.error("Failed to moderate website review",a),!1}}async function p(a,b){let c=e.websiteReviewEditSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewEdit)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,review:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to edit website review",a),!1}}async function q(a,b){let c=e.websiteReviewPresentationSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewPresentation)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,presentation:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to update website review presentation",a),!1}}async function r(a){let[b,c]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!b.ok||!(0,f.canManageWorkspaceSettings)(b)||!c||!s.test(a))return!1;try{let d=await (0,e.persistWebsiteReviewDeletion)({sql:c,actorUserId:b.userId,workspaceId:b.workspaceId,reviewId:a});return!!d[0]?.id}catch(a){return console.error("Failed to delete website review",a),!1}}a.s(["deleteDashboardWebsiteReview",0,r,"getDashboardWebsiteReviews",0,n,"getPublishedWebsiteReviewSummary",0,m,"getPublishedWebsiteReviews",0,l,"updateDashboardWebsiteReview",0,p,"updateDashboardWebsiteReviewPresentation",0,q,"updateDashboardWebsiteReviewStatus",0,o]),c()}catch(a){c(a)}},!1),130315,a=>{"use strict";let b=(0,a.i(892277).default)("message-square-reply",[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"m10 8-3 3 3 3",key:"fp6dz7"}],["path",{d:"M17 14v-1a2 2 0 0 0-2-2H7",key:"1tkjnz"}]]);a.s(["MessageSquareReply",0,b],130315)},371029,(a,b,c)=>{"use strict";c._=function(a){return a&&a.__esModule?a:{default:a}}},116426,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"warnOnce",{enumerable:!0,get:function(){return d}});let d=a=>{}},229945,(a,b,c)=>{"use strict";let d;Object.defineProperty(c,"__esModule",{value:!0});var e={getAssetToken:function(){return i},getAssetTokenQuery:function(){return j},getDeploymentId:function(){return g},getDeploymentIdQuery:function(){return h}};for(var f in e)Object.defineProperty(c,f,{enumerable:!0,get:e[f]});function g(){return d}function h(a=!1){return d?`${a?"&":"?"}dpl=${d}`:""}function i(){return!1}function j(a=!1){return""}d=void 0},301359,(a,b,c)=>{"use strict";function d({widthInt:a,heightInt:b,blurWidth:c,blurHeight:e,blurDataURL:f,objectFit:g}){let h=c?40*c:a,i=e?40*e:b,j=h&&i?`viewBox='0 0 ${h} ${i}'`:"";return`%3Csvg xmlns='http://www.w3.org/2000/svg' ${j}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${j?"none":"contain"===g?"xMidYMid":"cover"===g?"xMidYMid slice":"none"}' style='filter: url(%23b);' href='${f}'/%3E%3C/svg%3E`}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"getImageBlurSvg",{enumerable:!0,get:function(){return d}})},853549,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={VALID_LOADERS:function(){return f},imageConfigDefault:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=["default","imgix","cloudinary","akamai","custom"],g={deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],path:"/_next/image",loader:"default",loaderFile:"",domains:[],disableStaticImages:!1,minimumCacheTTL:14400,formats:["image/webp"],maximumDiskCacheSize:void 0,maximumRedirects:3,maximumResponseBody:5e7,dangerouslyAllowLocalIP:!1,dangerouslyAllowSVG:!1,contentSecurityPolicy:"script-src 'none'; frame-src 'none'; sandbox;",contentDispositionType:"attachment",localPatterns:void 0,remotePatterns:[],qualities:[75],unoptimized:!1,customCacheHandler:!1}},487713,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"getImgProps",{enumerable:!0,get:function(){return j}}),a.r(116426);let d=a.r(229945),e=a.r(301359),f=a.r(853549),g=["-moz-initial","fill","none","scale-down",void 0];function h(a){return void 0!==a.default}function i(a){return void 0===a?a:"number"==typeof a?Number.isFinite(a)?a:NaN:"string"==typeof a&&/^[0-9]+$/.test(a)?parseInt(a,10):NaN}function j({src:a,sizes:b,unoptimized:c=!1,priority:k=!1,preload:l=!1,loading:m,className:n,quality:o,width:p,height:q,fill:r=!1,style:s,overrideSrc:t,onLoad:u,onLoadingComplete:v,placeholder:w="empty",blurDataURL:x,fetchPriority:y,decoding:z="async",layout:A,objectFit:B,objectPosition:C,lazyBoundary:D,lazyRoot:E,...F},G){var H;let I,J,K,{imgConf:L,showAltText:M,blurComplete:N,defaultLoader:O}=G,P=L||f.imageConfigDefault;if("allSizes"in P)I=P;else{let a=[...P.deviceSizes,...P.imageSizes].sort((a,b)=>a-b),b=P.deviceSizes.sort((a,b)=>a-b),c=P.qualities?.sort((a,b)=>a-b);I={...P,allSizes:a,deviceSizes:b,qualities:c}}if(void 0===O)throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"),"__NEXT_ERROR_CODE",{value:"E163",enumerable:!1,configurable:!0});let Q=F.loader||O;delete F.loader,delete F.srcSet;let R="__next_img_default"in Q;if(R){if("custom"===I.loader)throw Object.defineProperty(Error(`Image with src "${a}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`),"__NEXT_ERROR_CODE",{value:"E252",enumerable:!1,configurable:!0})}else{let a=Q;Q=b=>{let{config:c,...d}=b;return a(d)}}if(A){"fill"===A&&(r=!0);let a={intrinsic:{maxWidth:"100%",height:"auto"},responsive:{width:"100%",height:"auto"}}[A];a&&(s={...s,...a});let c={responsive:"100vw",fill:"100vw"}[A];c&&!b&&(b=c)}let S="",T=i(p),U=i(q);if((H=a)&&"object"==typeof H&&(h(H)||void 0!==H.src)){let b=h(a)?a.default:a;if(!b.src)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E460",enumerable:!1,configurable:!0});if(!b.height||!b.width)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E48",enumerable:!1,configurable:!0});if(J=b.blurWidth,K=b.blurHeight,x=x||b.blurDataURL,S=b.src,!r)if(T||U){if(T&&!U){let a=T/b.width;U=Math.round(b.height*a)}else if(!T&&U){let a=U/b.height;T=Math.round(b.width*a)}}else T=b.width,U=b.height}let V=!k&&!l&&("lazy"===m||void 0===m);(!(a="string"==typeof a?a:S)||a.startsWith("data:")||a.startsWith("blob:"))&&(c=!0,V=!1),I.unoptimized&&(c=!0),R&&!I.dangerouslyAllowSVG&&a.split("?",1)[0].endsWith(".svg")&&(c=!0);let W=i(o),X=Object.assign(r?{position:"absolute",height:"100%",width:"100%",left:0,top:0,right:0,bottom:0,objectFit:B,objectPosition:C}:{},M?{}:{color:"transparent"},s),Y=N||"empty"===w?null:"blur"===w?`url("data:image/svg+xml;charset=utf-8,${(0,e.getImageBlurSvg)({widthInt:T,heightInt:U,blurWidth:J,blurHeight:K,blurDataURL:x||"",objectFit:X.objectFit})}")`:`url("${w}")`,Z=g.includes(X.objectFit)?"fill"===X.objectFit?"100% 100%":"cover":X.objectFit,$=Y?{backgroundSize:Z,backgroundPosition:X.objectPosition||"50% 50%",backgroundRepeat:"no-repeat",backgroundImage:Y}:{},_=function({config:a,src:b,unoptimized:c,width:e,quality:f,sizes:g,loader:h}){if(c){if(b.startsWith("/")&&!b.startsWith("//")){let a=(0,d.getDeploymentId)();if(a){let c=b.indexOf("?");if(-1!==c){let d=new URLSearchParams(b.slice(c+1));d.get("dpl")||(d.append("dpl",a),b=b.slice(0,c)+"?"+d.toString())}else b+=`?dpl=${a}`}}return{src:b,srcSet:void 0,sizes:void 0}}let{widths:i,kind:j}=function({deviceSizes:a,allSizes:b},c,d){if(d){let c=/(^|\s)(1?\d?\d)vw/g,e=[];for(let a;a=c.exec(d);)e.push(parseInt(a[2]));if(e.length){let c=.01*Math.min(...e);return{widths:b.filter(b=>b>=a[0]*c),kind:"w"}}return{widths:b,kind:"w"}}return"number"!=typeof c?{widths:a,kind:"w"}:{widths:[...new Set([c,2*c].map(a=>b.find(b=>b>=a)||b[b.length-1]))],kind:"x"}}(a,e,g),k=i.length-1;return{sizes:g||"w"!==j?g:"100vw",srcSet:i.map((c,d)=>`${h({config:a,src:b,quality:f,width:c})} ${"w"===j?c:d+1}${j}`).join(", "),src:h({config:a,src:b,quality:f,width:i[k]})}}({config:I,src:a,unoptimized:c,width:T,quality:W,sizes:b,loader:Q}),aa=V?"lazy":m;return{props:{...F,loading:aa,fetchPriority:y,width:T,height:U,decoding:z,className:n,style:{...X,...$},sizes:_.sizes,srcSet:_.srcSet,src:t||_.src},meta:{unoptimized:c,preload:l||k,placeholder:w,fill:r}}}},442377,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/image-component.js <module evaluation>"))},843489,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(211857);a.n(d("[project]/node_modules/next/dist/client/image-component.js"))},418409,a=>{"use strict";a.i(442377);var b=a.i(843489);a.n(b)},353200,(a,b,c)=>{"use strict";function d(a,b){let c=a||75;return b?.qualities?.length?b.qualities.reduce((a,b)=>Math.abs(b-c)<Math.abs(a-c)?b:a,b.qualities[0]):c}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"findClosestQuality",{enumerable:!0,get:function(){return d}})},37763,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"default",{enumerable:!0,get:function(){return g}});let d=a.r(353200),e=a.r(229945);function f({config:a,src:b,width:c,quality:g}){let h=(0,e.getDeploymentId)();if(b.startsWith("/")&&!b.startsWith("//")){let a=b.indexOf("?");if(-1!==a){let c=new URLSearchParams(b.slice(a+1)),d=c.get("dpl");if(d){h=d,c.delete("dpl");let e=c.toString();b=b.slice(0,a)+(e?"?"+e:"")}}}if(b.startsWith("/")&&b.includes("?")&&a.localPatterns?.length===1&&"**"===a.localPatterns[0].pathname&&""===a.localPatterns[0].search)throw Object.defineProperty(Error(`Image with src "${b}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`),"__NEXT_ERROR_CODE",{value:"E871",enumerable:!1,configurable:!0});let i=(0,d.findClosestQuality)(g,a);return`${a.path}?url=${encodeURIComponent(b)}&w=${c}&q=${i}${b.startsWith("/")&&h?`&dpl=${h}`:""}`}f.__next_img_default=!0;let g=f},250858,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={default:function(){return k},getImageProps:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(371029),g=a.r(487713),h=a.r(418409),i=f._(a.r(37763));function j(a){let{props:b}=(0,g.getImgProps)(a,{defaultLoader:i.default,imgConf:{deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],qualities:[75],path:"/_next/image",loader:"default",dangerouslyAllowSVG:!1,unoptimized:!1}});for(let[a,c]of Object.entries(b))void 0===c&&delete b[a];return{props:b}}let k=h.Image},503236,(a,b,c)=>{b.exports=a.r(250858)},589272,a=>{"use strict";let b=(0,a.i(892277).default)("circle-pound-sterling",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M10 16V9.5a1 1 0 0 1 5 0",key:"1i1are"}],["path",{d:"M8 12h4",key:"qz6y1c"}],["path",{d:"M8 16h7",key:"sbedsn"}]]);a.s(["CirclePoundSterling",0,b],589272)},577062,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_memory-adapter_dist_index_mjs_0ptlb60._.js"].map(b=>a.l(b))).then(()=>b(17616)))},860484,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_01xuj8~._.js"].map(b=>a.l(b))).then(()=>b(536063)))},580632,a=>{a.v(a=>Promise.resolve().then(()=>a(270406)))},564133,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0c3cy-j._.js"].map(b=>a.l(b))).then(()=>b(311618)))},908409,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0gpix3g._.js"].map(b=>a.l(b))).then(()=>b(869959)))},552157,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_07980-r._.js"].map(b=>a.l(b))).then(()=>b(71326)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__00jcrhh._.js.map