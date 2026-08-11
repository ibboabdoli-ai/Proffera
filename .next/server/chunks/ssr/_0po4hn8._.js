module.exports=[238444,a=>{"use strict";var b=a.i(907997);a.s(["DashboardDataPanel",0,function({title:a,description:c,count:d,children:e}){return(0,b.jsxs)("section",{className:"overflow-hidden rounded-[24px] border border-[#e0e5dd] bg-white shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]",children:[(0,b.jsxs)("div",{className:"flex flex-col gap-3 border-b border-[#e5e9e2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h3",{className:"text-lg font-bold tracking-tight text-[#17201a]",children:a}),(0,b.jsx)("p",{className:"mt-1 text-sm leading-6 text-[#667168]",children:c})]}),(0,b.jsxs)("span",{className:"inline-flex w-fit items-center rounded-full bg-[#eaf2ec] px-3 py-1.5 text-xs font-bold text-[#17452f]",children:[d," ",1===d?"post":"poster"]})]}),e]})},"DashboardMetricGrid",0,function({items:a}){return(0,b.jsx)("section",{className:"grid gap-3 sm:grid-cols-2 xl:grid-cols-4","aria-label":"Sidöversikt",children:a.map(a=>(0,b.jsxs)("article",{className:"rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_10px_26px_rgba(20,43,32,0.035)] transition hover:-translate-y-0.5 hover:border-[#cfd8cd] hover:shadow-[0_14px_30px_rgba(20,43,32,0.07)]",children:[(0,b.jsxs)("div",{className:"flex items-start justify-between gap-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-[11px] font-bold uppercase tracking-[0.1em] text-[#778179]",children:a.label}),(0,b.jsx)("p",{className:"mt-3 text-3xl font-bold tracking-tight text-[#173e2b]",children:a.value})]}),(0,b.jsx)("span",{className:`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`,children:(0,b.jsx)(a.icon,{className:"h-[18px] w-[18px]","aria-hidden":"true"})})]}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-5 text-[#6a756d]",children:a.helper})]},a.label))})},"DashboardPageHeader",0,function({eyebrow:a,title:c,description:d,icon:e,actions:f}){return(0,b.jsxs)("section",{className:"relative overflow-hidden rounded-[24px] border border-[#dfe5dd] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.05)] sm:px-7 sm:py-7 lg:px-8",children:[(0,b.jsx)("div",{className:"absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#eaf2ec] blur-2xl","aria-hidden":"true"}),(0,b.jsxs)("div",{className:"relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",children:[(0,b.jsxs)("div",{className:"flex max-w-3xl items-start gap-4",children:[(0,b.jsx)("span",{className:"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#173e2b] text-white shadow-lg shadow-[#173e2b]/15",children:(0,b.jsx)(e,{className:"h-5 w-5","aria-hidden":"true"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-bold uppercase tracking-[0.14em] text-[#17452f]",children:a}),(0,b.jsx)("h2",{className:"mt-2 text-2xl font-bold tracking-[-0.025em] text-[#17201a] sm:text-3xl",children:c}),(0,b.jsx)("p",{className:"mt-3 text-sm leading-7 text-[#667168] sm:text-[15px]",children:d})]})]}),f?(0,b.jsx)("div",{className:"flex shrink-0 flex-col gap-2 sm:flex-row",children:f}):null]})]})}])},137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},67693,a=>a.a(async(b,c)=>{try{var d=a.i(137936),e=a.i(905246);a.i(570396);var f=a.i(673727),g=a.i(87921),h=a.i(713095),i=b([g]);async function j(a){let b=String(a.get("workspace_id")??"");(await (0,g.getUserWorkspaceOptions)()).some(a=>a.id===b)||(0,f.redirect)("/dashboard?workspace=invalid"),(await (0,e.cookies)()).set(g.selectedWorkspaceCookieName,b,{httpOnly:!0,sameSite:"lax",secure:!0,path:"/",maxAge:31536e3}),(0,f.redirect)("/dashboard")}[g]=i.then?(await i)():i,(0,h.ensureServerEntryExports)([j]),(0,d.registerServerReference)(j,"4068e27ed13f1f3adac9ee8279e91982c5554507df",null),a.s(["switchWorkspaceAction",0,j]),c()}catch(a){c(a)}},!1),672607,a=>{"use strict";let b=(0,a.i(892277).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",0,b],672607)},405667,a=>{"use strict";let b=(0,a.i(892277).default)("clock-3",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6h4",key:"135r8i"}]]);a.s(["Clock3",0,b],405667)},833532,a=>{"use strict";let b=(0,a.i(892277).default)("star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);a.s(["Star",0,b],833532)},671213,a=>{"use strict";let b=(0,a.i(892277).default)("sparkles",[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]]);a.s(["Sparkles",0,b],671213)},208106,a=>{"use strict";let b=(0,a.i(892277).default)("badge-check",[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["BadgeCheck",0,b],208106)},44615,a=>{"use strict";let b=(0,a.i(892277).default)("trash-2",[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]]);a.s(["Trash2",0,b],44615)},684485,a=>{"use strict";let b=(0,a.i(892277).default)("pencil-line",[["path",{d:"M13 21h8",key:"1jsn5i"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}],["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]]);a.s(["PencilLine",0,b],684485)},571444,a=>{"use strict";let b=(0,a.i(892277).default)("link-2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);a.s(["Link2",0,b],571444)},97096,a=>{"use strict";var b=a.i(53112);let c=["pending","approved","rejected"],d=b.z.string().trim().max(120).transform(a=>a||null),e=b.z.object({reviewerName:b.z.string().trim().min(2).max(80),rating:b.z.coerce.number().int().min(1).max(5),service:d,area:d,message:b.z.string().trim().min(10).max(1e3)}),f=b.z.object({ownerReply:b.z.string().trim().max(1e3).transform(a=>a||null),isFeatured:b.z.boolean()});async function g(a){let{sql:b,actorUserId:c,workspaceId:d,reviewId:e,nextStatus:f}=a;return b`
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
    `).flatMap(a=>{let b=k({...a,published_at:a.published_at??a.created_at}),c=a.status;return b&&(0,e.isWebsiteReviewStatus)(c)?[{...b,status:c,createdAt:h(a.created_at)}]:[]})}catch(a){return console.error("Failed to read dashboard website reviews",a),[]}}async function o(a,b){let[c,g]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.ok||!(0,f.canManageWorkspaceSettings)(c)||!g||!s.test(a)||!(0,e.isWebsiteReviewStatus)(b))return!1;try{let d=await (0,e.persistWebsiteReviewModeration)({sql:g,actorUserId:c.userId,workspaceId:c.workspaceId,reviewId:a,nextStatus:b});return!!d[0]?.id}catch(a){return console.error("Failed to moderate website review",a),!1}}async function p(a,b){let c=e.websiteReviewEditSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewEdit)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,review:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to edit website review",a),!1}}async function q(a,b){let c=e.websiteReviewPresentationSchema.safeParse(b),[g,h]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!c.success||!g.ok||!(0,f.canManageWorkspaceSettings)(g)||!h||!s.test(a))return!1;try{let b=await (0,e.persistWebsiteReviewPresentation)({sql:h,actorUserId:g.userId,workspaceId:g.workspaceId,reviewId:a,presentation:c.data});return!!b[0]?.id}catch(a){return console.error("Failed to update website review presentation",a),!1}}async function r(a){let[b,c]=await Promise.all([(0,f.getUserWorkspaceAccess)(),Promise.resolve((0,d.getSql)())]);if(!b.ok||!(0,f.canManageWorkspaceSettings)(b)||!c||!s.test(a))return!1;try{let d=await (0,e.persistWebsiteReviewDeletion)({sql:c,actorUserId:b.userId,workspaceId:b.workspaceId,reviewId:a});return!!d[0]?.id}catch(a){return console.error("Failed to delete website review",a),!1}}a.s(["deleteDashboardWebsiteReview",0,r,"getDashboardWebsiteReviews",0,n,"getPublishedWebsiteReviewSummary",0,m,"getPublishedWebsiteReviews",0,l,"updateDashboardWebsiteReview",0,p,"updateDashboardWebsiteReviewPresentation",0,q,"updateDashboardWebsiteReviewStatus",0,o]),c()}catch(a){c(a)}},!1),130315,a=>{"use strict";let b=(0,a.i(892277).default)("message-square-reply",[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"m10 8-3 3 3 3",key:"fp6dz7"}],["path",{d:"M17 14v-1a2 2 0 0 0-2-2H7",key:"1tkjnz"}]]);a.s(["MessageSquareReply",0,b],130315)},875371,a=>a.a(async(b,c)=>{try{var d=a.i(67693),e=a.i(235906),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s([]),c()}catch(a){c(a)}},!1),646988,a=>a.a(async(b,c)=>{try{var d=a.i(875371),e=a.i(67693),f=a.i(235906),g=b([d,e,f]);[d,e,f]=g.then?(await g)():g,a.s(["40355c66085724ef6d7dca40ce3f750f439d117bc3",()=>f.$$RSC_SERVER_ACTION_1,"404b26cdac90620847c7555aeb07ec61352dc923af",()=>f.$$RSC_SERVER_ACTION_3,"4068e27ed13f1f3adac9ee8279e91982c5554507df",()=>e.switchWorkspaceAction,"40c66f0803aa272be69fa16bf22d3bad8eff0690ed",()=>f.$$RSC_SERVER_ACTION_2,"40cf2a312b87f696d395563aea950b74d3395171d6",()=>f.$$RSC_SERVER_ACTION_0]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_0po4hn8._.js.map