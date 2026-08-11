module.exports=[137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},224774,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={ACTION_HEADER:function(){return g},FLIGHT_HEADERS:function(){return q},NEXT_ACTION_NOT_FOUND_HEADER:function(){return x},NEXT_ACTION_REVALIDATED_HEADER:function(){return A},NEXT_DID_POSTPONE_HEADER:function(){return t},NEXT_HMR_REFRESH_HASH_COOKIE:function(){return l},NEXT_HMR_REFRESH_HEADER:function(){return k},NEXT_HTML_REQUEST_ID_HEADER:function(){return z},NEXT_INSTANT_PREFETCH_HEADER:function(){return o},NEXT_INSTANT_TEST_COOKIE:function(){return p},NEXT_IS_PRERENDER_HEADER:function(){return w},NEXT_REQUEST_ID_HEADER:function(){return y},NEXT_REWRITTEN_PATH_HEADER:function(){return u},NEXT_REWRITTEN_QUERY_HEADER:function(){return v},NEXT_ROUTER_PREFETCH_HEADER:function(){return i},NEXT_ROUTER_SEGMENT_PREFETCH_HEADER:function(){return j},NEXT_ROUTER_STALE_TIME_HEADER:function(){return s},NEXT_ROUTER_STATE_TREE_HEADER:function(){return h},NEXT_RSC_UNION_QUERY:function(){return r},NEXT_URL:function(){return m},RSC_CONTENT_TYPE_HEADER:function(){return n},RSC_HEADER:function(){return f}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f="rsc",g="next-action",h="next-router-state-tree",i="next-router-prefetch",j="next-router-segment-prefetch",k="next-hmr-refresh",l="__next_hmr_refresh_hash__",m="next-url",n="text/x-component",o="next-instant-navigation-testing-prefetch",p="next-instant-navigation-testing",q=[f,h,i,k,j],r="_rsc",s="x-nextjs-stale-time",t="x-nextjs-postponed",u="x-nextjs-rewritten-path",v="x-nextjs-rewritten-query",w="x-nextjs-prerender",x="x-nextjs-action-not-found",y="x-nextjs-request-id",z="x-nextjs-html-request-id",A="x-action-revalidated";("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},237211,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={djb2Hash:function(){return f},hexHash:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){let b=5381;for(let c=0;c<a.length;c++)b=(b<<5)+b+a.charCodeAt(c)|0;return b>>>0}function g(a){return f(a).toString(36).slice(0,5)}},773576,(a,b,c)=>{"use strict";function d(a){return a.startsWith("/")?a:`/${a}`}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureLeadingSlash",{enumerable:!0,get:function(){return d}})},398698,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={DEFAULT_SEGMENT_KEY:function(){return l},NOT_FOUND_SEGMENT_KEY:function(){return m},PAGE_SEGMENT_KEY:function(){return k},addSearchParamsIfPageSegment:function(){return i},computeSelectedLayoutSegment:function(){return j},getSegmentValue:function(){return f},getSelectedLayoutSegmentPath:function(){return function a(b,c,d=!0,e=[]){let g;if(d)g=b[1][c];else{let a=b[1];g=a.children??Object.values(a)[0]}if(!g)return e;let h=f(g[0]);return!h||h.startsWith(k)?e:(e.push(h),a(g,c,!1,e))}},isGroupSegment:function(){return g},isParallelRouteSegment:function(){return h}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){return Array.isArray(a)?a[1]:a}function g(a){return"("===a[0]&&a.endsWith(")")}function h(a){return a.startsWith("@")&&"@children"!==a}function i(a,b){if(a.includes(k)){let a=JSON.stringify(b);return"{}"!==a?k+"?"+a:k}return a}function j(a,b){if(!a||0===a.length)return null;let c="children"===b?a[0]:a[a.length-1];return c===l?null:c}let k="__PAGE__",l="__DEFAULT__",m="/_not-found"},5847,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={compareAppPaths:function(){return i},normalizeAppPath:function(){return h},normalizeRscURL:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(773576),g=a.r(398698);function h(a){return(0,f.ensureLeadingSlash)(a.split("/").reduce((a,b,c,d)=>!b||(0,g.isGroupSegment)(b)||"@"===b[0]||("page"===b||"route"===b)&&c===d.length-1?a:`${a}/${b}`,""))}function i(a,b){let c=a.includes("/@"),d=b.includes("/@");return c&&!d?-1:!c&&d?1:a.localeCompare(b)}function j(a){return a.replace(/\.rsc($|\?)/,"$1")}},235092,a=>a.a(async(b,c)=>{try{var d=a.i(244446),e=a.i(295946),f=a.i(739601),g=b([f]);[f]=g.then?(await g)():g;let i=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;async function h(a){let b=await (0,f.getPlatformAdmin)(),c=(0,e.getSql)();if(!b||!c||!(0,d.canAccessAdminBilling)(b.role))throw Error("Billing admin access required");let g=a.workspaceId.trim(),h=a.workspacePlanId.trim();if(!i.test(g)||!i.test(h))throw Error("Invalid workspace reference");let j=new Date(a.expectedCurrentPeriodEnd);if(Number.isNaN(j.getTime()))throw Error("Invalid trial end date");let k=j.toISOString(),l=(0,d.parseTrialExtensionDays)(a.days),m=(0,d.normalizeTrialExtensionReason)(a.reason),n=await c`
    with updated_plan as (
      update workspace_plans wp
      set
        current_period_end = wp.current_period_end + (${l}::int * interval '1 day'),
        updated_at = now()
      where wp.id = ${h}::uuid
        and wp.workspace_id = ${g}::uuid
        and wp.status = 'trialing'
        and wp.current_period_end is not null
        and wp.current_period_end = ${k}::timestamptz
        and wp.id = (
          select latest.id
          from workspace_plans latest
          where latest.workspace_id = wp.workspace_id
          order by latest.created_at desc
          limit 1
        )
        and not exists (
          select 1
          from workspace_billing_subscriptions wbs
          where wbs.workspace_id = wp.workspace_id
            and wbs.stripe_subscription_id is not null
        )
        and not exists (
          select 1
          from workspace_billing_subscriptions wbs
          where wbs.workspace_id = wp.workspace_id
            and wbs.status not in ('pending', 'trialing')
        )
      returning
        wp.workspace_id,
        wp.plan_key,
        wp.status,
        wp.current_period_end - (${l}::int * interval '1 day') as previous_period_end,
        wp.current_period_end as new_period_end
    ),
    updated_internal_billing as (
      update workspace_billing_subscriptions wbs
      set
        current_period_end = up.new_period_end,
        updated_at = now()
      from updated_plan up
      where wbs.workspace_id = up.workspace_id
        and wbs.stripe_subscription_id is null
        and wbs.status in ('pending', 'trialing')
      returning wbs.workspace_id
    ),
    audit as (
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      )
      select
        ${b.userId},
        up.workspace_id,
        'billing.trial_extended',
        ${m},
        jsonb_build_object(
          'plan_key', up.plan_key,
          'status', up.status,
          'current_period_end', up.previous_period_end,
          'billing_source', 'internal'
        ),
        jsonb_build_object(
          'plan_key', up.plan_key,
          'status', up.status,
          'current_period_end', up.new_period_end,
          'extension_days', ${l}::int,
          'billing_source', 'internal'
        )
      from updated_plan up
      returning id, workspace_id
    )
    select id, workspace_id
    from audit
  `;if(1!==n.length)throw Error("Trial extension was rejected because the subscription changed or is Stripe-managed");return{workspaceId:String(n[0].workspace_id)}}a.s(["extendInternalWorkspaceTrial",0,h]),c()}catch(a){c(a)}},!1),563568,a=>a.a(async(b,c)=>{try{var d=a.i(137936);a.i(570396);var e=a.i(673727),f=a.i(118558),g=a.i(235092),h=a.i(713095),i=b([g]);async function j(a){let b=String(a.get("workspaceId")??"");try{await (0,g.extendInternalWorkspaceTrial)({workspaceId:b,workspacePlanId:String(a.get("workspacePlanId")??""),expectedCurrentPeriodEnd:String(a.get("expectedCurrentPeriodEnd")??""),days:String(a.get("days")??""),reason:String(a.get("reason")??"")})}catch{(0,e.redirect)("/admin/billing?notice=extension-failed")}(0,f.revalidatePath)("/admin/billing"),(0,f.revalidatePath)(`/admin/workspaces/${b}`),(0,f.revalidatePath)("/admin/audit"),(0,e.redirect)("/admin/billing?notice=trial-extended")}[g]=i.then?(await i)():i,(0,h.ensureServerEntryExports)([j]),(0,d.registerServerReference)(j,"401100b219274e5ec6f299c9685436a822ce20ad2b",null),a.s(["extendTrialAction",0,j]),c()}catch(a){c(a)}},!1),626311,a=>a.a(async(b,c)=>{try{var d=a.i(563568),e=b([d]);[d]=e.then?(await e)():e,a.s([]),c()}catch(a){c(a)}},!1),824575,a=>a.a(async(b,c)=>{try{var d=a.i(626311),e=a.i(563568),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s(["401100b219274e5ec6f299c9685436a822ce20ad2b",()=>e.extendTrialAction]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_0541oby._.js.map