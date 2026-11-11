import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const runtime = vi.hoisted(() => ({
  sql: undefined as undefined | ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: () => runtime.sql }));
import { changeMariaBookingSoftDelete, listMariaArchivedBookings } from "@/lib/maria-booking-soft-delete";

const RUN = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
(RUN ? describe.sequential : describe.skip)("Maria reversible booking archive on isolated PostgreSQL", () => {
  let container = "";
  let db: Client;
  let pool: Pool;
  const mariaId = randomUUID(), foreignId = randomUUID();
  const bookingId = randomUUID(), activeId = randomUUID(), foreignBookingId = randomUUID();
  beforeAll(async () => {
    container = "proffera-maria-delete-" + process.pid + "-" + Date.now();
    docker(["run","--rm","-d","--name",container,"-e","POSTGRES_PASSWORD=postgres",
      "-e","POSTGRES_USER=postgres","-e","POSTGRES_DB=proffera_test",
      "-p","127.0.0.1::5432","postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port",container,"5432/tcp"]).match(/:(\d+)$/u)?.[1];
    if (!port) throw Error("Isolated test PostgreSQL port missing");
    const connectionString = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    let ready = false;
    for (let i=0; i<80; i++) {
      const probe = new Client({ connectionString });
      try { await probe.connect(); await probe.query("select 1"); await probe.end(); ready=true; break; }
      catch { await probe.end().catch(()=>undefined); await delay(500); }
    }
    if (!ready) throw Error("Isolated PostgreSQL unavailable");
    db = new Client({ connectionString }); await db.connect();
    pool = new Pool({ connectionString, max:8 });
    await applyCanonicalProfferaMigrations(db);
    runtime.sql = async (strings, ...values) => {
      const query = strings.reduce((acc, part, i) =>
        acc + part + (i<values.length ? "$"+(i+1) : ""), "");
      return (await pool.query(query, values)).rows as Record<string,unknown>[];
    };
    await db.query(
      "insert into workspaces (id,slug,name,status,public_booking_slug) values ($1::uuid,'makeup-by-maria','Synthetic Maria','active','maria-qa-988'), ($2::uuid,'other-qa','Other Synthetic','active','other-qa-988')",
      [mariaId,foreignId]);
    await db.query(
      "insert into bookings (id,workspace_id,title,status,source) values ($1::uuid,$4,'Synthetic cancelled','cancelled','manual'), ($2::uuid,$4,'Synthetic active','confirmed','manual'), ($3::uuid,$5,'Synthetic other','completed','manual')",
      [bookingId,activeId,foreignBookingId,mariaId,foreignId]);
    await db.query(
      "insert into customer_events (workspace_id,booking_id,event_type,title) values ($1,$2::uuid,'note','Synthetic retained payment note')",
      [mariaId,bookingId]);
  }, 180_000);
  afterAll(async () => {
    runtime.sql=undefined;
    await pool?.end().catch(()=>undefined);
    await db?.end().catch(()=>undefined);
    if (container) {try {docker(["stop",container]);}catch {/* no-op */}}
  }, 30_000);
  it("keeps records, prevents active/cross-tenant archive, and records hide and restore", async () => {
    const args={ workspaceId:mariaId,bookingId,actorId:"synthetic-owner",action:"hide" as const };
    expect(await changeMariaBookingSoftDelete({...args,bookingId:activeId})).toBe("unchanged");
    expect(await changeMariaBookingSoftDelete({...args,bookingId:foreignBookingId})).toBe("unchanged");
    expect(await changeMariaBookingSoftDelete({...args,workspaceId:foreignId,bookingId:foreignBookingId})).toBe("unchanged");
    expect(await changeMariaBookingSoftDelete(args)).toBe("updated");
    expect(await changeMariaBookingSoftDelete(args)).toBe("unchanged");
    expect((await listMariaArchivedBookings(mariaId)).map(x=>x.id)).toEqual([bookingId]);
    expect((await db.query("select count(*)::int n from bookings")).rows[0].n).toBe(3);
    expect((await db.query("select count(*)::int n from customer_events where booking_id=$1::uuid", [bookingId])).rows[0].n).toBe(1);
    expect(await changeMariaBookingSoftDelete({...args,workspaceId:foreignId,action:"restore"})).toBe("unchanged");
    expect(await changeMariaBookingSoftDelete({...args,action:"restore"})).toBe("updated");
    expect(await changeMariaBookingSoftDelete({...args,action:"restore"})).toBe("unchanged");
    expect(await listMariaArchivedBookings(mariaId)).toEqual([]);
    const audit=await db.query("select action from booking_soft_delete_events where booking_id=$1::uuid order by action",[bookingId]);
    expect(audit.rows.map(x=>x.action)).toEqual(["hide","restore"]);
  });
});
