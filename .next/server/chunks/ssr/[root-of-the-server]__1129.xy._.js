module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},468954,a=>{"use strict";var b=a.i(907997),c=a.i(295946);function d(a){let b=Number(a);return Number.isFinite(b)?b:0}function e(a){return!!a?.trim()}async function f(){let a=function(a=process.env){let b="production"===a.VERCEL_ENV||"preview"===a.VERCEL_ENV,c=[];c.push({key:"public_form_secret",label:"Public form rate-limit secret",level:b&&!e(a.PUBLIC_FORM_RATE_LIMIT_SECRET)?"critical":"ok",detail:b?e(a.PUBLIC_FORM_RATE_LIMIT_SECRET)?"Configured for this deployed environment.":"Missing. Public submissions fail closed until it is configured.":"Local development may use the documented deterministic fallback."}),c.push({key:"reminder_cron_secret",label:"Reminder scheduler secret",level:b&&!e(a.CRON_SECRET)?"critical":"ok",detail:e(a.CRON_SECRET)?"Configured.":b?"Missing. The booking reminder scheduler cannot authenticate.":"Not required for local development unless scheduler delivery is being tested."}),c.push({key:"brevo",label:"Email/SMS provider",level:b&&!e(a.BREVO_API_KEY)?"warning":"ok",detail:e(a.BREVO_API_KEY)?"Brevo API access is configured.":"Brevo API access is missing; customer notification delivery is not operational."});let d=e(a.STRIPE_SECRET_KEY)&&e(a.STRIPE_WEBHOOK_SECRET);return c.push({key:"stripe",label:"Stripe billing/webhook",level:b&&!d?"critical":"ok",detail:d?"Stripe secret and webhook secret are configured.":"Stripe secret and/or webhook secret is missing."}),c}(),b=(0,c.getSql)();if(!b)return{databaseConnected:!1,configSignals:a,dataSignals:[{key:"database",label:"Database connectivity",level:"critical",detail:"No database connection is configured for this runtime."}],snapshot:null};try{var f;let c=(await b`
      select
        current_user as db_role,
        coalesce((select rolbypassrls from pg_roles where rolname = current_user), false) as role_bypasses_rls,
        (
          select count(*)
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relrowsecurity
        ) as rls_tables,
        (
          select count(*)
          from pg_constraint
          where convalidated
            and conname in (
              'booking_reminders_booking_ws_fk',
              'bookings_customer_ws_fk',
              'bookings_staff_ws_fk',
              'customer_events_customer_ws_fk',
              'customer_events_booking_ws_fk',
              'staff_schedules_staff_ws_fk',
              'staff_time_off_staff_ws_fk',
              'quote_offers_request_ws_fk',
              'service_jobs_quote_request_ws_fk',
              'service_jobs_quote_offer_ws_fk',
              'job_attachments_job_ws_fk',
              'job_events_job_ws_fk',
              'job_notes_job_ws_fk',
              'job_payments_job_ws_fk',
              'job_evidence_job_ws_fk',
              'job_evidence_attachment_ws_fk',
              'website_reviews_invitation_ws_fk'
            )
        ) as tenant_constraints,
        (
          select count(*)
          from booking_reminder_deliveries
          where status = 'failed'
            and coalesce(attempted_at, updated_at) >= now() - interval '24 hours'
        ) as reminder_failed_24h,
        (
          select count(*)
          from booking_reminder_deliveries
          where status = 'pending'
            and scheduled_for < now() - interval '15 minutes'
        ) as reminder_overdue,
        (
          select count(*)
          from workspace_quote_offer_email_deliveries
          where status = 'failed'
            and requested_at >= now() - interval '24 hours'
        ) as offer_email_failed_24h,
        (
          select count(*)
          from workspace_quote_offer_email_deliveries
          where status = 'pending'
            and requested_at < now() - interval '15 minutes'
        ) as offer_email_stale_pending,
        (
          select count(*)
          from workspace_billing_subscriptions
          where status = 'past_due'
        ) as billing_past_due,
        (
          (select count(*) from workspace_settings where workspace_id = 'default')
          + (select count(*) from workspace_services where workspace_id = 'default')
        ) as legacy_default_workspace_rows
    `)[0]??{},e=d(c.tenant_constraints),g=d(c.reminder_failed_24h),h=d(c.reminder_overdue),i=d(c.offer_email_failed_24h),j=d(c.offer_email_stale_pending),k=d(c.billing_past_due),l=d(c.legacy_default_workspace_rows),m=d(c.rls_tables),n=(f=c.role_bypasses_rls,!0===f||"true"===f||"t"===f||1===f||"1"===f),o=[{key:"database",label:"Database connectivity",level:"ok",detail:`Connected as ${String(c.db_role??"unknown")}.`},{key:"tenant_constraints",label:"Tenant relation constraints",level:17===e?"ok":"critical",detail:`${e}/17 validated tenant-aware constraints are active.`},{key:"rls_posture",label:"Database RLS posture",level:n||0===m?"warning":"ok",detail:n?`Runtime role can bypass RLS; ${m} public tables currently have RLS enabled. Composite tenant constraints remain required defense-in-depth.`:`${m} public tables have RLS enabled and the runtime role does not bypass it.`},{key:"reminder_failures",label:"Reminder delivery failures",level:g>0?"warning":"ok",detail:`${g} failed reminder deliveries in the last 24 hours.`},{key:"reminder_overdue",label:"Overdue reminder queue",level:h>0?"critical":"ok",detail:`${h} pending reminders are more than 15 minutes overdue.`},{key:"offer_email_failures",label:"Offer email failures",level:i>0?"warning":"ok",detail:`${i} failed offer emails in the last 24 hours.`},{key:"offer_email_stale",label:"Stale offer email queue",level:j>0?"critical":"ok",detail:`${j} offer email deliveries have been pending for more than 15 minutes.`},{key:"billing_past_due",label:"Past-due subscriptions",level:k>0?"warning":"ok",detail:`${k} Workspace subscriptions are currently past due.`},{key:"legacy_workspace_rows",label:"Legacy default Workspace rows",level:l>0?"warning":"ok",detail:`${l} legacy rows still use workspace_id='default' and block full UUID normalization.`}];return{databaseConnected:!0,configSignals:a,dataSignals:o,snapshot:{dbRole:String(c.db_role??"unknown"),roleBypassesRls:n,rlsTables:m,tenantConstraints:e,reminderFailed:g,reminderOverdue:h,emailFailed:i,emailStale:j,pastDue:k,legacyDefaultRows:l}}}catch(b){return console.error("Failed to read admin operations health",b),{databaseConnected:!1,configSignals:a,dataSignals:[{key:"database_query",label:"Database health query",level:"critical",detail:"The operations health query failed. Check runtime logs and database availability."}],snapshot:null}}}async function g(){let a=await f(),c=[...a.configSignals,...a.dataSignals],d=c.filter(a=>"critical"===a.level).length,e=c.filter(a=>"warning"===a.level).length;return(0,b.jsxs)("main",{style:{padding:24,maxWidth:1100,margin:"0 auto"},children:[(0,b.jsx)("p",{children:(0,b.jsx)("a",{href:"/admin/saas",children:"Back to SaaS dashboard"})}),(0,b.jsx)("h1",{children:"Operations Health"}),(0,b.jsx)("p",{children:"Read-only runtime, delivery and tenant-safety signals."}),(0,b.jsxs)("section",{style:{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24},children:[(0,b.jsxs)("strong",{children:["Critical: ",d]}),(0,b.jsxs)("strong",{children:["Warnings: ",e]}),(0,b.jsxs)("strong",{children:["Database: ",a.databaseConnected?"Connected":"Unavailable"]})]}),(0,b.jsx)("h2",{children:"Runtime configuration"}),a.configSignals.map(a=>(0,b.jsxs)("section",{style:{border:"1px solid #ddd",borderRadius:10,padding:14,marginBottom:10},children:[(0,b.jsxs)("strong",{children:[a.label,": ",a.level.toUpperCase()]}),(0,b.jsx)("p",{children:a.detail})]},a.key)),(0,b.jsx)("h2",{children:"Database and delivery health"}),a.dataSignals.map(a=>(0,b.jsxs)("section",{style:{border:"1px solid #ddd",borderRadius:10,padding:14,marginBottom:10},children:[(0,b.jsxs)("strong",{children:[a.label,": ",a.level.toUpperCase()]}),(0,b.jsx)("p",{children:a.detail})]},a.key))]})}a.s(["default",0,g,"dynamic",0,"force-dynamic"],468954)},136179,a=>{a.n(a.i(468954))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1129.xy._.js.map