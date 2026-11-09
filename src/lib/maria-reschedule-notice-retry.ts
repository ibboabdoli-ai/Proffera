import "server-only";

import { sendBookingChangeEmails } from "@/features/email/booking-change-email";
import { sendBookingRescheduleEmail } from "@/features/email/booking-reschedule-email";
import { createCustomerCalendarToken } from "@/lib/customer-calendar";
import { getSql } from "@/lib/db/server";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { withMariaBookingNotificationLock } from "@/lib/maria-booking-notification-lock";
import { getMariaBookingPortalBase, isMariaBookingRecipientAllowed } from "@/lib/maria-preview-customer-safety";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Notice=Record<string,unknown>;
type Meta=Record<string,unknown>;
const metadata=(value:unknown):Meta=>value && typeof value==="object" && !Array.isArray(value)
  ? value as Meta : {};
// Age alone is never proof of non-delivery: a timed-out HTTP request may
// have been accepted by Brevo. Only proven unsent/pending notices can retry.
const retryable=(state:unknown,_attempt:unknown)=>state==="pending" || state==="failed";

async function currentNotice(id:string,workspaceId:string):Promise<Notice|null>{
  if(!uuid.test(id)||!uuid.test(workspaceId))return null;
  const sql=getSql();
  if(!sql)return null;
  const rows=await sql`
    with newest as (
      select e.id,e.workspace_id,e.booking_id,e.metadata from customer_events e
      where e.workspace_id=${workspaceId} and e.booking_id=${id}::uuid
        and e.event_type='booking' and e.metadata->>'source' in ('maria_preview_reschedule','maria_manager_dashboard_reschedule')
      order by e.created_at desc,e.id desc limit 1
    )
    select n.id::text as event_id,n.metadata,
      b.customer_id::text as customer_id,b.starts_at,b.ends_at,
      c.name as customer_name,c.email as customer_email,
      s.name as service_name,b.city,
      coalesce(nullif(ws.company_name,''),w.company_name,w.name) as company_name,
      nullif(ws.contact_email,'') as owner_email
    from newest n
    join bookings b on b.id=n.booking_id and b.workspace_id=n.workspace_id
    join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
    join workspaces w on w.id::text=b.workspace_id
    join workspace_services s on s.id=b.service_id and s.workspace_id=b.workspace_id
    left join workspace_settings ws on ws.workspace_id=b.workspace_id
    where b.workspace_id=${workspaceId} and b.source='public_booking'
      and b.status in ('requested','confirmed') and w.slug='makeup-by-maria'
      and b.starts_at=(n.metadata->>'starts_at')::timestamptz
      and b.ends_at=(n.metadata->>'ends_at')::timestamptz
      and (n.metadata->>'notice_revision' is null
        or date_trunc('milliseconds',b.updated_at)=(n.metadata->>'notice_revision')::timestamptz)
    limit 1
  `;
  return rows[0] as Notice|undefined ?? null;
}
function targets(row:Notice){
  const m=metadata(row.metadata);
  return {m,customer:isMariaBookingRecipientAllowed(String(row.customer_email??""))
      &&retryable(m.notice_customer,m.notice_attempted_at),
    owner:m.source!=="maria_manager_dashboard_reschedule"
      &&Boolean(row.owner_email) &&isMariaBookingRecipientAllowed(String(row.owner_email))
      &&retryable(m.notice_owner,m.notice_attempted_at)};
}
export async function hasPendingMariaRescheduleNotice(id:string,workspaceId:string){
  try{const row=await currentNotice(id,workspaceId);
    if(!row)return false;
    const t=targets(row);return t.customer||t.owner;
  }catch(error){console.error("Maria notification retry lookup failed",error);return false;}
}
/** Owner-only explicit retry; latest booking time and each recipient are revalidated. */
export async function retryMariaRescheduleNotice(id:string,workspaceId:string){
  if(!uuid.test(id)||!uuid.test(workspaceId))return {ok:false as const};
  const base=getMariaBookingPortalBase();
  const readiness=await getMariaBookingReadiness();
  if(!base||!readiness.enabled||readiness.workspaceId!==workspaceId)return {ok:false as const};
  const claimedAttempt = { eventId: "", attemptedAt: "" };
  let providerRequestStarted = false;
  try{
    return await withMariaBookingNotificationLock(workspaceId,async(signal)=>{
    const sql=getSql();if(!sql)return {ok:false as const};
    const row=await currentNotice(id,workspaceId);
    if(signal?.aborted||!row)return {ok:false as const};
    const {m,customer,owner}=targets(row);
    const eventId=String(row.event_id??"");
    if(!uuid.test(eventId))return {ok:false as const};
    if (!customer && !owner) {
      // Only fully accepted notices count as already sent; live leases and
      // superseded notices must continue to report a regular failed retry.
      const alreadySent = m.notice_customer === "sent"
        && (m.notice_owner === "sent" || m.notice_owner === "skipped");
      return alreadySent ? {ok:false as const, alreadySent:true as const} : {ok:false as const};
    }
    // Only one concurrent sender can claim a *proven* failed/pending notice.
    // Never steal a stale 'sending' lease: HTTP delivery may be uncertain.
    const claims=await sql`
      update customer_events e set metadata=e.metadata||jsonb_build_object(
        'notice_customer',case when ${customer}::boolean then 'sending'
          else e.metadata->>'notice_customer' end,
        'notice_owner',case when ${owner}::boolean then 'sending'
          else e.metadata->>'notice_owner' end,
        'notice_attempted_at',now()::text)
      where e.id=${eventId}::uuid and e.workspace_id=${workspaceId}
        and e.booking_id=${id}::uuid
        and e.metadata->>'source' in ('maria_preview_reschedule','maria_manager_dashboard_reschedule')
        and (${!customer}::boolean or e.metadata->>'notice_customer' in ('pending','failed'))
        and (${!owner}::boolean or e.metadata->>'notice_owner' in ('pending','failed'))
        and exists(select 1 from bookings b where b.id=e.booking_id
          and b.workspace_id=e.workspace_id and b.status in ('requested','confirmed')
          and b.starts_at=(e.metadata->>'starts_at')::timestamptz
          and b.ends_at=(e.metadata->>'ends_at')::timestamptz)
      returning e.metadata->>'notice_attempted_at' as attempted_at
    `;
    if(claims.length===1) {
      claimedAttempt.eventId = eventId;
      claimedAttempt.attemptedAt = String(claims[0]?.attempted_at);
    }
    if (signal?.aborted && claimedAttempt.eventId) {
      throw new Error("Maria reschedule retry lock aborted after claim");
    }
    if(claims.length!==1)return {ok:false as const};
    const day=86_400;
    const endsAt=new Date(String(row.ends_at)).getTime();
    const secs=Math.max(30*day,Math.min(400*day,
      Math.ceil((endsAt+30*day*1000-Date.now())/1000)));
    const token=createCustomerCalendarToken({
      workspaceId,customerId:String(row.customer_id),expiresInSeconds:secs,
    });
    const language=m.language==="ar"?"ar":m.language==="en"?"en":"sv";
    const res=m.source==="maria_manager_dashboard_reschedule"
      ? await Promise.allSettled([sendBookingRescheduleEmail({
          customerName:String(row.customer_name),customerEmail:String(row.customer_email),
          companyName:String(row.company_name),branding:"makeup-by-maria",
          service:String(row.service_name),city:String(row.city??""),
          previousStartsAt:new Date(String(m.previous_starts_at)).toISOString(),
          startsAt:new Date(String(row.starts_at)).toISOString(),
          endsAt:new Date(String(row.ends_at)).toISOString(),
          timeZone:"Europe/Stockholm",language,
          ...(signal ? {signal} : {}),
          onRequestStart: () => { providerRequestStarted = true; },
        })])
      : await sendBookingChangeEmails({
      kind:"rescheduled",branding:"makeup-by-maria",
      customerName:String(row.customer_name),customerEmail:String(row.customer_email),
      sendCustomer:customer,
      ownerEmail:owner?String(row.owner_email):undefined,
      companyName:String(row.company_name),service:String(row.service_name),
      city:String(row.city??""),
      oldStartsAt:new Date(String(m.previous_starts_at)).toISOString(),
      oldEndsAt:new Date(String(m.previous_ends_at)).toISOString(),
      newStartsAt:new Date(String(row.starts_at)).toISOString(),
      newEndsAt:new Date(String(row.ends_at)).toISOString(),
      portalUrl:`${base}/mina-bokningar/${encodeURIComponent(token)}?lang=${language}`,
      timeZone:"Europe/Stockholm",language,
      ...(signal ? {signal} : {}),
      onRequestStart: () => { providerRequestStarted = true; },
    });
    if (signal.aborted) throw new Error("Maria reschedule retry lock expired during provider dispatch");
    const sent=(item:(typeof res)[number]|undefined)=>item?.status==="fulfilled"
      &&!!item.value &&typeof item.value==="object"
      &&"ok" in item.value &&item.value.ok===true;
    const state = (item:(typeof res)[number]|undefined) => {
      if (sent(item)) return "sent";
      if (item?.status === "rejected"
        || (item?.status === "fulfilled" && item.value
          && typeof item.value === "object" && "deliveryUncertain" in item.value
          && item.value.deliveryUncertain === true)) return "uncertain";
      return "failed";
    };
    const cs=customer?state(res[0]):String(m.notice_customer??"skipped");
    const os=owner?state(res[1]):String(m.notice_owner??"skipped");
    if (signal.aborted) throw new Error("Maria reschedule retry lock expired during provider dispatch");
    const updated=await sql`
      update customer_events e set metadata=e.metadata||jsonb_build_object(
        'notice_customer',${cs}::text,'notice_owner',${os}::text)
      where e.id=${eventId}::uuid and e.workspace_id=${workspaceId}
        and e.metadata->>'source' in ('maria_preview_reschedule','maria_manager_dashboard_reschedule')
        and e.metadata->>'notice_attempted_at'=${String(claims[0]?.attempted_at)}
      returning id
    `;
    return {ok:updated.length===1 &&cs==="sent" &&(os==="sent"||os==="skipped")};
    });
  }catch(error){
    // Only a callback that never began an HTTP request can be safely freed
    // for retry. If a request may have reached Brevo, hold for reconciliation.
    try {
      if (claimedAttempt.eventId) {
        const sql=getSql();
        if (sql) {
          const finalState=providerRequestStarted?"uncertain":"failed";
          await sql`
            update customer_events e set metadata=e.metadata||jsonb_build_object(
              'notice_customer',case when e.metadata->>'notice_customer'='sending'
                then ${finalState}::text else e.metadata->>'notice_customer' end,
              'notice_owner',case when e.metadata->>'notice_owner'='sending'
                then ${finalState}::text else e.metadata->>'notice_owner' end)
            where e.id=${claimedAttempt.eventId}::uuid
              and e.workspace_id=${workspaceId} and e.booking_id=${id}::uuid
              and e.metadata->>'notice_attempted_at'=${claimedAttempt.attemptedAt}
              and (e.metadata->>'notice_customer'='sending'
                or e.metadata->>'notice_owner'='sending')
          `;
        }
      }
    } catch (journalError) { console.error("Maria retry journal recovery failed",journalError); }
    console.error("Maria notification retry failed closed",error);
    return {ok:false as const};
  }
}
