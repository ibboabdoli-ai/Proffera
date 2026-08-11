module.exports=[586786,290923,e=>{"use strict";var t=e.i(666680),r=e.i(276269),a=e.i(283653),i=e.i(95524);let o=["organizationNumber","legalName","legalForm","organizationStatus","isActive","fTaxStatus","vatStatus","employerStatus","primarySniCode","primarySniLabel","activityDescription","addressLine1","postalCode","city","municipality","region"];function n(e,t,r){let a=Number(e);return Number.isFinite(a)?Math.max(1,Math.min(r,Math.floor(a))):t}async function s(e){let t=(0,r.getSql)();if(!t)return"";let a=await t`
    select cursor_value
    from company_directory_sync_runs
    where provider = ${e} and status = 'completed'
    order by completed_at desc nulls last, started_at desc
    limit 1
  `;return String(a[0]?.cursor_value??"")}async function c(e){let t=(0,r.getSql)();if(!t)throw Error("Database is not configured");await t`
    update company_directory_sync_runs
    set status = 'failed',
        error_count = greatest(error_count, 1),
        error_summary = case
          when error_summary = '' then 'stale sync lease recovered automatically'
          else error_summary
        end,
        completed_at = now()
    where provider = ${e}
      and status = 'running'
      and started_at < now() - interval '15 minutes'
  `;let a=await t`
    insert into company_directory_sync_runs (provider, status)
    values (${e}, 'running')
    on conflict do nothing
    returning id::text
  `,i=String(a[0]?.id??"");if(!i)throw Error("Company directory sync already running");return i}async function u(e){let i=(0,r.getSql)();if(!i)throw Error("Database is not configured");let n=(0,a.assessDirectoryCandidate)(e),s="ready"===n.publicationStatus&&process.env.COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase()==="true"?"published":n.publicationStatus,c=(0,a.buildDirectoryPublicSlug)(e),u=JSON.stringify(n.category?.serviceSlugs??[]),d=JSON.stringify(n.reasons),l=e.sourceUpdatedAt?.toISOString()??null,_=await i`
    insert into company_directory_profiles (
      country_code, organization_number, organization_kind, legal_name, display_name,
      legal_form, organization_status, is_active, f_tax_status, vat_status, employer_status,
      primary_sni_code, primary_sni_label, category_slug, service_slugs, activity_description,
      address_line1, postal_code, city, municipality, region, public_slug,
      publication_status, quality_score, quality_reasons, privacy_blocked, auto_public_eligible,
      official_source, source_record_id, source_updated_at, last_synced_at, published_at
    ) values (
      ${e.countryCode}, ${e.organizationNumber}, ${e.organizationKind}, ${e.legalName}, ${e.displayName},
      ${e.legalForm}, ${e.organizationStatus}, ${e.isActive}, ${e.fTaxStatus}, ${e.vatStatus}, ${e.employerStatus},
      ${e.primarySniCode}, ${e.primarySniLabel}, ${n.category?.categorySlug??""},
      array(select jsonb_array_elements_text(${u}::jsonb)), ${e.activityDescription},
      ${e.addressLine1}, ${e.postalCode}, ${e.city}, ${e.municipality}, ${e.region}, ${c},
      ${s}, ${n.score}, ${d}::jsonb, ${n.privacyBlocked}, ${n.autoPublicEligible},
      ${e.officialSource}, ${e.sourceRecordId}, ${l}::timestamptz, now(),
      case when ${s} = 'published' then now() else null end
    )
    on conflict (country_code, organization_number) do update set
      organization_kind = excluded.organization_kind,
      legal_name = excluded.legal_name,
      display_name = case when company_directory_profiles.claimed_workspace_id is null then excluded.display_name else company_directory_profiles.display_name end,
      legal_form = excluded.legal_form,
      organization_status = excluded.organization_status,
      is_active = excluded.is_active,
      f_tax_status = excluded.f_tax_status,
      vat_status = excluded.vat_status,
      employer_status = excluded.employer_status,
      primary_sni_code = excluded.primary_sni_code,
      primary_sni_label = excluded.primary_sni_label,
      category_slug = excluded.category_slug,
      service_slugs = excluded.service_slugs,
      activity_description = excluded.activity_description,
      address_line1 = excluded.address_line1,
      postal_code = excluded.postal_code,
      city = excluded.city,
      municipality = excluded.municipality,
      region = excluded.region,
      publication_status = case
        when company_directory_profiles.claimed_workspace_id is not null then 'claimed'
        else excluded.publication_status
      end,
      quality_score = excluded.quality_score,
      quality_reasons = excluded.quality_reasons,
      privacy_blocked = excluded.privacy_blocked,
      auto_public_eligible = excluded.auto_public_eligible,
      official_source = excluded.official_source,
      source_record_id = excluded.source_record_id,
      source_updated_at = coalesce(excluded.source_updated_at, company_directory_profiles.source_updated_at),
      last_synced_at = now(),
      published_at = case
        when company_directory_profiles.claimed_workspace_id is not null then company_directory_profiles.published_at
        when excluded.publication_status = 'published' then coalesce(company_directory_profiles.published_at, now())
        else null
      end,
      updated_at = now()
    returning id::text, publication_status, category_slug
  `,p=String(_[0]?.id??"");if(!p)throw Error(`Directory upsert failed for ${e.organizationNumber}`);let y=JSON.stringify(o.map(r=>{var a;let i;return{fieldName:String(r),valueHash:(i=(a=e[r])instanceof Date?a.toISOString():JSON.stringify(a??null),(0,t.createHash)("sha256").update(i).digest("hex"))}}));await i`
    insert into company_directory_field_sources (
      profile_id, field_name, source_name, source_record_id, value_hash, confidence, observed_at
    )
    select
      ${p}::uuid,
      item->>'fieldName',
      ${e.officialSource},
      ${e.sourceRecordId},
      item->>'valueHash',
      100,
      now()
    from jsonb_array_elements(${y}::jsonb) item
    on conflict (profile_id, field_name, source_name, value_hash)
    do update set observed_at = excluded.observed_at
  `;let m=String(_[0]?.category_slug??"");if(m){let e=`/api/public-directory/category-image/${encodeURIComponent(m)}`;await i`
      update company_directory_media
      set is_primary = false,
          publication_status = 'rejected',
          updated_at = now()
      where profile_id = ${p}::uuid
        and source_type = 'generated_category'
        and publication_status = 'published'
        and public_url <> ${e}
    `,await i`
      insert into company_directory_media (
        profile_id, media_kind, source_type, public_url, attribution, license_status,
        rights_confirmed_at, is_actual_business_media, is_primary, publication_status
      )
      select ${p}::uuid, 'category_illustration', 'generated_category', ${e},
        'Illustrationsbild från Proffera', 'generated', now(), false,
        not exists (
          select 1 from company_directory_media media
          where media.profile_id = ${p}::uuid
            and media.publication_status = 'published'
            and media.is_primary = true
        ),
        'published'
      where not exists (
        select 1 from company_directory_media media
        where media.profile_id = ${p}::uuid
          and media.source_type = 'generated_category'
          and media.public_url = ${e}
          and media.publication_status = 'published'
      )
    `}return{profileId:p,publicationStatus:String(_[0]?.publication_status??s),blocked:n.privacyBlocked||"blocked"===n.publicationStatus}}async function d(e){let t=(0,r.getSql)();t&&await t`
    update company_directory_sync_runs
    set status = ${e.failed?"failed":"completed"},
        cursor_value = ${e.cursor},
        scanned_count = ${e.scanned},
        upserted_count = ${e.upserted},
        published_count = ${e.published},
        blocked_count = ${e.blocked},
        error_count = ${e.errors},
        error_summary = ${e.errorSummary??""},
        completed_at = now()
    where id = ${e.runId}::uuid
  `}async function l(){if(!(0,r.getSql)())throw Error("Database is not configured");let e=process.env.COMPANY_DIRECTORY_PROVIDER?.trim()||"bolagsverket_vardefulla_datamangder",t=await s(e),a=await c(e),o=n(process.env.COMPANY_DIRECTORY_MAX_PAGES_PER_RUN,2,2),l=n(process.env.COMPANY_DIRECTORY_BATCH_SIZE,10,10),_=t,p=t||null,y=0,m=0,f=0,g=0,h=0,v=[];try{for(let e=0;e<o;e+=1){let e=await (0,i.fetchOfficialCompanyDirectoryBatch)({cursor:_,limit:l});for(let t of(y+=e.items.length,e.items))try{let e=await (0,i.verifyOfficialCompanyCandidate)(t),r=await u(e);m+=1,"published"===r.publicationStatus&&(f+=1),r.blocked&&(g+=1)}catch(e){h+=1,v.length<8&&v.push(e instanceof Error?e.message:"Unknown candidate error")}if(!(p=e.nextCursor)||p===_){_="";break}_=p}return await d({runId:a,cursor:p??"",scanned:y,upserted:m,published:f,blocked:g,errors:h,errorSummary:v.join(" | ")}),{provider:e,scanned:y,upserted:m,published:f,blocked:g,errors:h,nextCursor:p,runId:a}}catch(t){let e=t instanceof Error?t.message:"Unknown company directory sync error";throw await d({runId:a,cursor:_,scanned:y,upserted:m,published:f,blocked:g,errors:h+1,errorSummary:[e,...v].slice(0,8).join(" | "),failed:!0}),t}}function _(e){return null==e?"":String(e).trim()}function p(e){return _(e).replace(/\D/g,"")}function y(e){return _(e).slice(0,120)||"bolagsverket_vardefulla_datamangder"}async function m(e){let t,a=(0,r.getSql)();if(!a)throw Error("Database is not configured");let i=y(e.provider),o=function(e){let t=_(e);if(!t)return"";try{let e=new URL(t),r=e.hostname.toLowerCase();if("https:"!==e.protocol||"bolagsverket.se"!==r&&!r.endsWith(".bolagsverket.se"))return"";return e.toString().slice(0,2e3)}catch{return""}}(e.sourceUrl),n=(t=_(e.fingerprint).toLowerCase(),/^[a-f0-9]{32,128}$/.test(t)?t:"");if(!o)throw Error("An official Bolagsverket source URL is required");if(!n)throw Error("A valid discovery fingerprint is required");let s=[...new Set(e.organizationNumbers.map(p).filter(e=>10===e.length))].slice(0,500),c=Math.max(0,Math.floor(Number(e.discoveredCount)||0)),u=Math.max(s.length,Math.floor(Number(e.acceptedCount)||0)),d=JSON.stringify(s);return await a.transaction(t=>[t`
      insert into company_directory_source_snapshots (
        provider, source_url, fingerprint, status, discovered_count, accepted_count,
        first_seen_at, last_seen_at, completed_at
      ) values (
        ${i}, ${o}, ${n}, ${e.final?"completed":"processing"},
        ${c}, ${u}, now(), now(),
        case when ${!!e.final} then now() else null end
      )
      on conflict (provider, fingerprint) do update set
        source_url = case when excluded.source_url <> '' then excluded.source_url else company_directory_source_snapshots.source_url end,
        status = case when excluded.status = 'completed' then 'completed' else company_directory_source_snapshots.status end,
        discovered_count = greatest(company_directory_source_snapshots.discovered_count, excluded.discovered_count),
        accepted_count = greatest(company_directory_source_snapshots.accepted_count, excluded.accepted_count),
        last_seen_at = now(),
        completed_at = case when excluded.status = 'completed' then now() else company_directory_source_snapshots.completed_at end
    `,t`
      insert into company_directory_discovery_queue (
        country_code, organization_number, provider, source_fingerprint, source_url,
        state, attempt_count, next_attempt_at, first_seen_at, last_seen_at
      )
      select
        'SE', item.value, ${i}, ${n}, ${o},
        'pending_verify', 0, now(), now(), now()
      from jsonb_array_elements_text(${d}::jsonb) item(value)
      on conflict (country_code, organization_number) do update set
        provider = excluded.provider,
        source_url = case when excluded.source_url <> '' then excluded.source_url else company_directory_discovery_queue.source_url end,
        last_seen_at = now(),
        state = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint
            and company_directory_discovery_queue.state <> 'claimed'
            then 'pending_verify'
          else company_directory_discovery_queue.state
        end,
        attempt_count = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint then 0
          else company_directory_discovery_queue.attempt_count
        end,
        next_attempt_at = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint then now()
          else company_directory_discovery_queue.next_attempt_at
        end,
        source_fingerprint = excluded.source_fingerprint,
        last_error = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint then ''
          else company_directory_discovery_queue.last_error
        end
    `]),{provider:i,fingerprint:n,accepted:s.length,acceptedTotal:u,final:!!e.final}}async function f(){let e=(0,r.getSql)();if(!e)throw Error("Database is not configured");await e`
    update company_directory_discovery_queue
    set state = case when attempt_count >= ${5} then 'failed' else 'pending_verify' end,
        locked_at = null,
        lock_token = null,
        next_attempt_at = case
          when attempt_count >= ${5} then now() + interval '24 hours'
          else now()
        end,
        last_error = case
          when last_error = '' then 'verification lease expired before completion'
          else last_error
        end
    where state = 'processing'
      and locked_at < now() - (${15}::text || ' minutes')::interval
  `}async function g(e){let a=(0,r.getSql)();if(!a)throw Error("Database is not configured");let i=(0,t.randomUUID)();return(await a`
    with candidates as (
      select id
      from company_directory_discovery_queue
      where state = 'pending_verify'
        and next_attempt_at <= now()
      order by first_seen_at asc, organization_number asc
      for update skip locked
      limit ${e}
    )
    update company_directory_discovery_queue queue
    set state = 'processing',
        attempt_count = queue.attempt_count + 1,
        locked_at = now(),
        lock_token = ${i}::uuid
    from candidates
    where queue.id = candidates.id
    returning
      queue.id::text,
      queue.organization_number,
      queue.provider,
      queue.attempt_count,
      queue.lock_token::text
  `).map(e=>({id:_(e.id),organizationNumber:p(e.organization_number),provider:y(e.provider),attemptCount:Number(e.attempt_count)||1,lockToken:_(e.lock_token)}))}async function h(e){let t=(0,r.getSql)();t&&await t`
    update company_directory_discovery_queue
    set state = ${e.state},
        profile_id = ${e.profileId}::uuid,
        verified_at = now(),
        locked_at = null,
        lock_token = null,
        last_error = '',
        next_attempt_at = now()
    where id = ${e.id}::uuid
      and lock_token = ${e.lockToken}::uuid
  `}async function v(e){let t=(0,r.getSql)();if(!t)return;let a=e.attemptCount>=5,i=a?1440:Math.min(360,2**Math.max(0,e.attemptCount-1));await t`
    update company_directory_discovery_queue
    set state = ${a?"failed":"pending_verify"},
        locked_at = null,
        lock_token = null,
        last_error = ${e.error.slice(0,1e3)},
        next_attempt_at = now() + (${i}::text || ' minutes')::interval
    where id = ${e.id}::uuid
      and lock_token = ${e.lockToken}::uuid
  `}async function b(e){let t,a,o,n;if(!(0,r.getSql)())throw Error("Database is not configured");if(t=process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim(),a=process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN?.trim(),o=process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()&&process.env.BOLAGSVERKET_CLIENT_ID?.trim()&&process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),!t||!a&&!o)throw Error("Automatic discovery requires official detail verification and credentials");await f();let s=Number.isFinite(n=Number(e??process.env.COMPANY_DIRECTORY_QUEUE_BATCH_SIZE))?Math.max(1,Math.min(20,Math.floor(n))):15,c=await g(s),d=0,l=0,_=0,p=0,y=[];for(let e of c)try{var m,b;let t=await (0,i.verifyOfficialCompanyCandidate)((m=e.organizationNumber,b=`${e.provider}:discovery`,{countryCode:"SE",organizationNumber:m,organizationKind:"unknown",legalName:"",displayName:"",legalForm:"",organizationStatus:"",isActive:!1,fTaxStatus:"",vatStatus:"",employerStatus:"",primarySniCode:"",primarySniLabel:"",activityDescription:"",addressLine1:"",postalCode:"",city:"",municipality:"",region:"",officialSource:b,sourceRecordId:m,sourceUpdatedAt:null})),r=await u(t);await h({id:e.id,lockToken:e.lockToken,state:r.publicationStatus,profileId:r.profileId}),d+=1,"published"===r.publicationStatus&&(l+=1),r.blocked&&(_+=1)}catch(r){let t=r instanceof Error?r.message:"Unknown queue processing error";await v({id:e.id,lockToken:e.lockToken,attemptCount:e.attemptCount,error:t}),p+=1,y.length<8&&y.push(`${e.organizationNumber}: ${t}`)}return{claimed:c.length,processed:d,published:l,blocked:_,errors:p,errorSummary:y.join(" | ")}}e.s(["syncCompanyDirectory",0,l,"upsertCompanyDirectoryCandidate",0,u],290923),e.s(["enqueueCompanyDirectoryCandidates",0,m,"processCompanyDirectoryDiscoveryQueue",0,b],586786)}];

//# sourceMappingURL=src_lib_company-directory-discovery-queue_ts_0mb2lnr._.js.map