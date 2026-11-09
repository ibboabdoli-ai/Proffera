import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only",()=>({}));
vi.mock("@/lib/maria-booking-notification-lock",()=>({
  withMariaBookingNotificationLock:async(_workspaceId:string,action:(signal:AbortSignal)=>Promise<unknown>)=>{
    const controller=new AbortController();
    m.abortController=controller;
    return action(controller.signal);
  },
}));
const m=vi.hoisted(()=>({
  sql:vi.fn(),send:vi.fn(),sendManager:vi.fn(),ready:vi.fn(),
  abortController:null as AbortController|null,
}));
vi.mock("@/lib/db/server",()=>({getSql:()=>m.sql}));
vi.mock("@/lib/maria-booking-runtime",()=>({getMariaBookingReadiness:m.ready}));
vi.mock("@/lib/maria-preview-customer-safety",()=>({
  getMariaBookingPortalBase:()=> "https://maria-qa.vercel.app",
  isMariaBookingRecipientAllowed:(email:string)=> email==="qa@example.invalid",
}));
vi.mock("@/lib/customer-calendar",()=>({
  createCustomerCalendarToken:()=> "synthetic-signed-portal-token",
}));
vi.mock("@/features/email/booking-change-email",()=>({
  sendBookingChangeEmails:m.send,
}));
vi.mock("@/features/email/booking-reschedule-email",()=>({
  sendBookingRescheduleEmail:m.sendManager,
}));
import {hasPendingMariaRescheduleNotice,retryMariaRescheduleNotice}
  from "./maria-reschedule-notice-retry";

const workspaceId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const id="11111111-2222-4333-8444-555555555555";
const eventId="22222222-3333-4444-8555-666666666666";
const row={
  event_id:eventId,customer_id:"33333333-4444-4555-8666-777777777777",
  starts_at:"2027-06-18T08:00:00.000Z",ends_at:"2027-06-18T11:00:00.000Z",
  customer_name:"Synthetic bride",customer_email:"qa@example.invalid",
  owner_email:"qa@example.invalid",company_name:"Makeup by Maria",
  service_name:"Synthetic bridal makeup",city:"Södertälje",
  metadata:{
    source:"maria_preview_reschedule",
    previous_starts_at:"2027-06-11T08:00:00.000Z",
    previous_ends_at:"2027-06-11T11:00:00.000Z",
    starts_at:"2027-06-18T08:00:00.000Z",
    ends_at:"2027-06-18T11:00:00.000Z",
    language:"en",
    notice_customer:"failed",notice_owner:"sent",
    notice_attempted_at:"2026-11-08T08:00:00.000Z",
  },
};
beforeEach(()=>{
  vi.clearAllMocks();
  m.abortController=null;
  m.ready.mockResolvedValue({enabled:true,workspaceId});
});
afterEach(()=>{vi.unstubAllEnvs();});

describe("Maria customer-reschedule notification retry",()=>{
  it("only exposes a retry when the newest authenticated booking still needs it",async()=>{
    m.sql.mockResolvedValueOnce([row]);
    expect(await hasPendingMariaRescheduleNotice(id,workspaceId)).toBe(true);
    m.sql.mockResolvedValueOnce([{...row,metadata:{
      ...row.metadata,notice_customer:"sent",notice_owner:"sent",
    }}]);
    expect(await hasPendingMariaRescheduleNotice(id,workspaceId)).toBe(false);
    m.sql.mockResolvedValueOnce([{...row,metadata:{
      ...row.metadata,notice_customer:"sending",notice_owner:"sent",
      notice_attempted_at:new Date().toISOString(),
    }}]);
    expect(await hasPendingMariaRescheduleNotice(id,workspaceId)).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("claims one failed customer delivery without sending the already-successful owner notice",async()=>{
    m.sql.mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{attempted_at:"2026-11-08 10:00:00+00"}])
      .mockResolvedValueOnce([{id:eventId}]);
    m.send.mockResolvedValueOnce([{status:"fulfilled",value:{ok:true}}]);
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:true});
    expect(m.send).toHaveBeenCalledOnce();
    expect(m.send.mock.calls[0]![0]).toMatchObject({
      sendCustomer:true,customerEmail:"qa@example.invalid",
      language:"en",oldStartsAt:"2027-06-11T08:00:00.000Z",
      newStartsAt:"2027-06-18T08:00:00.000Z",
    });
    expect(m.send.mock.calls[0]![0].ownerEmail).toBeUndefined();
    const firstQuery=m.sql.mock.calls[0]![0] as TemplateStringsArray;
    expect(firstQuery.join("?")).toContain("b.starts_at=(n.metadata->>'starts_at')::timestamptz");
    const claim=m.sql.mock.calls[1]![0] as TemplateStringsArray;
    expect(claim.join("?")).toContain("and e.workspace_id=?");
    expect(claim.join("?")).toContain("and exists(select 1 from bookings b");
  });

  it("retries only an owner failure without duplicating the delivered customer email",async()=>{
    const onlyOwner={...row,metadata:{...row.metadata,
      notice_customer:"sent",notice_owner:"failed"}};
    m.sql.mockResolvedValueOnce([onlyOwner])
      .mockResolvedValueOnce([{attempted_at:"2026-11-08 10:00:00+00"}])
      .mockResolvedValueOnce([{id:eventId}]);
    m.send.mockResolvedValueOnce([
      {status:"fulfilled",value:{ok:true,skipped:true}},
      {status:"fulfilled",value:{ok:true}},
    ]);
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:true});
    expect(m.send.mock.calls[0]![0]).toMatchObject({
      sendCustomer:false,ownerEmail:"qa@example.invalid",
    });
  });

  it("retries a committed manager reschedule using its original localized template",async()=>{
    const manager={...row,metadata:{...row.metadata,
      source:"maria_manager_dashboard_reschedule",notice_customer:"pending",notice_owner:"skipped"}};
    m.sql.mockResolvedValueOnce([manager])
      .mockResolvedValueOnce([{attempted_at:"2026-11-08 10:00:00+00"}])
      .mockResolvedValueOnce([{id:eventId}]);
    m.sendManager.mockResolvedValueOnce({ok:true});
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:true});
    expect(m.sendManager).toHaveBeenCalledOnce();
    expect(m.sendManager.mock.calls[0]![0]).toMatchObject({
      branding:"makeup-by-maria",customerEmail:"qa@example.invalid",
      language:"en",previousStartsAt:"2027-06-11T08:00:00.000Z",
      startsAt:"2027-06-18T08:00:00.000Z",
    });
    const readSql=m.sql.mock.calls[0]![0] as TemplateStringsArray;
    expect(readSql.join("?")).toContain("maria_manager_dashboard_reschedule");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("refuses a concurrently claimed or obsolete booking without sending anything",async()=>{
    m.sql.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
    expect(m.send).not.toHaveBeenCalled();
  });

  it.each(["customer","manager"] as const)(
    "recovers a provably unsent %s claim when the notification lock disconnects",
    async(source)=>{
      const current=source==="manager"
        ? {...row,metadata:{...row.metadata,
            source:"maria_manager_dashboard_reschedule",notice_customer:"failed",notice_owner:"skipped"}}
        : row;
      const attemptedAt="2026-11-08 11:00:00+00";
      m.sql.mockResolvedValueOnce([current])
        .mockImplementationOnce(async()=>{
          m.abortController?.abort();
          return [{attempted_at:attemptedAt}];
        })
        .mockResolvedValueOnce([{id:eventId}]);
      expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
      expect(m.send).not.toHaveBeenCalled();
      expect(m.sendManager).not.toHaveBeenCalled();
      const recovery=m.sql.mock.calls[2]!;
      const sql=(recovery[0] as TemplateStringsArray).join("?");
      expect(sql).toContain("notice_attempted_at");
      expect(sql).toContain("notice_customer'='sending'");
      expect(recovery).toContain(attemptedAt);
      expect(recovery).toContain("failed");
    },
  );

  it.each(["customer","manager"] as const)(
    "keeps a potentially delivered %s claim uncertain on a provider-time lock abort",
    async(source)=>{
      const current=source==="manager"
        ? {...row,metadata:{...row.metadata,
            source:"maria_manager_dashboard_reschedule",notice_customer:"failed",notice_owner:"skipped"}}
        : row;
      const attemptedAt="2026-11-08 11:01:00+00";
      m.sql.mockResolvedValueOnce([current])
        .mockResolvedValueOnce([{attempted_at:attemptedAt}])
        .mockResolvedValueOnce([{id:eventId}]);
      const abortDuringSend=async(input:{onRequestStart?:(recipient:"customer"|"owner")=>void})=>{
        input.onRequestStart?.("customer");
        m.abortController?.abort();
        return [{status:"fulfilled",value:{ok:false,deliveryUncertain:true}}];
      };
      if(source==="manager"){
        m.sendManager.mockImplementationOnce(async(input:{onRequestStart?:()=>void})=>{
          input.onRequestStart?.();
          m.abortController?.abort();
          return {ok:false,deliveryUncertain:true};
        });
      } else {
        m.send.mockImplementationOnce(abortDuringSend);
      }
      expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
      const recovery=m.sql.mock.calls[2]!;
      const sql=(recovery[0] as TemplateStringsArray).join("?");
      expect(sql).toContain("notice_attempted_at");
      expect(recovery).toContain(attemptedAt);
      expect(recovery).toContain("uncertain");
    },
  );

  it("keeps a settled customer success and owner rejection after lock Abort", async()=>{
    const bothFailed={...row,metadata:{...row.metadata,
      notice_customer:"failed",notice_owner:"failed"}};
    const attemptedAt="2026-11-08 11:02:00+00";
    m.sql.mockResolvedValueOnce([bothFailed])
      .mockResolvedValueOnce([{attempted_at:attemptedAt}])
      .mockResolvedValueOnce([{id:eventId}]);
    m.send.mockImplementationOnce(async(input:{
      onRequestStart?:(recipient:"customer"|"owner")=>void;
      onDeliveryResult?:(recipient:"customer"|"owner",
        outcome:{ok:boolean;notSent?:boolean})=>void;
    })=>{
      input.onRequestStart?.("customer");
      input.onRequestStart?.("owner");
      input.onDeliveryResult?.("customer",{ok:true});
      input.onDeliveryResult?.("owner",{ok:false,notSent:true});
      m.abortController?.abort();
      return [
        {status:"fulfilled",value:{ok:true}},
        {status:"fulfilled",value:{ok:false,notSent:true}},
      ];
    });
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
    const recovery=m.sql.mock.calls[2]!;
    const query=(recovery[0] as TemplateStringsArray).join("?");
    expect(query).toContain("notice_attempted_at");
    expect(recovery).toContain(attemptedAt);
    expect(recovery).toContain("sent");
    expect(recovery).toContain("failed");
    expect(recovery).not.toContain("uncertain");
    expect(m.send).toHaveBeenCalledOnce();
  });

  it("keeps an accepted manager notice settled after lock Abort", async()=>{
    const manager={...row,metadata:{...row.metadata,
      source:"maria_manager_dashboard_reschedule",
      notice_customer:"failed",notice_owner:"skipped"}};
    const attemptedAt="2026-11-08 11:03:00+00";
    m.sql.mockResolvedValueOnce([manager])
      .mockResolvedValueOnce([{attempted_at:attemptedAt}])
      .mockResolvedValueOnce([{id:eventId}]);
    m.sendManager.mockImplementationOnce(async(input:{onRequestStart?:()=>void})=>{
      input.onRequestStart?.();
      m.abortController?.abort();
      return {ok:true};
    });
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
    const recovery=m.sql.mock.calls[2]!;
    expect(recovery).toContain("sent");
    expect(recovery).not.toContain("uncertain");
    expect(recovery).toContain(attemptedAt);
  });

  it("does not operate when Maria activation has been disabled",async()=>{
    m.ready.mockResolvedValue({enabled:false});
    expect(await retryMariaRescheduleNotice(id,workspaceId)).toEqual({ok:false});
    expect(m.sql).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
});
