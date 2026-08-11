module.exports=[938612,a=>{"use strict";a.s(["calculateQuoteOfferTotals",0,function(a,b){if(!Number.isSafeInteger(a)||a<0)throw Error("Subtotal must be a non-negative safe integer");if(!Number.isInteger(b)||b<0||b>1e4)throw Error("VAT rate must be between 0 and 10000 basis points");let c=Math.round(a*b/1e4),d=a+c;if(!Number.isSafeInteger(d))throw Error("Calculated offer total exceeds the safe integer range");return{subtotalMinor:a,vatRateBasisPoints:b,vatAmountMinor:c,totalMinor:d}},"canEditWorkspaceQuoteOffer",0,function(a){return"draft"===a}])},643954,a=>{"use strict";var b=a.i(666680);let c=/^[A-Za-z0-9_-]{43}$/;function d(a){return`/offert/${encodeURIComponent(a)}`}a.s(["createPublicWorkspaceQuoteOfferToken",0,function(){return(0,b.randomBytes)(32).toString("base64url")},"hashPublicWorkspaceQuoteOfferToken",0,function(a){return(0,b.createHash)("sha256").update(a).digest("hex")},"isPublicWorkspaceQuoteOfferToken",0,function(a){return c.test(a)},"publicWorkspaceQuoteOfferPath",0,d,"publicWorkspaceQuoteOfferPdfPath",0,function(a){return`${d(a)}/pdf`}])},907156,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(938612),g=a.i(643954),h=a.i(87921),i=b([h]);[h]=i.then?(await i)():i;let x=(0,e.resolveDatabaseUrl)();function j(){return x?(0,d.neon)(x):null}async function k(){let a=await (0,h.getUserWorkspaceAccess)();if(!a.ok)throw Error("A valid workspace membership is required for quote offers");return a.workspaceId}function l(a){return null==a?"":String(a)}let y=["not_sent","pending","sent","failed"];function m(a){var b;let c;return{id:l(a.id),quoteRequestId:l(a.quote_request_id),version:Number(a.version),status:l(a.status),currency:l(a.currency),subtotalMinor:Number(a.subtotal_minor),vatRateBasisPoints:Number(a.vat_rate_basis_points),vatAmountMinor:Number(a.vat_amount_minor),totalMinor:Number(a.total_minor),title:l(a.title),terms:l(a.terms),validUntil:l(a.valid_until),sentAt:l(a.sent_at),acceptedAt:l(a.accepted_at),rejectedAt:l(a.rejected_at),publicTokenExpiresAt:l(a.public_token_expires_at),firstViewedAt:l(a.first_viewed_at),responseAt:l(a.response_at),emailDeliveryStatus:(b=a.email_delivery_status,c=l(b),y.includes(c)?c:"not_sent"),emailDeliveryAttempt:Number(a.email_delivery_attempt??0),emailDeliveryRequestedAt:l(a.email_delivery_requested_at),emailDeliveryCompletedAt:l(a.email_delivery_completed_at),emailDeliveryFailureCode:l(a.email_delivery_failure_code),createdAt:l(a.created_at),updatedAt:l(a.updated_at)}}async function n(a){let b=j();if(!b)return[];let c=await k();return(await b`
    select offer.id, offer.quote_request_id, offer.version, offer.status, offer.currency, offer.subtotal_minor,
           offer.vat_rate_basis_points, offer.vat_amount_minor, offer.total_minor, offer.title, offer.terms,
           offer.valid_until, offer.sent_at, offer.accepted_at, offer.rejected_at, offer.public_token_expires_at,
           offer.first_viewed_at, offer.response_at, offer.created_at, offer.updated_at,
           delivery.status as email_delivery_status,
           delivery.attempt as email_delivery_attempt,
           delivery.requested_at as email_delivery_requested_at,
           delivery.completed_at as email_delivery_completed_at,
           delivery.failure_code as email_delivery_failure_code
    from workspace_quote_offers offer
    left join lateral (
      select status, attempt, requested_at, completed_at, failure_code
      from workspace_quote_offer_email_deliveries
      where workspace_id = offer.workspace_id
        and quote_offer_id = offer.id
      order by attempt desc
      limit 1
    ) delivery on true
    where offer.workspace_id = ${c}
      and offer.quote_request_id = ${a}
    order by offer.version desc
  `).map(a=>m(a))}async function o(a,b){let c=j();if(!c)return null;let d=await k(),e=await c`
    select offer.id, offer.quote_request_id, offer.version, offer.status, offer.currency, offer.subtotal_minor,
           offer.vat_rate_basis_points, offer.vat_amount_minor, offer.total_minor, offer.title, offer.terms,
           offer.valid_until, offer.sent_at, offer.accepted_at, offer.rejected_at, offer.public_token_expires_at,
           offer.first_viewed_at, offer.response_at, offer.created_at, offer.updated_at,
           delivery.status as email_delivery_status,
           delivery.attempt as email_delivery_attempt,
           delivery.requested_at as email_delivery_requested_at,
           delivery.completed_at as email_delivery_completed_at,
           delivery.failure_code as email_delivery_failure_code
    from workspace_quote_offers offer
    left join lateral (
      select status, attempt, requested_at, completed_at, failure_code
      from workspace_quote_offer_email_deliveries
      where workspace_id = offer.workspace_id
        and quote_offer_id = offer.id
      order by attempt desc
      limit 1
    ) delivery on true
    where offer.workspace_id = ${d}
      and offer.quote_request_id = ${a}
      and offer.id = ${b}
    limit 1
  `;return e[0]?m(e[0]):null}async function p(a,b,c,d){return a`
    insert into workspace_quote_offers (
      workspace_id, quote_request_id, version, status, currency,
      subtotal_minor, vat_rate_basis_points, vat_amount_minor, total_minor,
      title, terms, valid_until
    )
    select
      q.workspace_id,
      q.id,
      coalesce((
        select max(existing.version)
        from workspace_quote_offers existing
        where existing.workspace_id = q.workspace_id
          and existing.quote_request_id = q.id
      ), 0) + 1,
      'draft',
      ${d.currency},
      ${d.subtotalMinor},
      ${d.vatRateBasisPoints},
      ${d.vatAmountMinor},
      ${d.totalMinor},
      ${d.title},
      ${d.terms},
      ${d.validUntil}
    from workspace_quote_requests q
    join workspace_settings settings
      on settings.workspace_id = q.workspace_id::text
     and settings.billing_currency = ${d.currency}
    where q.id = ${c}
      and q.workspace_id = ${b}
      and q.status in ('submitted', 'reviewing')
    returning id, version
  `}async function q(a,b){let c,d=j();if(!d)throw Error("Missing database connection for quote offer creation");let e=await k();try{c=await p(d,e,a,b)}catch(g){let f="object"==typeof g&&g&&"code"in g?String(g.code):"";if("23505"!==f)throw g;c=await p(d,e,a,b)}if(!c[0])throw Error("Quote request or workspace billing currency was not valid for a draft offer");return await d`
    update workspace_quote_requests
    set status = 'reviewing', updated_at = now()
    where id = ${a}
      and workspace_id = ${e}
      and status = 'submitted'
  `,{id:String(c[0].id),version:Number(c[0].version)}}async function r(a,b,c,d){let e=j();if(!e)throw Error("Missing database connection for quote offer update");let g=await k(),h=(await e`
    select status, currency
    from workspace_quote_offers
    where workspace_id = ${g}
      and quote_request_id = ${a}
      and id = ${b}
    limit 1
  `)[0];if(!h)throw Error("Quote offer was not found for the active workspace");let i=String(h.status);if(!(0,f.canEditWorkspaceQuoteOffer)(i))throw Error("Only draft offers can be edited");if(String(h.currency)!==d.currency)throw Error("Offer currency cannot be changed");let l=await e`
    update workspace_quote_offers
    set subtotal_minor = ${d.subtotalMinor},
        vat_rate_basis_points = ${d.vatRateBasisPoints},
        vat_amount_minor = ${d.vatAmountMinor},
        total_minor = ${d.totalMinor},
        title = ${d.title},
        terms = ${d.terms},
        valid_until = ${d.validUntil},
        updated_at = now()
    where workspace_id = ${g}
      and quote_request_id = ${a}
      and id = ${b}
      and status = 'draft'
      and updated_at = ${c}
    returning id, updated_at
  `;if(!l[0])throw Error("The draft changed before the update completed");return{id:String(l[0].id),updatedAt:String(l[0].updated_at)}}async function s(a,b,c){let d=j();if(!d)throw Error("Missing database connection for quote offer delivery");let e=await k(),f=(0,g.createPublicWorkspaceQuoteOfferToken)(),h=(0,g.hashPublicWorkspaceQuoteOfferToken)(f),[,,i]=await d.transaction(d=>[d`
    with prepared_offer as (
      update workspace_quote_offers offer
      set
        status = case when ${c} = 'initial' then 'sent' else offer.status end,
        sent_at = case when ${c} = 'initial' then now() else offer.sent_at end,
        public_token_hash = ${h},
        public_token_expires_at = coalesce(
          (offer.valid_until + 1)::timestamptz,
          now() + interval '30 days'
        ),
        email_delivery_attempts = offer.email_delivery_attempts + 1,
        updated_at = now()
      from workspace_quote_requests request
      where offer.id = ${b}
        and offer.quote_request_id = ${a}
        and offer.workspace_id = ${e}
        and request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and nullif(trim(request.customer_email), '') is not null
        and (
          (${c} = 'initial' and offer.status = 'draft' and request.status in ('submitted', 'reviewing'))
          or (${c} = 'resend' and offer.status = 'sent' and request.status = 'quoted')
        )
      returning
        offer.id as offer_id,
        offer.workspace_id,
        offer.quote_request_id
    )
    update workspace_quote_requests request
    set status = 'quoted', updated_at = now()
    from prepared_offer offer
    where ${c} = 'initial'
      and request.id = offer.quote_request_id
      and request.workspace_id = offer.workspace_id
      and request.status in ('submitted', 'reviewing')
    returning request.id
  `,d`
    update workspace_quote_offer_email_deliveries delivery
    set status = 'failed', failure_code = 'superseded', completed_at = now()
    where delivery.workspace_id = ${e}
      and delivery.quote_offer_id = ${b}
      and delivery.status = 'pending'
    returning delivery.id
  `,d`
    with created_delivery as (
      insert into workspace_quote_offer_email_deliveries (
        workspace_id,
        quote_offer_id,
        attempt,
        status
      )
      select offer.workspace_id, offer.id, offer.email_delivery_attempts, 'pending'
      from workspace_quote_offers offer
      join workspace_quote_requests request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      where offer.id = ${b}
        and offer.quote_request_id = ${a}
        and offer.workspace_id = ${e}
        and offer.public_token_hash = ${h}
        and offer.status = 'sent'
        and request.status = 'quoted'
        and nullif(trim(request.customer_email), '') is not null
      returning workspace_id, quote_offer_id, attempt
    )
    select
      offer.public_token_hash,
      offer.public_token_expires_at,
      offer.email_delivery_attempts,
      offer.currency,
      offer.subtotal_minor,
      offer.vat_rate_basis_points,
      offer.vat_amount_minor,
      offer.total_minor,
      offer.title,
      offer.terms,
      offer.valid_until,
      offer.sent_at,
      request.reference_id,
      request.customer_name,
      request.customer_email,
      coalesce(nullif(workspace.company_name, ''), workspace.name) as company_name,
      delivery.attempt
    from workspace_quote_offers offer
    join workspace_quote_requests request
      on request.id = offer.quote_request_id
     and request.workspace_id = offer.workspace_id
    join workspaces workspace on workspace.id = offer.workspace_id
    join created_delivery delivery
      on delivery.workspace_id = offer.workspace_id
     and delivery.quote_offer_id = offer.id
     and delivery.attempt = offer.email_delivery_attempts
    where offer.id = ${b}
      and offer.quote_request_id = ${a}
      and offer.workspace_id = ${e}
      and offer.public_token_hash = ${h}
  `]),m=i[0];if(!m?.public_token_expires_at||!m.public_token_hash)throw Error("Quote offer could not be prepared for email delivery");return{token:f,tokenHash:l(m.public_token_hash),expiresAt:l(m.public_token_expires_at),attempt:Number(m.attempt),customerName:l(m.customer_name),customerEmail:l(m.customer_email),companyName:l(m.company_name),quoteReferenceId:l(m.reference_id),currency:l(m.currency),subtotalMinor:Number(m.subtotal_minor),vatRateBasisPoints:Number(m.vat_rate_basis_points),vatAmountMinor:Number(m.vat_amount_minor),totalMinor:Number(m.total_minor),title:l(m.title),terms:l(m.terms),validUntil:l(m.valid_until),sentAt:l(m.sent_at)}}async function t(a,b,c,d){let e=j();if(!e)throw Error("Missing database connection for quote offer email completion");let f=await k(),g="sent"===d.status?d.providerMessageId?.slice(0,512)??null:null,h="failed"===d.status?d.failureCode:null;return!!(await e`
    update workspace_quote_offer_email_deliveries delivery
    set
      status = ${d.status},
      provider_message_id = ${g},
      failure_code = ${h},
      completed_at = now()
    from workspace_quote_offers offer
    where delivery.workspace_id = ${f}
      and delivery.quote_offer_id = ${a}
      and delivery.attempt = ${b}
      and delivery.status = 'pending'
      and offer.id = delivery.quote_offer_id
      and offer.workspace_id = delivery.workspace_id
      and offer.public_token_hash = ${c}
    returning delivery.id
  `)[0]}async function u(a){var b;if(!(0,g.isPublicWorkspaceQuoteOfferToken)(a))return null;let c=j();if(!c)return null;let d=(0,g.hashPublicWorkspaceQuoteOfferToken)(a),e=await c`
    with visible_offer as (
      select offer.id
      from workspace_quote_offers offer
      join workspace_quote_requests request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      where offer.public_token_hash = ${d}
        and offer.public_token_expires_at > now()
        and (offer.valid_until is null or offer.valid_until >= current_date)
        and (
          (offer.status = 'sent' and request.status = 'quoted')
          or (offer.status = 'accepted' and request.status = 'accepted')
          or (offer.status = 'rejected' and request.status = 'rejected')
        )
      limit 1
    ),
    mark_first_view as (
      update workspace_quote_offers offer
      set first_viewed_at = coalesce(offer.first_viewed_at, now())
      where offer.id in (select id from visible_offer)
        and offer.status = 'sent'
      returning offer.id
    )
    select
      offer.status,
      coalesce(nullif(workspace.company_name, ''), workspace.name) as company_name,
      request.reference_id,
      request.customer_name,
      offer.currency,
      offer.subtotal_minor,
      offer.vat_rate_basis_points,
      offer.vat_amount_minor,
      offer.total_minor,
      offer.title,
      offer.terms,
      offer.valid_until,
      offer.public_token_expires_at,
      offer.sent_at,
      offer.accepted_at,
      offer.rejected_at,
      offer.response_at
    from workspace_quote_offers offer
    join visible_offer visible on visible.id = offer.id
    join workspace_quote_requests request
      on request.id = offer.quote_request_id
     and request.workspace_id = offer.workspace_id
    join workspaces workspace on workspace.id = offer.workspace_id
    limit 1
  `;return e[0]?(b=e[0],{status:l(b.status),companyName:l(b.company_name),quoteReferenceId:l(b.reference_id),customerName:l(b.customer_name),currency:l(b.currency),subtotalMinor:Number(b.subtotal_minor),vatRateBasisPoints:Number(b.vat_rate_basis_points),vatAmountMinor:Number(b.vat_amount_minor),totalMinor:Number(b.total_minor),title:l(b.title),terms:l(b.terms),validUntil:l(b.valid_until),publicTokenExpiresAt:l(b.public_token_expires_at),sentAt:l(b.sent_at),acceptedAt:l(b.accepted_at),rejectedAt:l(b.rejected_at),responseAt:l(b.response_at)}):null}async function v(a,b){if(!(0,g.isPublicWorkspaceQuoteOfferToken)(a))return{ok:!1};let c=j();if(!c)return{ok:!1};let d=(0,g.hashPublicWorkspaceQuoteOfferToken)(a);return(await c`
    with responded_offer as (
      update workspace_quote_offers offer
      set
        status = ${b},
        accepted_at = case when ${b} = 'accepted' then now() else offer.accepted_at end,
        rejected_at = case when ${b} = 'rejected' then now() else offer.rejected_at end,
        response_at = now(),
        updated_at = now()
      from workspace_quote_requests request
      where offer.public_token_hash = ${d}
        and offer.status = 'sent'
        and offer.public_token_expires_at > now()
        and (offer.valid_until is null or offer.valid_until >= current_date)
        and request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and request.status = 'quoted'
      returning
        offer.id as offer_id,
        offer.quote_request_id,
        offer.workspace_id,
        offer.title,
        offer.currency,
        offer.total_minor
    )
    , responded_request as (
      update workspace_quote_requests request
      set status = ${b}, updated_at = now()
      from responded_offer offer
      where request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and request.status = 'quoted'
      returning
        request.id,
        request.workspace_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        request.city,
        request.description
    )
    , existing_customer as (
      select customer.id
      from customers customer
      join responded_request request
        on customer.workspace_id = request.workspace_id::text
       and lower(customer.email) = lower(request.customer_email)
      where ${b} = 'accepted'
        and nullif(trim(request.customer_email), '') is not null
      order by customer.created_at asc
      limit 1
    )
    , created_customer as (
      insert into customers (
        workspace_id,
        name,
        email,
        phone,
        city,
        status,
        source
      )
      select
        request.workspace_id::text,
        request.customer_name,
        request.customer_email,
        nullif(trim(request.customer_phone), ''),
        nullif(trim(request.city), ''),
        'active',
        'quote_offer'
      from responded_request request
      where ${b} = 'accepted'
        and not exists (select 1 from existing_customer)
      returning id
    )
    , customer_for_job as (
      select id from existing_customer
      union all
      select id from created_customer
    )
    , created_job as (
      insert into workspace_service_jobs (
        workspace_id,
        source_type,
        quote_request_id,
        quote_offer_id,
        customer_id,
        status,
        title,
        description,
        service_name,
        city,
        currency,
        total_minor
      )
      select
        offer.workspace_id,
        'quote_offer',
        offer.quote_request_id,
        offer.offer_id,
        customer.id,
        'new',
        offer.title,
        request.description,
        offer.title,
        nullif(trim(request.city), ''),
        offer.currency,
        offer.total_minor
      from responded_offer offer
      join responded_request request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      join customer_for_job customer on true
      where ${b} = 'accepted'
      on conflict (quote_offer_id) where quote_offer_id is not null do nothing
      returning id, workspace_id, quote_offer_id, customer_id
    )
    , job_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        to_status,
        summary,
        metadata
      )
      select
        workspace_id,
        id,
        'created',
        'new',
        'Service job created from accepted quote offer.',
        jsonb_build_object('source', 'accepted_quote_offer', 'quote_offer_id', quote_offer_id)
      from created_job
      returning id
    )
    , customer_event as (
      insert into customer_events (
        workspace_id,
        customer_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        request.workspace_id::text,
        job.customer_id,
        'status_change',
        'Quote offer accepted',
        'A service job was created from the accepted quote offer.',
        jsonb_build_object('source', 'accepted_quote_offer', 'service_job_id', job.id, 'quote_offer_id', job.quote_offer_id)
      from created_job job
      join responded_request request on request.workspace_id = job.workspace_id
      returning id
    )
    select id from responded_request
  `)[0]?{ok:!0,response:b}:{ok:!1}}async function w(){let a=j();if(!a)throw Error("Missing database connection for workspace currency");let b=await k(),c=await a`
    select billing_currency
    from workspace_settings
    where workspace_id = ${b}
    limit 1
  `,d=c[0]?.billing_currency?String(c[0].billing_currency):"";if(!["SEK","EUR","GBP"].includes(d))throw Error("Workspace billing currency is not configured");return d}a.s(["completeDashboardWorkspaceQuoteOfferEmailDelivery",0,t,"createDashboardWorkspaceQuoteOfferDraft",0,q,"getDashboardWorkspaceBillingCurrency",0,w,"getDashboardWorkspaceQuoteOffer",0,o,"getDashboardWorkspaceQuoteOffers",0,n,"getPublicWorkspaceQuoteOffer",0,u,"prepareDashboardWorkspaceQuoteOfferEmailDelivery",0,s,"respondToPublicWorkspaceQuoteOffer",0,v,"updateDashboardWorkspaceQuoteOfferDraft",0,r]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=src_lib_12yev2n._.js.map