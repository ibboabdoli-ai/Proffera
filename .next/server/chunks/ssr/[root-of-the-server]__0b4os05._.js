module.exports=[295946,a=>{"use strict";var b=a.i(546767);let c=(0,a.i(612147).resolveDatabaseUrl)();a.s(["getSql",0,function(){return c?(0,b.neon)(c):null}])},666680,(a,b,c)=>{b.exports=a.x("node:crypto",()=>require("node:crypto"))},902157,(a,b,c)=>{b.exports=a.x("node:fs",()=>require("node:fs"))},912714,(a,b,c)=>{b.exports=a.x("node:fs/promises",()=>require("node:fs/promises"))},660526,(a,b,c)=>{b.exports=a.x("node:os",()=>require("node:os"))},750227,(a,b,c)=>{b.exports=a.x("node:path",()=>require("node:path"))},723862,a=>a.a(async(b,c)=>{try{let b=await a.y("pg-587764f78a6c7a9c");a.n(b),c()}catch(a){c(a)}},!0),532539,a=>{"use strict";let b=["BETTER_AUTH_SECRET","AUTH_SECRET"];function c(a=process.env){if("preview"===a.VERCEL_ENV)return a.PROFFERA_PREVIEW_AUTH_SECRET?.trim()||null;for(let c of b){let b=a[c]?.trim();if(b)return b}return null}a.s(["resolveAuthSecret",0,c,"resolveCustomerPortalSecret",0,function(a=process.env){return"preview"===a.VERCEL_ENV?c(a):a.CUSTOMER_PORTAL_SECRET?.trim()||c(a)}])},465112,a=>{"use strict";a.s(["DialectAdapterBase",0,class{get supportsCreateIfNotExists(){return!0}get supportsMultipleConnections(){return!0}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!1}get supportsOutput(){return!1}}])},898663,a=>{"use strict";var b=a.i(89287);let c=/"/g,d=/[\\'"]/g;class e extends b.DefaultQueryCompiler{visitOrAction(a){this.append("or "),this.append(a.action)}getCurrentParameterPlaceholder(){return"?"}getLeftExplainOptionsWrapper(){return""}getRightExplainOptionsWrapper(){return""}getLeftIdentifierWrapper(){return'"'}getRightIdentifierWrapper(){return'"'}getAutoIncrement(){return"autoincrement"}sanitizeIdentifier(a){return a.replace(c,'""')}sanitizeJSONPathMemberValue(a){return a.replace(d,a=>"\\"===a?"\\\\":"'"===a?"''":'\\"')}visitDefaultInsertValue(a){this.append("null")}}a.s(["SqliteQueryCompiler",0,e])},683190,a=>{"use strict";var b=a.i(465112);class c extends b.DialectAdapterBase{get supportsMultipleConnections(){return!1}get supportsTransactionalDdl(){return!1}get supportsReturning(){return!0}async acquireMigrationLock(a,b){}async releaseMigrationLock(a,b){}}a.s(["SqliteAdapter",0,c])},178227,a=>a.a(async(b,c)=>{try{var d=a.i(905246),e=a.i(109307),f=b([e]);async function g(){return(0,e.getAuth)().api.getSession({headers:await (0,d.headers)()})}[e]=f.then?(await f)():f,a.s(["getServerSession",0,g]),c()}catch(a){c(a)}},!1),676746,a=>{"use strict";a.s(["selectWorkspaceMembership",0,function(a,b){return a.find(a=>a.workspaceId===b)??a[0]??null}])},437519,a=>{"use strict";let b=["owner","admin","staff","viewer"];a.s(["canRoleManageWorkspaceMembers",0,function(a){return"owner"===a},"canRoleManageWorkspaceSettings",0,function(a){return"owner"===a||"admin"===a},"isWorkspaceRole",0,function(a){return"string"==typeof a&&b.includes(a)}])},87921,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(905246),f=a.i(178227),g=a.i(612147),h=a.i(676746),i=a.i(437519),j=b([f]);[f]=j.then?(await j)():j;let o=["active","trial"],p="proffera_workspace_id",q=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function k(){let a=(0,g.resolveDatabaseUrl)();return a?(0,d.neon)(a):null}function l(a,b=""){return null==a?b:String(a)}async function m(){let a=await (0,f.getServerSession)();if(!a)return{ok:!1,reason:"no_session"};let b=a.user?.id;if(!b)return{ok:!1,reason:"no_user"};let c=k();if(!c)return{ok:!1,reason:"workspace_not_allowed"};try{let a=await (0,e.cookies)(),d=a.get(p)?.value??"",f=q.test(d)?d:"";if(!(await c`
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
    `).flatMap(a=>{let b=l(a.id),c=l(a.name),d=l(a.slug),e=a.role;return b&&c&&d&&(0,i.isWorkspaceRole)(e)?[{id:b,name:c,slug:d,role:e}]:[]})}catch(a){return console.error("Failed to read workspace options",a),[]}}a.s(["canManageWorkspaceMembers",0,function(a){return a.ok&&(0,i.canRoleManageWorkspaceMembers)(a.role)},"canManageWorkspaceSettings",0,function(a){return a.ok&&(0,i.canRoleManageWorkspaceSettings)(a.role)},"getUserWorkspaceAccess",0,m,"getUserWorkspaceOptions",0,n,"selectedWorkspaceCookieName",0,p]),c()}catch(a){c(a)}},!1),359920,a=>{"use strict";a.s(["resolveWorkspaceFeatureAccess",0,function(a){return!0===a.adminOverrideEnabled?{hasAccess:!0,accessState:"included"}:!1===a.adminOverrideEnabled||!a.workspaceEnabled&&(a.includedInPlan||a.trialActive)?{hasAccess:!1,accessState:"disabled"}:a.includedInPlan&&a.workspaceEnabled?{hasAccess:!0,accessState:"included"}:a.trialActive&&a.workspaceEnabled?{hasAccess:!0,accessState:"trial"}:{hasAccess:!1,accessState:"locked"}}])},188506,a=>{"use strict";let b={starter:1,professional:2,business:3};function c(a){return"starter"===a||"professional"===a||"business"===a?a:null}a.s(["isWorkspacePlanFeatureIncluded",0,function(a){let d=c(a.planKey),e=c(a.minimumPlan)??"starter",f=String(a.planStatus??"");if("trialing"===f){if(!a.planPeriodEnd)return!1;let b=new Date(String(a.planPeriodEnd));return!Number.isNaN(b.getTime())&&b.getTime()>(a.now??new Date).getTime()}return!!(d&&"active"===f&&b[d]>=b[e])},"normalizeWorkspacePlan",0,c])},220765,a=>{"use strict";var b=a.i(295946),c=a.i(359920),d=a.i(188506);let e=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function f(a,f){let g=(0,b.getSql)(),h=f.trim();if(!g||!e.test(a)||!h)return!1;try{let b=(await g`
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
    `)[0];if(!b)return!1;let e=new Date,f=(0,d.isWorkspacePlanFeatureIncluded)({planKey:b.plan_key,planStatus:b.plan_status,planPeriodEnd:b.plan_period_end,minimumPlan:b.minimum_plan,now:e}),i=b.trial_ends_at?new Date(String(b.trial_ends_at)):null,j="active"===String(b.trial_status??"")&&!!i&&!Number.isNaN(i.getTime())&&i.getTime()>e.getTime(),k=null===b.admin_override_enabled||void 0===b.admin_override_enabled?null:!!b.admin_override_enabled;return(0,c.resolveWorkspaceFeatureAccess)({includedInPlan:f,trialActive:j,workspaceEnabled:!!b.workspace_enabled,adminOverrideEnabled:k}).hasAccess}catch(a){return console.error("Failed to resolve workspace feature access",a),!1}}a.s(["hasWorkspaceFeatureAccessForWorkspace",0,f])},522734,(a,b,c)=>{b.exports=a.x("fs",()=>require("fs"))},688947,(a,b,c)=>{b.exports=a.x("stream",()=>require("stream"))},449719,(a,b,c)=>{b.exports=a.x("assert",()=>require("assert"))},500874,(a,b,c)=>{b.exports=a.x("buffer",()=>require("buffer"))},406461,(a,b,c)=>{b.exports=a.x("zlib",()=>require("zlib"))},753996,a=>a.a(async(b,c)=>{try{var d=a.i(295946),e=a.i(87921),f=b([e]);function g(a){return{id:String(a.id),mediaType:"video"===a.media_type?"video":"image",publicUrl:String(a.public_url),storageKey:String(a.storage_key),title:a.title?String(a.title):null,caption:a.caption?String(a.caption):null,altText:String(a.alt_text),displayStyle:String(a.display_style),status:String(a.status),isFeatured:!!a.is_featured,sortOrder:Number(a.sort_order??0),mimeType:String(a.mime_type),bytes:Number(a.bytes??0)}}async function h(){let[a,b]=await Promise.all([(0,e.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);return a.ok&&(0,e.canManageWorkspaceSettings)(a)&&b?(await b`
    select id,media_type,public_url,storage_key,title,caption,alt_text,display_style,status,is_featured,sort_order,mime_type,bytes
    from website_gallery_items
    where workspace_id=${a.workspaceId}::uuid
    order by sort_order asc, created_at desc
    limit 200
  `).map(g):[]}async function i(a){let b=(0,d.getSql)();return b?(await b`
    select g.id,g.media_type,g.public_url,g.storage_key,g.title,g.caption,g.alt_text,g.display_style,g.status,g.is_featured,g.sort_order,g.mime_type,g.bytes
    from website_gallery_items g
    join workspaces w on w.id=g.workspace_id
    where w.slug=${a} and w.status in ('active','trial') and g.status='published'
    order by g.is_featured desc, g.sort_order asc, g.published_at desc nulls last
  `).map(g):[]}async function j(a,b){let[c,f]=await Promise.all([(0,e.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.ok||!(0,e.canManageWorkspaceSettings)(c)||!f)return!1;if("delete"===b){let b=await f`delete from website_gallery_items where id=${a}::uuid and workspace_id=${c.workspaceId}::uuid returning id`;return!!b[0]?.id}let g="publish"===b?"published":"hidden",h=await f`update website_gallery_items set status=${g}, published_at=case when ${g}='published' then coalesce(published_at,now()) else null end, updated_at=now() where id=${a}::uuid and workspace_id=${c.workspaceId}::uuid returning id`;return!!h[0]?.id}[e]=f.then?(await f)():f,a.s(["getDashboardGalleryItems",0,h,"getPublishedGalleryItems",0,i,"updateGalleryItem",0,j]),c()}catch(a){c(a)}},!1),97096,a=>{"use strict";var b=a.i(53112);let c=["pending","approved","rejected"],d=b.z.string().trim().max(120).transform(a=>a||null),e=b.z.object({reviewerName:b.z.string().trim().min(2).max(80),rating:b.z.coerce.number().int().min(1).max(5),service:d,area:d,message:b.z.string().trim().min(10).max(1e3)}),f=b.z.object({ownerReply:b.z.string().trim().max(1e3).transform(a=>a||null),isFeatured:b.z.boolean()});async function g(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e,nextStatus:f}=a;return b`
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
    `).flatMap(a=>{let b=k({...a,published_at:a.published_at??a.created_at}),c=a.status;return b&&(0,e.isWebsiteReviewStatus)(c)?[{...b,status:c,createdAt:h(a.created_at)}]:[]})}catch(a){return console.error("Failed to read dashboard website reviews",a),[]}}async function o(a,b){let[c,g]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.ok||!(0,f.canManageWorkspaceSettings)(c)||!g||!s.test(a)||!(0,e.isWebsiteReviewStatus)(b))return!1;try{let d=await (0,e.persistWebsiteReviewModeration)({sql:g,actorUserId:c.userId,workspaceId:c.workspaceId,reviewId:a,nextStatus:b});return!!d[0]?.id}catch(a){return console.error("Failed to moderate website review",a),!1}}async function p(a,b){let c=e.websiteReviewEditSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewEdit)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,review:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to edit website review",a),!1}}async function q(a,b){let c=e.websiteReviewPresentationSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewPresentation)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,presentation:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to update website review presentation",a),!1}}async function r(a){let[b,c]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!b.ok||!(0,f.canManageWorkspaceSettings)(b)||!c||!s.test(a))return!1;try{let d=await (0,e.persistWebsiteReviewDeletion)({sql:c,actorUserId:b.userId,workspaceId:b.workspaceId,reviewId:a});return!!d[0]?.id}catch(a){return console.error("Failed to delete website review",a),!1}}a.s(["deleteDashboardWebsiteReview",0,r,"getDashboardWebsiteReviews",0,n,"getPublishedWebsiteReviewSummary",0,m,"getPublishedWebsiteReviews",0,l,"updateDashboardWebsiteReview",0,p,"updateDashboardWebsiteReviewPresentation",0,q,"updateDashboardWebsiteReviewStatus",0,o]),c()}catch(a){c(a)}},!1),293271,a=>{"use strict";var b=a.i(907997);function c({item:a,className:d}){return"video"===a.mediaType?(0,b.jsx)("video",{src:a.publicUrl,controls:!0,preload:"metadata",playsInline:!0,className:d}):(0,b.jsx)("img",{src:a.publicUrl,alt:a.altText,loading:"lazy",className:d})}a.s(["PublicWorkspaceGallery",0,function({items:a,companyName:d,workspaceSlug:e,compact:f=!1}){if(!a.length)return null;let g=a.find(a=>a.isFeatured||"hero"===a.displayStyle),h=a.filter(a=>"slider"===a.displayStyle&&a.id!==g?.id),i=a.filter(a=>a.id!==g?.id&&"slider"!==a.displayStyle);if(f){let f=[g,...a.filter(a=>a.id!==g?.id)].filter(Boolean).slice(0,6);return(0,b.jsxs)("section",{className:"mx-auto mt-6 max-w-5xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/10 sm:p-7",children:[(0,b.jsxs)("div",{className:"flex flex-wrap items-end justify-between gap-3",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-black uppercase tracking-[.16em] text-[#68736b]",children:"Galleri / Gallery"}),(0,b.jsxs)("h2",{className:"mt-2 text-2xl font-black text-[#17201a]",children:["Se arbeten från ",d]})]}),(0,b.jsx)("a",{href:`/galleri/${e}`,className:"rounded-xl bg-[#173e2b] px-4 py-3 text-sm font-black text-white",children:"Visa hela galleriet"})]}),(0,b.jsx)("div",{className:"mt-5 grid grid-cols-2 gap-3 md:grid-cols-3",children:f.map((a,d)=>(0,b.jsx)("article",{className:`overflow-hidden rounded-2xl bg-[#edf1ec] ${0===d?"col-span-2 row-span-2 md:col-span-1":""}`,children:(0,b.jsx)(c,{item:a,className:"aspect-square h-full w-full object-cover"})},a.id))})]})}return(0,b.jsxs)("main",{className:"min-h-screen bg-[#f5f7f4] text-[#17201a]",children:[(0,b.jsx)("header",{className:"bg-[#173e2b] text-white",children:(0,b.jsxs)("div",{className:"mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5",children:[(0,b.jsx)("a",{href:`/boka/${e}`,className:"text-lg font-black sm:text-xl",children:d}),(0,b.jsx)("a",{href:`/boka/${e}`,className:"rounded-xl bg-white px-4 py-3 text-sm font-black text-[#173e2b]",children:"Boka / Book"})]})}),(0,b.jsxs)("section",{className:"mx-auto max-w-6xl px-5 py-12 sm:py-16",children:[(0,b.jsx)("p",{className:"text-xs font-black uppercase tracking-[.18em] text-[#637068]",children:"Galleri / Gallery"}),(0,b.jsxs)("h1",{className:"mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl",children:["Arbeten från ",d]}),(0,b.jsx)("p",{className:"mt-4 max-w-2xl text-base leading-7 text-[#667168]",children:"Publicerade bilder och videor från verksamheten."})]}),g?(0,b.jsx)("section",{className:"mx-auto max-w-6xl px-5 pb-8",children:(0,b.jsxs)("article",{className:"overflow-hidden rounded-[2rem] bg-[#173e2b] text-white shadow-xl",children:[(0,b.jsx)(c,{item:g,className:"max-h-[680px] w-full object-cover"}),(0,b.jsxs)("div",{className:"p-6 sm:p-8",children:[(0,b.jsx)("h2",{className:"text-2xl font-black",children:g.title||"Utvalt arbete"}),g.caption?(0,b.jsx)("p",{className:"mt-2 max-w-3xl text-white/75",children:g.caption}):null]})]})}):null,h.length?(0,b.jsx)("section",{className:"mx-auto max-w-6xl overflow-x-auto px-5 pb-8",children:(0,b.jsx)("div",{className:"flex min-w-max gap-4",children:h.map(a=>(0,b.jsxs)("article",{className:"w-[78vw] max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10",children:[(0,b.jsx)(c,{item:a,className:"aspect-video w-full object-cover"}),(0,b.jsxs)("div",{className:"p-5",children:[(0,b.jsx)("h2",{className:"font-black",children:a.title||"Projekt"}),a.caption?(0,b.jsx)("p",{className:"mt-2 text-sm leading-6 text-[#667168]",children:a.caption}):null]})]},a.id))})}):null,(0,b.jsx)("section",{className:"mx-auto max-w-6xl px-5 pb-20",children:i.length?(0,b.jsx)("div",{className:"columns-1 gap-5 sm:columns-2 lg:columns-3",children:i.map(a=>(0,b.jsxs)("article",{className:"mb-5 break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10",children:[(0,b.jsx)(c,{item:a,className:"w-full object-cover"}),(0,b.jsxs)("div",{className:"p-5",children:[(0,b.jsx)("h2",{className:"font-black",children:a.title||"Projekt"}),a.caption?(0,b.jsx)("p",{className:"mt-2 text-sm leading-6 text-[#667168]",children:a.caption}):null]})]},a.id))}):(0,b.jsx)("div",{className:"rounded-3xl border border-dashed p-12 text-center text-[#667168]",children:"Inga fler publicerade medier."})})]})}])},577062,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_memory-adapter_dist_index_mjs_0ptlb60._.js"].map(b=>a.l(b))).then(()=>b(17616)))},860484,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_01xuj8~._.js"].map(b=>a.l(b))).then(()=>b(536063)))},580632,a=>{a.v(a=>Promise.resolve().then(()=>a(270406)))},564133,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0c3cy-j._.js"].map(b=>a.l(b))).then(()=>b(311618)))},908409,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_0gpix3g._.js"].map(b=>a.l(b))).then(()=>b(869959)))},552157,a=>{a.v(b=>Promise.all(["server/chunks/ssr/node_modules_@better-auth_kysely-adapter_dist_07980-r._.js"].map(b=>a.l(b))).then(()=>b(71326)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0b4os05._.js.map