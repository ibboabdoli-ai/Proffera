import "server-only";

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { sendBookingChangeEmails } from "@/features/email/booking-change-email";
import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const connectionString = resolveDatabaseUrl()_NON_POOLING;
const portalSecret = process.env.CUSTOMER_PORTAL_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
type TokenPayload = { workspaceId: string; customerId: string; exp: number };
export type CustomerCalendarBooking = { id:string; title:string; service:string; city:string; status:string; startsAt:string; endsAt:string };
export type CustomerCalendarData = { timeZone:WorkspaceTimeZone; customer:{id:string;name:string}; upcoming:CustomerCalendarBooking[]; history:CustomerCalendarBooking[]; policy:{customerRescheduleEnabled:boolean;customerCancelEnabled:boolean;cancelNoticeHours:number} };
const encode=(v:string)=>Buffer.from(v,"utf8").toString("base64url");
function sign(v:string){if(!portalSecret)throw new Error("Missing customer portal secret");return crypto.createHmac("sha256",portalSecret).update(v).digest("base64url");}
export function createCustomerCalendarToken(input:{workspaceId:string;customerId:string;expiresInSeconds?:number}){const p:TokenPayload={workspaceId:input.workspaceId,customerId:input.customerId,exp:Math.floor(Date.now()/1000)+(input.expiresInSeconds??TOKEN_TTL_SECONDS)};const e=encode(JSON.stringify(p));return `${e}.${sign(e)}`;}
export function verifyCustomerCalendarToken(token:string):TokenPayload|null{try{const[e,s]=token.split(".");if(!e||!s||!portalSecret)return null;const a=Buffer.from(s),b=Buffer.from(sign(e));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(e,"base64url").toString("utf8")) as TokenPayload;return p.workspaceId&&p.customerId&&Number.isFinite(p.exp)&&p.exp>Math.floor(Date.now()/1000)?p:null;}catch{return null;}}
const toBooking=(r:Record<string,unknown>):CustomerCalendarBooking=>({id:String(r.id??""),title:String(r.title??r.service??"Bokning"),service:String(r.service??"Ej angiven"),city:String(r.city??""),status:String(r.status??"requested"),startsAt:new Date(String(r.starts_at)).toISOString(),endsAt:new Date(String(r.ends_at)).toISOString()});

export async function getCustomerCalendar(token:string):Promise<CustomerCalendarData|null>{
 const p=verifyCustomerCalendarToken(token);if(!p||!connectionString)return null;const sql=neon(connectionString);
 const [customers,settings,policies]=await Promise.all([
  sql`select id,name from customers where id=${p.customerId} and workspace_id=${p.workspaceId} limit 1`,
  sql`select time_zone from workspace_settings where workspace_id=${p.workspaceId} limit 1`,
  sql`select customer_reschedule_enabled,customer_cancel_enabled,cancel_notice_hours from workspace_booking_reminder_settings where workspace_id=${p.workspaceId} limit 1`
 ]);
 const customer=customers[0];if(!customer)return null;
 const bookings=await sql`select id,title,service,city,status,starts_at,ends_at from bookings where customer_id=${p.customerId} and workspace_id=${p.workspaceId} and source not in ('dashboard_availability_block','dashboard_availability_recurring_block') order by starts_at asc limit 200`;
 const now=Date.now(),all=bookings.map(toBooking),policy=policies[0];
 return {timeZone:resolveBookingTimeZone(settings[0]?.time_zone),customer:{id:String(customer.id),name:String(customer.name??"Kund")},upcoming:all.filter(b=>new Date(b.endsAt).getTime()>=now&&b.status!=="cancelled"),history:all.filter(b=>new Date(b.endsAt).getTime()<now||b.status==="cancelled").reverse(),policy:{customerRescheduleEnabled:policy?Boolean(policy.customer_reschedule_enabled):true,customerCancelEnabled:policy?Boolean(policy.customer_cancel_enabled):true,cancelNoticeHours:policy?Number(policy.cancel_notice_hours):0}};
}
export async function getCustomerCalendarBooking(token:string,bookingId:string){const p=verifyCustomerCalendarToken(token);if(!p||!connectionString||!bookingId)return null;const sql=neon(connectionString);const r=await sql`select id,title,service,city,status,starts_at,ends_at from bookings where id=${bookingId} and customer_id=${p.customerId} and workspace_id=${p.workspaceId} and source not in ('dashboard_availability_block','dashboard_availability_recurring_block') limit 1`;return r[0]?toBooking(r[0]):null;}
export async function cancelCustomerCalendarBooking(token:string,bookingId:string){
 const p=verifyCustomerCalendarToken(token);if(!p||!connectionString||!/^[0-9a-f-]{36}$/i.test(bookingId))return{ok:false as const,error:"invalid"};const sql=neon(connectionString);
 const rows=await sql`update bookings b set status='cancelled',updated_at=now() from customers c,workspaces w left join workspace_settings ws on ws.workspace_id=w.id::text left join workspace_booking_reminder_settings ps on ps.workspace_id=w.id::text where b.id=${bookingId} and b.customer_id=${p.customerId} and b.workspace_id=${p.workspaceId} and c.id=b.customer_id and c.workspace_id=b.workspace_id and w.id=b.workspace_id and coalesce(ps.customer_cancel_enabled,true)=true and b.status in ('requested','confirmed') and b.starts_at>now()+(coalesce(ps.cancel_notice_hours,0)||' hours')::interval and b.source not in ('dashboard_availability_block','dashboard_availability_recurring_block') returning b.id,b.service,b.city,b.starts_at,b.ends_at,c.name customer_name,c.email customer_email,coalesce(nullif(ws.company_name,''),w.company_name,w.name) company_name,nullif(ws.contact_email,'') owner_email,coalesce(nullif(ws.time_zone,''),'Europe/Stockholm') time_zone`;
 const b=rows[0];if(!b)return{ok:false as const,error:"not_allowed"};const base=(process.env.NEXT_PUBLIC_APP_URL??process.env.APP_URL??"https://www.proffera.se").replace(/\/$/,"");
 await sendBookingChangeEmails({kind:"cancelled",customerName:String(b.customer_name),customerEmail:String(b.customer_email),ownerEmail:b.owner_email?String(b.owner_email):undefined,companyName:String(b.company_name),service:String(b.service??"Bokning"),city:String(b.city??""),oldStartsAt:new Date(String(b.starts_at)).toISOString(),oldEndsAt:new Date(String(b.ends_at)).toISOString(),portalUrl:`${base}/mina-bokningar/${encodeURIComponent(token)}`,timeZone:resolveBookingTimeZone(b.time_zone)});return{ok:true as const};
}
