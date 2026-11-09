import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingChangeEmails } from "./booking-change-email";

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
  else process.env.LEAD_FROM_EMAIL = originalFrom;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("booking change email locale", () => {
  it("reports customer acceptance and definite owner rejection separately", async () => {
    process.env.BREVO_API_KEY = "synthetic-only";
    process.env.LEAD_FROM_EMAIL = "Proffera <booking@example.invalid>";
    const requests:string[]=[];
    global.fetch=vi.fn(async (_url,init) => {
      const payload=JSON.parse(String((init as RequestInit).body)) as {to:{email:string}[]};
      const email=payload.to[0]!.email;
      requests.push(email);
      return new Response(JSON.stringify({messageId:"synthetic"}),{
        status:email==="customer@example.invalid" ? 201 : 403,
      });
    });
    const observed:Array<{recipient:"customer"|"owner";ok:boolean;notSent?:boolean}>=[];
    const result=await sendBookingChangeEmails({
      kind:"rescheduled",language:"en",
      customerName:"Synthetic customer",customerEmail:"customer@example.invalid",
      ownerEmail:"owner@example.invalid",companyName:"Synthetic Studio",
      service:"Bridal makeup",oldStartsAt:"2027-06-11T08:00:00.000Z",
      oldEndsAt:"2027-06-11T11:00:00.000Z",
      newStartsAt:"2027-06-18T08:00:00.000Z",
      newEndsAt:"2027-06-18T11:00:00.000Z",
      portalUrl:"https://example.invalid/bookings",
      timeZone:"Europe/Stockholm",
      onDeliveryResult:(recipient,outcome)=>{
        observed.push({recipient,ok:outcome.ok,notSent:outcome.notSent});
      },
    });
    expect(result).toHaveLength(2);
    expect(requests.sort()).toEqual(["customer@example.invalid","owner@example.invalid"]);
    expect(observed).toEqual(expect.arrayContaining([
      {recipient:"customer",ok:true,notSent:undefined},
      {recipient:"owner",ok:false,notSent:true},
    ]));
  });

  it.each(["customer", "owner"] as const)(
    "preserves a settled %s outcome while the other Brevo request is still pending on lock abort",
    async (settledRecipient) => {
      process.env.BREVO_API_KEY = "synthetic-only";
      process.env.LEAD_FROM_EMAIL = "Proffera <booking@example.invalid>";
      const controller = new AbortController();
      let rejectPending!: (reason: unknown) => void;
      const pendingResponse = new Promise<Response>((_resolve,reject) => { rejectPending=reject; });
      const observed: Array<{recipient: "customer" | "owner"; ok:boolean; uncertain:boolean}> = [];
      let notifySettled!: () => void;
      const firstSettled = new Promise<void>(resolve => { notifySettled=resolve; });
      const fetchMock=vi.fn(async (_url: unknown, init?: RequestInit): Promise<Response> => {
        const body=JSON.parse(String(init?.body)) as {to:Array<{email:string}>};
        const recipient=body.to[0]?.email==="customer@example.invalid" ? "customer" : "owner";
        return recipient===settledRecipient
          ? new Response(JSON.stringify({messageId:"synthetic-accepted"}),{status:201})
          : pendingResponse;
      });
      global.fetch=fetchMock;
      let finished=false;
      const sending=sendBookingChangeEmails({
        kind:"rescheduled",language:"en",
        customerName:"Synthetic customer",customerEmail:"customer@example.invalid",
        ownerEmail:"owner@example.invalid",companyName:"Synthetic Studio",
        service:"Bridal makeup",oldStartsAt:"2027-06-11T08:00:00.000Z",
        oldEndsAt:"2027-06-11T11:00:00.000Z",
        newStartsAt:"2027-06-18T08:00:00.000Z",
        newEndsAt:"2027-06-18T11:00:00.000Z",
        portalUrl:"https://example.invalid/bookings",
        timeZone:"Europe/Stockholm",signal:controller.signal,
        onDeliveryResult:(recipient,outcome)=>{
          observed.push({recipient,ok:outcome.ok,uncertain:outcome.deliveryUncertain===true});
          if(recipient===settledRecipient)notifySettled();
        },
      }).then(results=>{finished=true;return results;});
      await firstSettled;
      expect(observed).toEqual([{recipient:settledRecipient,ok:true,uncertain:false}]);
      expect(finished).toBe(false);
      // The lock has expired while the second HTTP request remains in flight.
      controller.abort();
      rejectPending(new DOMException("Synthetic pending request aborted","AbortError"));
      const results=await sending;
      expect(finished).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const pendingRecipient=settledRecipient==="customer" ? "owner" : "customer";
      expect(observed).toEqual(expect.arrayContaining([
        {recipient:settledRecipient,ok:true,uncertain:false},
        {recipient:pendingRecipient,ok:false,uncertain:true},
      ]));
      expect(observed).toHaveLength(2);
      expect(results).toHaveLength(2);
      expect(results[settledRecipient === "customer" ? 0 : 1]).toMatchObject({
        status: "fulfilled", value: { ok: true },
      });
      expect(results[pendingRecipient === "customer" ? 0 : 1]).toMatchObject({
        status: "fulfilled", value: { ok: false, deliveryUncertain: true },
      });
    },
  );

  it("does not retry a definite Brevo 403 rejection as uncertain", async () => {
    process.env.BREVO_API_KEY="synthetic-test-only";
    process.env.LEAD_FROM_EMAIL="Proffera <noreply@example.invalid>";
    const fetchMock=vi.fn().mockResolvedValue({
      ok:false,status:403,
      json:async()=>({message:"Synthetic permission denied"}),
    });
    global.fetch=fetchMock;
    const results=await sendBookingChangeEmails({
      kind:"rescheduled",customerName:"Synthetic",customerEmail:"qa@example.invalid",
      companyName:"Synthetic Maria",service:"Brudsmink",
      oldStartsAt:"2027-06-18T08:00:00.000Z",oldEndsAt:"2027-06-18T11:00:00.000Z",
      newStartsAt:"2027-06-19T08:00:00.000Z",newEndsAt:"2027-06-19T11:00:00.000Z",
      portalUrl:"https://preview.example.invalid/mina-bokningar/test",
      timeZone:"Europe/Stockholm",language:"sv",
    });
    expect(results[0]).toMatchObject({
      status:"fulfilled",value:{ok:false,notSent:true},
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not call Brevo after the notification lock signal expires", async () => {
    process.env.BREVO_API_KEY = "synthetic-test-only";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@example.invalid>";
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const controller = new AbortController();
    controller.abort();
    const result = await sendBookingChangeEmails({
      kind: "rescheduled", branding: "makeup-by-maria",
      customerName: "Synthetic customer", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", service: "Brudsmink",
      oldStartsAt: "2027-06-18T08:00:00.000Z",
      oldEndsAt: "2027-06-18T11:00:00.000Z",
      newStartsAt: "2027-06-19T08:00:00.000Z",
      newEndsAt: "2027-06-19T11:00:00.000Z",
      portalUrl: "https://preview.example.invalid/mina-bokningar/token",
      timeZone: "Europe/Stockholm", language: "sv",
      signal: controller.signal,
    });
    expect(result[0]).toMatchObject({ status: "fulfilled", value: { ok: false, notSent: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an aborted in-flight Brevo request uncertain", async () => {
    process.env.BREVO_API_KEY = "synthetic-test-only";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@example.invalid>";
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Synthetic abort", "AbortError"));
    global.fetch = fetchMock;
    let started = 0;
    const result = await sendBookingChangeEmails({
      kind: "rescheduled", branding: "makeup-by-maria",
      customerName: "Synthetic customer", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", service: "Brudsmink",
      oldStartsAt: "2027-06-18T08:00:00.000Z",
      oldEndsAt: "2027-06-18T11:00:00.000Z",
      newStartsAt: "2027-06-19T08:00:00.000Z",
      newEndsAt: "2027-06-19T11:00:00.000Z",
      portalUrl: "https://preview.example.invalid/mina-bokningar/token",
      timeZone: "Europe/Stockholm", language: "sv",
      onRequestStart: () => { started++; },
    });
    expect(started).toBe(1);
    expect(result[0]).toMatchObject({ status: "fulfilled", value: { ok: false, deliveryUncertain: true } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["rescheduled", "en", "Your booking has been rescheduled", "New time:"],
    ["cancelled", "en", "Your booking has been cancelled", "Previous time:"],
    ["rescheduled", "sv", "Din bokningstid har ändrats", "Ny tid:"],
    ["cancelled", "sv", "Din bokning är avbokad", "Tidigare tid:"],
  ] as const)("uses %s customer copy in %s", async (kind, language, subject, content) => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <booking@proffera.se>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "message-1" }), { status: 201 }),
    );
    global.fetch = fetchMock;

    await sendBookingChangeEmails({
      kind,
      language,
      customerName: "Ada",
      customerEmail: "ada@example.com",
      companyName: "Nordic Fix AB",
      service: "Window cleaning",
      oldStartsAt: "2026-09-21T08:00:00.000Z",
      oldEndsAt: "2026-09-21T09:00:00.000Z",
      newStartsAt: kind === "rescheduled" ? "2026-09-22T08:00:00.000Z" : undefined,
      newEndsAt: kind === "rescheduled" ? "2026-09-22T09:00:00.000Z" : undefined,
      portalUrl: `https://www.proffera.se/mina-bokningar/token?lang=${language}`,
      timeZone: "Europe/Stockholm",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.subject).toContain(subject);
    expect(body.textContent).toContain(content);
    expect(body.textContent).toContain(`?lang=${language}`);
    expect(body.htmlContent).toContain("Nordic Fix AB");
    expect(body.htmlContent).not.toContain("PrimeView");
  });
});
