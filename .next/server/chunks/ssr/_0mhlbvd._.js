module.exports=[137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},713095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},224774,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={ACTION_HEADER:function(){return g},FLIGHT_HEADERS:function(){return q},NEXT_ACTION_NOT_FOUND_HEADER:function(){return x},NEXT_ACTION_REVALIDATED_HEADER:function(){return A},NEXT_DID_POSTPONE_HEADER:function(){return t},NEXT_HMR_REFRESH_HASH_COOKIE:function(){return l},NEXT_HMR_REFRESH_HEADER:function(){return k},NEXT_HTML_REQUEST_ID_HEADER:function(){return z},NEXT_INSTANT_PREFETCH_HEADER:function(){return o},NEXT_INSTANT_TEST_COOKIE:function(){return p},NEXT_IS_PRERENDER_HEADER:function(){return w},NEXT_REQUEST_ID_HEADER:function(){return y},NEXT_REWRITTEN_PATH_HEADER:function(){return u},NEXT_REWRITTEN_QUERY_HEADER:function(){return v},NEXT_ROUTER_PREFETCH_HEADER:function(){return i},NEXT_ROUTER_SEGMENT_PREFETCH_HEADER:function(){return j},NEXT_ROUTER_STALE_TIME_HEADER:function(){return s},NEXT_ROUTER_STATE_TREE_HEADER:function(){return h},NEXT_RSC_UNION_QUERY:function(){return r},NEXT_URL:function(){return m},RSC_CONTENT_TYPE_HEADER:function(){return n},RSC_HEADER:function(){return f}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f="rsc",g="next-action",h="next-router-state-tree",i="next-router-prefetch",j="next-router-segment-prefetch",k="next-hmr-refresh",l="__next_hmr_refresh_hash__",m="next-url",n="text/x-component",o="next-instant-navigation-testing-prefetch",p="next-instant-navigation-testing",q=[f,h,i,k,j],r="_rsc",s="x-nextjs-stale-time",t="x-nextjs-postponed",u="x-nextjs-rewritten-path",v="x-nextjs-rewritten-query",w="x-nextjs-prerender",x="x-nextjs-action-not-found",y="x-nextjs-request-id",z="x-nextjs-html-request-id",A="x-action-revalidated";("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},237211,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={djb2Hash:function(){return f},hexHash:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){let b=5381;for(let c=0;c<a.length;c++)b=(b<<5)+b+a.charCodeAt(c)|0;return b>>>0}function g(a){return f(a).toString(36).slice(0,5)}},773576,(a,b,c)=>{"use strict";function d(a){return a.startsWith("/")?a:`/${a}`}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureLeadingSlash",{enumerable:!0,get:function(){return d}})},398698,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={DEFAULT_SEGMENT_KEY:function(){return l},NOT_FOUND_SEGMENT_KEY:function(){return m},PAGE_SEGMENT_KEY:function(){return k},addSearchParamsIfPageSegment:function(){return i},computeSelectedLayoutSegment:function(){return j},getSegmentValue:function(){return f},getSelectedLayoutSegmentPath:function(){return function a(b,c,d=!0,e=[]){let g;if(d)g=b[1][c];else{let a=b[1];g=a.children??Object.values(a)[0]}if(!g)return e;let h=f(g[0]);return!h||h.startsWith(k)?e:(e.push(h),a(g,c,!1,e))}},isGroupSegment:function(){return g},isParallelRouteSegment:function(){return h}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){return Array.isArray(a)?a[1]:a}function g(a){return"("===a[0]&&a.endsWith(")")}function h(a){return a.startsWith("@")&&"@children"!==a}function i(a,b){if(a.includes(k)){let a=JSON.stringify(b);return"{}"!==a?k+"?"+a:k}return a}function j(a,b){if(!a||0===a.length)return null;let c="children"===b?a[0]:a[a.length-1];return c===l?null:c}let k="__PAGE__",l="__DEFAULT__",m="/_not-found"},5847,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={compareAppPaths:function(){return i},normalizeAppPath:function(){return h},normalizeRscURL:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(773576),g=a.r(398698);function h(a){return(0,f.ensureLeadingSlash)(a.split("/").reduce((a,b,c,d)=>!b||(0,g.isGroupSegment)(b)||"@"===b[0]||("page"===b||"route"===b)&&c===d.length-1?a:`${a}/${b}`,""))}function i(a,b){let c=a.includes("/@"),d=b.includes("/@");return c&&!d?-1:!c&&d?1:a.localeCompare(b)}function j(a){return a.replace(/\.rsc($|\?)/,"$1")}},162108,a=>{"use strict";var b=a.i(666680),c=a.i(295946);async function d(a){let d=(0,c.getSql)();if(!d)throw Error("Database is not configured");let e=a.workspaceId??(0,b.randomUUID)(),f=a.planKey??"starter",g=a.invitationId??null,h=new Date(Date.now()+12096e5).toISOString();return await d.transaction(b=>[b`
      insert into workspaces (
        id, slug, public_booking_slug, name, company_name, primary_city,
        contact_email, contact_phone, status
      ) values (
        ${e}::uuid, ${a.slug}, ${a.slug}, ${a.companyName},
        ${a.companyName}, ${a.city}, ${a.email}, ${a.phone}, 'trial'
      )
      on conflict (id) do update set
        name = excluded.name,
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,b`
      insert into workspace_memberships (id, workspace_id, user_id, role)
      values (gen_random_uuid(), ${e}::uuid, ${a.userId}, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner'
    `,b`
      insert into workspace_settings (
        workspace_id, company_name, primary_city, response_time_goal,
        default_cta, contact_email, contact_phone, billing_country_code,
        time_zone, billing_currency
      ) values (
        ${e}, ${a.companyName}, ${a.city}, 'Inom 24 timmar',
        'Boka tid', ${a.email}, ${a.phone}, 'SE', 'Europe/Stockholm', 'SEK'
      )
      on conflict (workspace_id) do update set
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,b`
      insert into workspace_plans (
        id, workspace_id, plan_key, status, current_period_start,
        current_period_end, created_at, updated_at
      )
      select gen_random_uuid(), ${e}::uuid, ${f}, 'trialing', now(),
        ${h}::timestamptz, now(), now()
      where not exists (
        select 1 from workspace_plans where workspace_id = ${e}::uuid
      )
    `,b`
      insert into workspace_experience_settings (workspace_id)
      values (${e}::uuid)
      on conflict (workspace_id) do nothing
    `,b`
      insert into workspace_onboarding (workspace_id)
      values (${e}::uuid)
      on conflict (workspace_id) do nothing
    `,b`
      insert into workspace_booking_reminder_settings (workspace_id)
      values (${e})
      on conflict (workspace_id) do nothing
    `,b`
      insert into workspace_booking_hours (workspace_id, weekday, opens_at, closes_at, is_closed)
      values
        (${e}, 0, null, null, true),
        (${e}, 1, '09:00'::time, '17:00'::time, false),
        (${e}, 2, '09:00'::time, '17:00'::time, false),
        (${e}, 3, '09:00'::time, '17:00'::time, false),
        (${e}, 4, '09:00'::time, '17:00'::time, false),
        (${e}, 5, '09:00'::time, '17:00'::time, false),
        (${e}, 6, null, null, true)
      on conflict (workspace_id, weekday) do nothing
    `,b`
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), ${e}::uuid, feature_key, true, now(), now()
      from feature_catalog
      where is_active = true
      on conflict (workspace_id, feature_key) do update set
        enabled = true,
        updated_at = now()
    `,b`
      update workspace_invitations
      set workspace_id = ${e}::uuid, updated_at = now()
      where ${g}::uuid is not null
        and id = ${g}::uuid
        and status = 'accepted'
        and workspace_id is null
    `]),{workspaceId:e,trialEndsAt:h}}a.s(["createWorkspaceSlug",0,function(a){let c=a.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,42),d=(0,b.randomBytes)(3).toString("hex");return`${c||"foretag"}-${d}`},"provisionWorkspace",0,d])},268698,a=>a.a(async(b,c)=>{try{var d=a.i(666680),e=a.i(162108),f=a.i(739601),g=a.i(295946),h=b([f]);function i(a){let b=a.trim();return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b)?b:null}async function j(){let a=await (0,f.getPlatformAdmin)();if(!a||"super_admin"!==a.role)throw Error("Super admin access required");return a}async function k(a=100){let b=await j(),c=(0,g.getSql)();if(!c)return{admin:b,rows:[]};let d=Math.max(1,Math.min(250,a)),e=await c`
    select
      claim.id::text,
      claim.status,
      claim.verification_method,
      claim.requested_at,
      claim.verified_at,
      claim.resolved_at,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.public_slug,
      profile.display_name,
      profile.legal_name,
      profile.legal_form,
      profile.city,
      profile.primary_sni_code,
      profile.primary_sni_label,
      profile.category_slug,
      profile.quality_score,
      profile.official_source,
      profile.source_updated_at,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      profile.claim_reserved_at,
      u.id as claimant_user_id,
      u.name as claimant_name,
      u.email as claimant_email,
      u."emailVerified" as claimant_email_verified
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" u on u.id = claim.claimant_user_id
    order by
      case claim.status when 'pending' then 0 when 'verified' then 1 when 'claimed' then 2 else 3 end,
      claim.requested_at desc
    limit ${d}
  `;return{admin:b,rows:e}}async function l(a){let b=await j(),c=(0,g.getSql)();if(!c)throw Error("Database is not configured");let d=i(a.claimId);if(!d)throw Error("Invalid claim id");let e=a.reason.trim();if(e.length<3||e.length>500)throw Error("A short rejection reason is required");let f=await c`
    update company_directory_claims claim
    set status = 'rejected', resolved_at = now(), verification_reference = ${e}
    where claim.id = ${d}::uuid
      and claim.status in ('pending', 'verified')
      and not exists (
        select 1
        from company_directory_profiles profile
        where profile.id = claim.profile_id
          and profile.claim_reservation_id = claim.id
      )
    returning claim.profile_id::text
  `,h=String(f[0]?.profile_id??"");if(!h)throw Error("Claim is no longer rejectable or is being provisioned");return await c`
    insert into admin_audit_logs (admin_user_id, action, reason, previous_value, new_value)
    values (
      ${b.userId}, 'company_directory.claim.rejected', ${e},
      ${JSON.stringify({claimId:d,profileId:h,status:"pending_or_verified"})}::jsonb,
      ${JSON.stringify({claimId:d,profileId:h,status:"rejected"})}::jsonb
    )
  `,{claimId:d,profileId:h}}async function m(a){let b=await j(),c=(0,g.getSql)();if(!c)throw Error("Database is not configured");let d=i(a.claimId);if(!d)throw Error("Invalid claim id");let e=a.reason.trim();if(e.length<3||e.length>500)throw Error("A recovery reason is required");let f=await c`
    update company_directory_profiles profile
    set claim_reservation_id = null,
        claim_reservation_token = null,
        claim_reserved_at = null,
        updated_at = now()
    from company_directory_claims claim
    where claim.id = ${d}::uuid
      and claim.profile_id = profile.id
      and claim.status in ('pending', 'verified')
      and profile.claimed_workspace_id is null
      and profile.claim_reservation_id = claim.id
      and profile.claim_reserved_at < now() - (${15}::text || ' minutes')::interval
      and not exists (
        select 1
        from workspaces workspace
        where workspace.id = claim.requested_workspace_id
      )
    returning profile.id::text
  `,h=String(f[0]?.id??"");if(!h)throw Error("Reservation is still active, already resolved, or its workspace already exists");return await c`
    insert into admin_audit_logs (admin_user_id, action, reason, previous_value, new_value)
    values (
      ${b.userId}, 'company_directory.claim.reservation_released', ${e},
      ${JSON.stringify({claimId:d,profileId:h,reservation:"stale"})}::jsonb,
      ${JSON.stringify({claimId:d,profileId:h,reservation:null})}::jsonb
    )
  `,{claimId:d,profileId:h}}async function n(a){let b=await j(),c=(0,g.getSql)();if(!c)throw Error("Database is not configured");let f=i(a.claimId);if(!f)throw Error("Invalid claim id");let h=a.reference.trim();if(h.length<3||h.length>500)throw Error("Verification evidence/reference is required");let k=(await c`
    select
      claim.id::text,
      claim.status,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.display_name,
      profile.city,
      profile.activity_description,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      profile.claim_reserved_at,
      u.id as claimant_user_id,
      u.email as claimant_email,
      u."emailVerified" as claimant_email_verified
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" u on u.id = claim.claimant_user_id
    where claim.id = ${f}::uuid
    limit 1
  `)[0];if(!k)throw Error("Claim not found");if(!k.claimant_email_verified)throw Error("Claimant email must be verified before approval");if(k.claimed_workspace_id)throw Error("Company profile is already claimed");if("pending"!==k.status&&"verified"!==k.status)throw Error("Claim is not approvable");let l=(0,d.randomUUID)(),m=(0,d.randomUUID)(),n=String(k.claimant_user_id),o=String(k.claimant_email).trim().toLowerCase(),p=String(k.display_name).trim(),q=String(k.city??"").trim(),r=String(k.profile_id);if(!p||!q||!o)throw Error("Claim lacks required provisioning data");if(!(await c`
    update company_directory_profiles profile
    set claim_reservation_id = ${f}::uuid,
        claim_reservation_token = ${m}::uuid,
        claim_reserved_at = now(),
        updated_at = now()
    where profile.id = ${r}::uuid
      and profile.claimed_workspace_id is null
      and (
        profile.claim_reservation_id is null
        or (
          profile.claim_reservation_id = ${f}::uuid
          and profile.claim_reserved_at < now() - (${15}::text || ' minutes')::interval
        )
      )
      and exists (
        select 1
        from company_directory_claims claim
        where claim.id = ${f}::uuid
          and claim.profile_id = profile.id
          and claim.status in ('pending', 'verified')
      )
    returning profile.id::text
  `)[0])throw Error("Company profile is already reserved by an active claim operation");let s=await c`
    update company_directory_claims
    set requested_workspace_id = coalesce(requested_workspace_id, ${l}::uuid),
        status = 'verified',
        verification_method = 'manual_review',
        verification_reference = ${h},
        verified_at = coalesce(verified_at, now())
    where id = ${f}::uuid
      and profile_id = ${r}::uuid
      and status in ('pending', 'verified')
    returning id::text, requested_workspace_id::text
  `,t=String(s[0]?.requested_workspace_id??"");if(!t)throw await c`
      update company_directory_profiles
      set claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          updated_at = now()
      where id = ${r}::uuid
        and claim_reservation_id = ${f}::uuid
        and claim_reservation_token = ${m}::uuid
        and claimed_workspace_id is null
    `,Error("Claim changed before provisioning could start");let u=await (0,e.provisionWorkspace)({workspaceId:t,userId:n,slug:(0,e.createWorkspaceSlug)(p),companyName:p,city:q,email:o,phone:"",planKey:"starter"});if(!(await c`
    with locked_pair as (
      select claim.id as claim_id, profile.id as profile_id
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      where claim.id = ${f}::uuid
        and claim.requested_workspace_id = ${t}::uuid
        and claim.status = 'verified'
        and profile.id = ${r}::uuid
        and profile.claimed_workspace_id is null
        and profile.claim_reservation_id = ${f}::uuid
        and profile.claim_reservation_token = ${m}::uuid
      for update of claim, profile
    ),
    claimed_profile as (
      update company_directory_profiles profile
      set claimed_workspace_id = ${t}::uuid,
          claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          publication_status = 'claimed',
          updated_at = now()
      from locked_pair pair
      where profile.id = pair.profile_id
      returning profile.id
    )
    update company_directory_claims claim
    set status = 'claimed', resolved_at = now()
    from locked_pair pair, claimed_profile profile
    where claim.id = pair.claim_id
      and profile.id = pair.profile_id
    returning claim.profile_id::text
  `)[0])throw Error("Claim reservation was lost before finalization; wait for lease recovery and review the provisioned workspace");let v=String(k.activity_description??"").trim();return await c.transaction(a=>[a`
      update workspace_experience_settings
      set business_intro = case
            when coalesce(business_intro, '') = '' then ${v}
            else business_intro
          end,
          updated_at = now()
      where workspace_id = ${t}::uuid
    `,a`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${b.userId}, ${t}::uuid, 'company_directory.claim.approved', ${h},
        ${JSON.stringify({claimId:f,profileId:r,status:String(k.status)})}::jsonb,
        ${JSON.stringify({claimId:f,profileId:r,status:"claimed",workspaceId:t})}::jsonb
      )
    `]),{claimId:f,workspaceId:u.workspaceId,trialEndsAt:u.trialEndsAt}}[f]=h.then?(await h)():h,a.s(["approveAndProvisionCompanyDirectoryClaim",0,n,"listCompanyDirectoryClaims",0,k,"rejectCompanyDirectoryClaim",0,l,"releaseStaleCompanyDirectoryClaimReservation",0,m]),c()}catch(a){c(a)}},!1),228630,a=>a.a(async(b,c)=>{try{var d=a.i(137936),e=a.i(118558),f=a.i(268698),g=a.i(713095),h=b([f]);async function i(a){let b=String(a.get("claimId")??""),c=String(a.get("reference")??"");await (0,f.approveAndProvisionCompanyDirectoryClaim)({claimId:b,reference:c}),(0,e.revalidatePath)("/admin/foretag/claims"),(0,e.revalidatePath)("/admin/foretag")}async function j(a){let b=String(a.get("claimId")??""),c=String(a.get("reason")??"");await (0,f.rejectCompanyDirectoryClaim)({claimId:b,reason:c}),(0,e.revalidatePath)("/admin/foretag/claims")}async function k(a){let b=String(a.get("claimId")??""),c=String(a.get("reason")??"");await (0,f.releaseStaleCompanyDirectoryClaimReservation)({claimId:b,reason:c}),(0,e.revalidatePath)("/admin/foretag/claims")}[f]=h.then?(await h)():h,(0,g.ensureServerEntryExports)([i,j,k]),(0,d.registerServerReference)(i,"401891f0192b583c5d25f9f02f50d905dceded724f",null),(0,d.registerServerReference)(j,"40359bca865726296242cdd7d9c076e4e5aed2ce7b",null),(0,d.registerServerReference)(k,"40679fce77a171efc676f8315b5f5adc802b36bcc0",null),a.s(["approveDirectoryClaimAction",0,i,"rejectDirectoryClaimAction",0,j,"releaseStaleDirectoryClaimReservationAction",0,k]),c()}catch(a){c(a)}},!1),665162,a=>a.a(async(b,c)=>{try{var d=a.i(228630),e=b([d]);[d]=e.then?(await e)():e,a.s([]),c()}catch(a){c(a)}},!1),19855,a=>a.a(async(b,c)=>{try{var d=a.i(665162),e=a.i(228630),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s(["401891f0192b583c5d25f9f02f50d905dceded724f",()=>e.approveDirectoryClaimAction,"40359bca865726296242cdd7d9c076e4e5aed2ce7b",()=>e.rejectDirectoryClaimAction,"40679fce77a171efc676f8315b5f5adc802b36bcc0",()=>e.releaseStaleDirectoryClaimReservationAction]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_0mhlbvd._.js.map