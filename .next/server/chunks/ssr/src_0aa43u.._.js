module.exports=[244446,a=>{"use strict";let b=["super_admin","billing_admin"],c=[3,7,14,30];a.s(["canAccessAdminBilling",0,function(a){return b.includes(a)},"normalizeTrialExtensionReason",0,function(a){let b=a.trim();if(b.length<8||b.length>500)throw Error("A reason between 8 and 500 characters is required");return b},"parseTrialExtensionDays",0,function(a){let b=Number(a);if(!c.includes(b))throw Error("Invalid trial extension duration");return b}])},300089,a=>a.a(async(b,c)=>{try{var d=a.i(244446),e=a.i(295946),f=a.i(739601),g=b([f]);async function h(a={}){var b,c;let g,i,j=await (0,f.getPlatformAdmin)(),k=(0,e.getSql)();if(!j||!k||!(0,d.canAccessAdminBilling)(j.role))return null;let l=(b=a.query,(g=b?.trim()??"")&&g.length<=160?g:null),m=l?`%${l}%`:null,n=(c=a.status,i=c?.trim()??"",["trialing","active","past_due","canceled","none"].includes(i)?i:null),o=await k`
    with billing_rows as (
      select
        w.id,
        w.slug,
        w.name as workspace_name,
        w.company_name as workspace_company_name,
        coalesce(ws.company_name, w.company_name, w.name) as company_name,
        p.id as workspace_plan_id,
        p.plan_key,
        case
          when wbs.stripe_subscription_id is not null then wbs.status
          else p.status
        end as subscription_status,
        case
          when wbs.stripe_subscription_id is not null then wbs.current_period_start
          else p.current_period_start
        end as current_period_start,
        case
          when wbs.stripe_subscription_id is not null then wbs.current_period_end
          else p.current_period_end
        end as current_period_end,
        (p.id is null) as missing_subscription,
        (wbs.stripe_subscription_id is not null) as stripe_bound,
        case
          when wbs.stripe_subscription_id is not null then 'stripe'
          else 'internal'
        end as billing_source,
        coalesce(wbs.cancel_at_period_end, false) as cancel_at_period_end,
        (
          p.status = 'trialing'
          and p.current_period_end is not null
          and wbs.stripe_subscription_id is null
          and (wbs.id is null or wbs.status in ('pending', 'trialing'))
        ) as trial_extension_allowed
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      left join lateral (
        select id, plan_key, status, current_period_start, current_period_end
        from workspace_plans
        where workspace_id = w.id
        order by created_at desc
        limit 1
      ) p on true
      left join workspace_billing_subscriptions wbs on wbs.workspace_id = w.id
    )
    select
      br.*,
      case
        when br.subscription_status = 'trialing' and br.current_period_end is not null
          then ceil(extract(epoch from (br.current_period_end - now())) / 86400.0)::int
        else null
      end as trial_days_remaining,
      (
        br.subscription_status = 'trialing'
        and br.current_period_end is not null
        and br.current_period_end < now()
      ) as trial_expired,
      (
        br.subscription_status = 'trialing'
        and br.current_period_end is not null
        and br.current_period_end >= now()
        and br.current_period_end <= now() + interval '7 days'
      ) as trial_ending_soon
    from billing_rows br
    where (
      ${m}::text is null
      or br.workspace_name ilike ${m}::text
      or br.slug ilike ${m}::text
      or coalesce(br.company_name, br.workspace_company_name, '') ilike ${m}::text
    )
      and (
        ${n}::text is null
        or (${n}::text = 'canceled' and br.subscription_status in ('canceled', 'cancelled'))
        or coalesce(br.subscription_status, 'none') = ${n}::text
      )
    order by
      case when br.subscription_status = 'past_due' then 0 else 1 end,
      case when br.subscription_status = 'trialing' and br.current_period_end <= now() + interval '7 days' then 0 else 1 end,
      br.company_name asc
  `;return{admin:j,workspaces:o}}[f]=g.then?(await g)():g,a.s(["listAdminBillingWorkspaces",0,h]),c()}catch(a){c(a)}},!1),736900,a=>a.a(async(b,c)=>{try{var d=a.i(907997),e=a.i(395936);a.i(570396);var f=a.i(673727),g=a.i(300089),h=a.i(244446),i=a.i(739601),j=b([g,i]);async function k({children:a}){let b=await (0,i.getPlatformAdmin)();return b||(0,f.redirect)("/logga-in"),(0,h.canAccessAdminBilling)(b.role)||(0,f.redirect)("/admin/saas"),(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)("div",{className:"border-b border-slate-200 bg-white",children:(0,d.jsxs)("nav",{className:"mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-3 text-sm font-semibold sm:px-6 lg:px-8","aria-label":"Billing navigation",children:[(0,d.jsx)(e.default,{href:"/admin/billing",className:"rounded-lg border border-slate-300 px-4 py-2 text-slate-700",children:"Billing overview"}),(0,d.jsx)(e.default,{href:"/admin/billing/alerts",className:"rounded-lg border border-slate-300 px-4 py-2 text-slate-700",children:"Trial & payment alerts"})]})}),a]})}[g,i]=j.then?(await j)():j,a.s(["default",0,k]),c()}catch(a){c(a)}},!1),989644,a=>{a.n(a.i(736900))}];

//# sourceMappingURL=src_0aa43u.._.js.map