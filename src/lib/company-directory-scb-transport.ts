import "server-only";

import { request as httpsRequest } from "node:https";

import type { ScbCompanyRegistryTransport } from "./company-directory-scb-provider";

const DEFAULT_BASE_URL = "https://privateapi.scb.se/nv0101/v1/sokpavar/";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const REQUEST_SPACING_MS = 1_050;

type JsonRecord = Record<string, unknown>;

type ScbRegistryTransportConfig = {
  baseUrl: string;
  pfx: Buffer;
  passphrase: string;
  companyQueryTemplate: string;
  workplaceQueryTemplate: string;
  timeoutMs: number;
};

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function trimmedEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function renderQueryTemplate(template: string, organizationNumber: string) {
  const digits = organizationNumber.replace(/\D/g, "");
  if (digits.length !== 10) throw new Error("Invalid organization number for SCB company registry transport");

  const rendered = template
    .replaceAll("{{ORGNR}}", digits)
    .replaceAll("{{PEORGNR}}", `16${digits}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rendered);
  } catch {
    throw new Error("Invalid SCB company registry query template JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SCB company registry query template must render to a JSON object");
  }
  return parsed as JsonRecord;
}

function configFromEnv(): ScbRegistryTransportConfig | null {
  const pfxBase64 = trimmedEnv("SCB_COMPANY_REGISTRY_PFX_BASE64");
  const passphrase = trimmedEnv("SCB_COMPANY_REGISTRY_PFX_PASSPHRASE");
  const companyQueryTemplate = trimmedEnv("SCB_COMPANY_REGISTRY_COMPANY_QUERY_TEMPLATE");
  const workplaceQueryTemplate = trimmedEnv("SCB_COMPANY_REGISTRY_WORKPLACE_QUERY_TEMPLATE");
  if (!pfxBase64 || !passphrase || !companyQueryTemplate || !workplaceQueryTemplate) return null;

  let pfx: Buffer;
  try {
    pfx = Buffer.from(pfxBase64, "base64");
  } catch {
    throw new Error("Invalid SCB company registry certificate encoding");
  }
  if (!pfx.length) throw new Error("SCB company registry certificate is empty");

  return {
    baseUrl: trimmedEnv("SCB_COMPANY_REGISTRY_BASE_URL") ?? DEFAULT_BASE_URL,
    pfx,
    passphrase,
    companyQueryTemplate,
    workplaceQueryTemplate,
    timeoutMs: positiveInteger(trimmedEnv("SCB_COMPANY_REGISTRY_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS),
  };
}

async function reserveRequestSlot() {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextRequestAt = Date.now() + REQUEST_SPACING_MS;
  release();
}

async function requestJson(
  config: ScbRegistryTransportConfig,
  path: string,
  options: { method?: "GET" | "POST"; body?: JsonRecord } = {},
) {
  await reserveRequestSlot();

  const method = options.method ?? "GET";
  const body = options.body ? JSON.stringify(options.body) : null;
  const url = new URL(path, config.baseUrl);

  return await new Promise<unknown>((resolve, reject) => {
    const request = httpsRequest(url, {
      method,
      pfx: config.pfx,
      passphrase: config.passphrase,
      rejectUnauthorized: true,
      timeout: config.timeoutMs,
      headers: {
        Accept: "application/json",
        ...(body ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        } : {}),
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("SCB company registry response exceeded size limit"));
          return;
        }
        chunks.push(buffer);
      });

      response.on("end", () => {
        if (status < 200 || status >= 300) {
          reject(new Error(`SCB company registry request failed with HTTP ${status}`));
          return;
        }

        const text = Buffer.concat(chunks).toString("utf8").trim();
        if (!text) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error("SCB company registry returned invalid JSON"));
        }
      });
    });

    request.on("timeout", () => request.destroy(new Error("SCB company registry request timed out")));
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export function createScbCompanyRegistryTransportFromEnv(): ScbCompanyRegistryTransport | null {
  const config = configFromEnv();
  if (!config) return null;

  return {
    fetchCompany: async (organizationNumber) => requestJson(config, "api/je/hamtaforetag", {
      method: "POST",
      body: renderQueryTemplate(config.companyQueryTemplate, organizationNumber),
    }),
    fetchWorkplaces: async (organizationNumber) => requestJson(config, "api/ae/hamtaarbetsstallen", {
      method: "POST",
      body: renderQueryTemplate(config.workplaceQueryTemplate, organizationNumber),
    }),
  };
}

export async function probeScbCompanyRegistryMetadataFromEnv() {
  const config = configFromEnv();
  if (!config) return { status: "not_configured" as const };

  const [companyVariables, workplaceVariables] = await Promise.all([
    requestJson(config, "api/je/koptavariabler"),
    requestJson(config, "api/ae/koptavariabler"),
  ]);

  return {
    status: "ok" as const,
    companyVariables,
    workplaceVariables,
  };
}
