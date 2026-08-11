module.exports=[137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},224774,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={ACTION_HEADER:function(){return g},FLIGHT_HEADERS:function(){return q},NEXT_ACTION_NOT_FOUND_HEADER:function(){return x},NEXT_ACTION_REVALIDATED_HEADER:function(){return A},NEXT_DID_POSTPONE_HEADER:function(){return t},NEXT_HMR_REFRESH_HASH_COOKIE:function(){return l},NEXT_HMR_REFRESH_HEADER:function(){return k},NEXT_HTML_REQUEST_ID_HEADER:function(){return z},NEXT_INSTANT_PREFETCH_HEADER:function(){return o},NEXT_INSTANT_TEST_COOKIE:function(){return p},NEXT_IS_PRERENDER_HEADER:function(){return w},NEXT_REQUEST_ID_HEADER:function(){return y},NEXT_REWRITTEN_PATH_HEADER:function(){return u},NEXT_REWRITTEN_QUERY_HEADER:function(){return v},NEXT_ROUTER_PREFETCH_HEADER:function(){return i},NEXT_ROUTER_SEGMENT_PREFETCH_HEADER:function(){return j},NEXT_ROUTER_STALE_TIME_HEADER:function(){return s},NEXT_ROUTER_STATE_TREE_HEADER:function(){return h},NEXT_RSC_UNION_QUERY:function(){return r},NEXT_URL:function(){return m},RSC_CONTENT_TYPE_HEADER:function(){return n},RSC_HEADER:function(){return f}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f="rsc",g="next-action",h="next-router-state-tree",i="next-router-prefetch",j="next-router-segment-prefetch",k="next-hmr-refresh",l="__next_hmr_refresh_hash__",m="next-url",n="text/x-component",o="next-instant-navigation-testing-prefetch",p="next-instant-navigation-testing",q=[f,h,i,k,j],r="_rsc",s="x-nextjs-stale-time",t="x-nextjs-postponed",u="x-nextjs-rewritten-path",v="x-nextjs-rewritten-query",w="x-nextjs-prerender",x="x-nextjs-action-not-found",y="x-nextjs-request-id",z="x-nextjs-html-request-id",A="x-action-revalidated";("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},237211,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={djb2Hash:function(){return f},hexHash:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){let b=5381;for(let c=0;c<a.length;c++)b=(b<<5)+b+a.charCodeAt(c)|0;return b>>>0}function g(a){return f(a).toString(36).slice(0,5)}},773576,(a,b,c)=>{"use strict";function d(a){return a.startsWith("/")?a:`/${a}`}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureLeadingSlash",{enumerable:!0,get:function(){return d}})},398698,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={DEFAULT_SEGMENT_KEY:function(){return l},NOT_FOUND_SEGMENT_KEY:function(){return m},PAGE_SEGMENT_KEY:function(){return k},addSearchParamsIfPageSegment:function(){return i},computeSelectedLayoutSegment:function(){return j},getSegmentValue:function(){return f},getSelectedLayoutSegmentPath:function(){return function a(b,c,d=!0,e=[]){let g;if(d)g=b[1][c];else{let a=b[1];g=a.children??Object.values(a)[0]}if(!g)return e;let h=f(g[0]);return!h||h.startsWith(k)?e:(e.push(h),a(g,c,!1,e))}},isGroupSegment:function(){return g},isParallelRouteSegment:function(){return h}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){return Array.isArray(a)?a[1]:a}function g(a){return"("===a[0]&&a.endsWith(")")}function h(a){return a.startsWith("@")&&"@children"!==a}function i(a,b){if(a.includes(k)){let a=JSON.stringify(b);return"{}"!==a?k+"?"+a:k}return a}function j(a,b){if(!a||0===a.length)return null;let c="children"===b?a[0]:a[a.length-1];return c===l?null:c}let k="__PAGE__",l="__DEFAULT__",m="/_not-found"},5847,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={compareAppPaths:function(){return i},normalizeAppPath:function(){return h},normalizeRscURL:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(773576),g=a.r(398698);function h(a){return(0,f.ensureLeadingSlash)(a.split("/").reduce((a,b,c,d)=>!b||(0,g.isGroupSegment)(b)||"@"===b[0]||("page"===b||"route"===b)&&c===d.length-1?a:`${a}/${b}`,""))}function i(a,b){let c=a.includes("/@"),d=b.includes("/@");return c&&!d?-1:!c&&d?1:a.localeCompare(b)}function j(a){return a.replace(/\.rsc($|\?)/,"$1")}},296592,a=>{"use strict";let b={invalid_email:"Valid email required",invalid_role:"Invalid platform admin role",user_not_found:"User account not found",workspace_member:"Workspace members cannot be newly activated as platform admins",self_protection:"You cannot remove your own super admin access",last_super_admin:"The final active super admin cannot be deactivated or demoted",access_revoked:"Your super admin access changed before the update completed"};a.s(["PlatformAdminManagementError",0,class extends Error{code;constructor(a){super(b[a]),this.name="PlatformAdminManagementError",this.code=a}},"canActivatePlatformAdmin",0,function(a){return!a.requestedActive||!!a.existingActive||0===a.workspaceMembershipCount}])},546974,a=>a.a(async(b,c)=>{try{var d=a.i(296592),e=a.i(295946),f=a.i(739601),g=b([f]);[f]=g.then?(await g)():g;let j=["super_admin","support_admin","billing_admin","operations_admin","read_only_admin","developer_admin"];async function h(){let a=await (0,f.getPlatformAdmin)(),b=(0,e.getSql)();return a&&b&&"super_admin"===a.role?b`
    select pa.user_id, pa.role, pa.is_active, pa.created_at, pa.updated_at,
      u.name, u.email,
      (
        select count(*)::int
        from workspace_memberships wm
        where wm.user_id = pa.user_id
      ) as workspace_membership_count
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    order by pa.is_active desc, u.email asc
  `:null}async function i(a,b,c){let g=await (0,f.getPlatformAdmin)(),h=(0,e.getSql)();if(!g||!h||"super_admin"!==g.role)throw Error("Super admin access required");if(!j.includes(b))throw new d.PlatformAdminManagementError("invalid_role");let i=a.trim().toLowerCase();if(!i||i.length>320)throw new d.PlatformAdminManagementError("invalid_email");let k=(await h`
    select u.id, u.email, u.name,
      pa.role as existing_role,
      pa.is_active as existing_is_active,
      count(wm.id)::int as workspace_membership_count
    from "user" u
    left join platform_admins pa on pa.user_id = u.id
    left join workspace_memberships wm on wm.user_id = u.id
    where lower(u.email) = ${i}
    group by u.id, u.email, u.name, pa.role, pa.is_active
    limit 1
  `)[0];if(!k)throw new d.PlatformAdminManagementError("user_not_found");let l=String(k.id),m=!0===k.existing_is_active,n=Number(k.workspace_membership_count??0);if(l===g.userId&&(!c||"super_admin"!==b))throw new d.PlatformAdminManagementError("self_protection");if(!(0,d.canActivatePlatformAdmin)({requestedActive:c,existingActive:m,workspaceMembershipCount:n}))throw new d.PlatformAdminManagementError("workspace_member");let o=await h`
    with lock_guard as materialized (
      select pg_advisory_xact_lock(74821, 34901)
    ),
    current_target as materialized (
      select
        ${l}::text as user_id,
        pa.role as existing_role,
        coalesce(pa.is_active, false) as existing_is_active,
        exists (
          select 1
          from workspace_memberships wm
          where wm.user_id = ${l}
        ) as has_workspace_membership,
        exists (
          select 1
          from platform_admins actor
          where actor.user_id = ${g.userId}
            and actor.role = 'super_admin'
            and actor.is_active = true
        ) as actor_is_super_admin
      from lock_guard
      left join platform_admins pa on pa.user_id = ${l}
    ),
    eligibility as materialized (
      select
        current_target.*,
        case
          when not current_target.actor_is_super_admin
            then 'access_revoked'
          when ${c}
            and not current_target.existing_is_active
            and current_target.has_workspace_membership
            then 'workspace_member'
          when current_target.existing_role = 'super_admin'
            and current_target.existing_is_active
            and (not ${c} or ${b} <> 'super_admin')
            and not exists (
              select 1
              from platform_admins other
              where other.user_id <> current_target.user_id
                and other.role = 'super_admin'
                and other.is_active = true
            )
            then 'last_super_admin'
          else 'ok'
        end as outcome
      from current_target
    ),
    upserted as (
      insert into platform_admins (user_id, role, is_active, created_at, updated_at)
      select user_id, ${b}, ${c}, now(), now()
      from eligibility
      where outcome = 'ok'
      on conflict (user_id) do update
      set role = excluded.role, is_active = excluded.is_active, updated_at = now()
      returning user_id, role, is_active
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      )
      select
        ${g.userId},
        'platform_admin.updated',
        ${`Platform admin access updated for ${i}`},
        case
          when eligibility.existing_role is null then null
          else jsonb_build_object(
            'role', eligibility.existing_role,
            'is_active', eligibility.existing_is_active
          )
        end,
        jsonb_build_object(
          'user_id', upserted.user_id,
          'email', ${i},
          'role', upserted.role,
          'is_active', upserted.is_active
        )
      from upserted
      join eligibility on eligibility.user_id = upserted.user_id
      returning id
    )
    select
      eligibility.outcome,
      (select id from audited limit 1) as audit_id
    from eligibility
  `,p=String(o[0]?.outcome??"");if("workspace_member"===p)throw new d.PlatformAdminManagementError("workspace_member");if("last_super_admin"===p)throw new d.PlatformAdminManagementError("last_super_admin");if("access_revoked"===p)throw new d.PlatformAdminManagementError("access_revoked");if("ok"!==p||!o[0]?.audit_id)throw Error("Platform admin update was not persisted and audited")}a.s(["PLATFORM_ADMIN_ROLES",0,j,"listPlatformAdmins",0,h,"upsertPlatformAdmin",0,i]),c()}catch(a){c(a)}},!1),92303,a=>a.a(async(b,c)=>{try{var d=a.i(137936),e=a.i(118558);a.i(570396);var f=a.i(673727),g=a.i(546974),h=a.i(296592),i=a.i(713095),j=b([g]);async function k(a){let b=String(a.get("email")??""),c=String(a.get("role")??""),d="on"===a.get("isActive");g.PLATFORM_ADMIN_ROLES.includes(c)||(0,f.redirect)("/admin/platform-admins?error=invalid_role");try{await (0,g.upsertPlatformAdmin)(b,c,d)}catch(a){throw a instanceof h.PlatformAdminManagementError&&(0,f.redirect)(`/admin/platform-admins?error=${a.code}`),a}(0,e.revalidatePath)("/admin/platform-admins"),(0,e.revalidatePath)("/admin/audit"),(0,f.redirect)("/admin/platform-admins?saved=1")}[g]=j.then?(await j)():j,(0,i.ensureServerEntryExports)([k]),(0,d.registerServerReference)(k,"4079c32114035137ec40b9a4b79a859d0d7522eed3",null),a.s(["savePlatformAdminAction",0,k]),c()}catch(a){c(a)}},!1),872271,a=>a.a(async(b,c)=>{try{var d=a.i(92303),e=b([d]);[d]=e.then?(await e)():e,a.s([]),c()}catch(a){c(a)}},!1),491686,a=>a.a(async(b,c)=>{try{var d=a.i(872271),e=a.i(92303),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s(["4079c32114035137ec40b9a4b79a859d0d7522eed3",()=>e.savePlatformAdminAction]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_0i3wxev._.js.map