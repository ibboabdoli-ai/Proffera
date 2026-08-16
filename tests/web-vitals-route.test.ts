import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/observability/web-vitals/route";
import { classifyWebVitalRoute } from "../src/lib/web-vitals-route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("web vitals baseline", () => {
  it("groups public routes without sending raw customer or company paths", () => {
    expect(classifyWebVitalRoute("/")).toBe("marketing");
    expect(classifyWebVitalRoute("/tjanster/bokningssystem")).toBe("marketing");
    expect(classifyWebVitalRoute("/foretag/listad/example-company")).toBe("directory");
    expect(classifyWebVitalRoute("/en/companies/example-company")).toBe("directory");
    expect(classifyWebVitalRoute("/boka/customer-slug")).toBe("booking");
    expect(classifyWebVitalRoute("/dashboard/calendar")).toBe("dashboard");
    expect(classifyWebVitalRoute("/admin/audit")).toBe("admin");
    expect(classifyWebVitalRoute("/foretag/customer-slug")).toBe("business-site");
    expect(classifyWebVitalRoute("/demo/primeview")).toBe("demo");
    expect(classifyWebVitalRoute("/review/private-token")).toBe("other");
  });

  it("accepts a sanitized production metric and logs only the route group", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await POST(new Request("https://proffera.se/api/observability/web-vitals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify({
        name: "LCP",
        value: 1842.357,
        rating: "good",
        routeGroup: "directory",
        navigationType: "navigate",
      }),
    }));

    expect(response.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(entry).toEqual({
      level: "info",
      msg: "web_vital",
      metric: "LCP",
      value: 1842.36,
      rating: "good",
      routeGroup: "directory",
      navigationType: "navigate",
    });
    expect(JSON.stringify(entry)).not.toContain("example-company");
  });

  it("rejects cross-site and malformed measurements", async () => {
    const crossSite = await POST(new Request("https://proffera.se/api/observability/web-vitals", {
      method: "POST",
      headers: { "Sec-Fetch-Site": "cross-site" },
      body: "{}",
    }));
    expect(crossSite.status).toBe(403);

    const malformed = await POST(new Request("https://proffera.se/api/observability/web-vitals", {
      method: "POST",
      headers: { "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({
        name: "LCP",
        value: -1,
        rating: "good",
        routeGroup: "directory",
      }),
    }));
    expect(malformed.status).toBe(400);
  });
});
