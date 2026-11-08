import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "public/demo/makeup-by-maria-v2.html"), "utf8");

function segment(start: string, end: string) {
  const begin = html.indexOf(start);
  const finish = begin < 0 ? -1 : html.indexOf(end, begin + start.length);
  if (begin < 0 || finish < 0) throw Error("Maria booking code segment missing: " + start);
  return html.slice(begin, finish);
}

type Button = { dataset: { package: string }; disabled: boolean; choose: { textContent: string }; querySelector: () => {textContent:string} };
type Select = { value: string; options: Array<{textContent:string; value:string}>; innerHTML: string; add: (o: {textContent:string;value:string}) => void; replaceChildren: () => void };

function select(value = ""): Select {
  const s: Select = { value, options: [], innerHTML: "", add: option => s.options.push(option),
    replaceChildren: () => { s.options = []; } };
  return s;
}

function runBookingNavigation(mariaPublicHost: boolean, bookingEnabled: boolean) {
  const buttons: Button[] = ["trial", "without"].map(kind => {
    const b = { dataset: {package:kind}, disabled:false, choose:{textContent:""}, querySelector: () => b.choose };
    return b;
  });
  const date = select("2026-11-07");
  const time = select();
  const message = {style: {display:"block"}, textContent:""};
  const state: {year:number;kind:string|null;lang:string} = {year:2026,kind:null,lang:"sv"};
  const steps: string[] = [];
  const context = {
    mariaPublicHost, workspaceConfig: {bookingEnabled, bookableDurations:{}, hours:null},
    state, document: {querySelectorAll: () => buttons},
    copy: () => ({choose:"Choose", timeEmpty:"Choose a time", dateEmpty:"Choose a date"}),
    uiCopy: () => ({closed:"Bookings closed"}),
    $: (id:string) => ({weddingDate:date,weddingTime:time,message}[id as "weddingDate"|"weddingTime"|"message"]),
    Option: class {constructor(public textContent:string, public value:string){}},
    showStep: (step:string) => steps.push(step), translate: () => {},
  };
  const source = [
    segment("function isBookablePackage(year,kind){", "function renderYears(){"),
    segment("function choosePackage(kind){", "function renderSummary(){"),
    segment("function buildDates(){", "document.querySelectorAll(\"[data-package]\").forEach("),
    "({renderPackageAvailability,choosePackage,buildDates,buildTimes})",
  ].join("\n");
  const handlers = runInNewContext(source, context, {timeout:1500}) as {
    renderPackageAvailability:()=>void; choosePackage:(kind:string)=>void;
    buildDates:()=>void; buildTimes:()=>Promise<void>;
  };
  return {handlers,buttons,date,time,state,steps};
}

describe("Maria closed branded site never offers synthetic booking dates or times", () => {
  it("keeps Preview demo defaults off the public branded site before config loads", () => {
    const initializer = segment("let workspaceConfig={", "function isValidYearPrice(amount){");
    const years = (branded: boolean) => runInNewContext(
      initializer + "\nworkspaceConfig.years", { mariaPublicHost: branded }, { timeout: 1500 },
    ) as Array<{year:number}>;
    expect(years(true)).toHaveLength(0);
    expect(Array.from(years(false), year => year.year)).toEqual([2026, 2027, 2028]);
  });
  it("preserves year-specific price browsing while preventing progression to contact and fake slots", async () => {
    const view = runBookingNavigation(true,false);
    view.handlers.renderPackageAvailability();
    expect(view.buttons.every(b=>b.disabled)).toBe(true);
    expect(view.buttons.every(b=>b.choose.textContent==="Bookings closed")).toBe(true);
    view.handlers.choosePackage("trial");
    expect(view.state.kind).toBeNull();
    expect(view.steps).toEqual([]);
    view.handlers.buildDates();
    await view.handlers.buildTimes();
    expect(view.date.options).toHaveLength(1);
    expect(view.time.options).toHaveLength(1);
  });

  it("keeps the existing unbranded Preview demo progression and synthetic-time behavior", async () => {
    const view = runBookingNavigation(false,false);
    view.handlers.renderPackageAvailability();
    expect(view.buttons.every(b=>!b.disabled)).toBe(true);
    view.handlers.choosePackage("trial");
    expect(view.state.kind).toBe("trial");
    expect(view.steps).toEqual(["details"]);
    await view.handlers.buildTimes();
    expect(view.time.options.length).toBeGreaterThan(1);
    expect(view.time.options.some(o=>o.value==="06:00")).toBe(true);
  });
});


describe("Maria branded home navigation and publication metadata", () => {
  it.each(["sv", "en", "ar"] as const)("routes logo/back navigation to the branded root in %s", lang => {
    const homeHelper = segment("function mariaPublicHomeUrl(language){", "const mariaPublicCopy={");
    const returnHome = segment("function returnHome(){", 'document.querySelector(".identity")');
    const assigned: string[] = [];
    runInNewContext(`${homeHelper}\n${returnHome}\nreturnHome()`, {
      mariaPublicHost: true, state: {lang}, window: {location: {assign: (url: string) => assigned.push(url)}},
    }, {timeout:1500});
    expect(assigned).toEqual([`/?lang=${lang}`]);
    expect(html).toContain('$("bookingCompleteAgain").href=mariaPublicHomeUrl(state.lang);');
  });

  it("preserves the internal demo path for non-Maria Preview hosts", () => {
    const homeHelper = segment("function mariaPublicHomeUrl(language){", "const mariaPublicCopy={");
    const url = runInNewContext(`${homeHelper}\nmariaPublicHomeUrl("en")`, {
      mariaPublicHost:false,
    }, {timeout:1500});
    expect(url).toBe("/demo/makeup-by-maria-v2.html?lang=en");
  });

  it("provides indexable branded-source metadata while keeping direct demo URLs noindex", () => {
    const head = html.split("</head>")[0];
    expect(head).toContain("<title>Makeup by Maria · Brudmakeup i Södertälje</title>");
    expect(head).toContain('<link rel="canonical" href="https://makeupbymaria.se/">');
    expect(head).not.toMatch(/<meta name="robots"[^>]*noindex/i);
    const proxySource = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxySource).toContain('pathname === "/demo/makeup-by-maria-v2.html"');
    expect(proxySource).toContain('response.headers.set("X-Robots-Tag", NOINDEX_VALUE);');
  });
});
