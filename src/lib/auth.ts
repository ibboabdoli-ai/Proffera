import { betterAuth } from "better-auth";
import { after } from "next/server";
import { Pool } from "pg";

import {
  passwordResetLocaleFromGeneratedUrl,
  sendPasswordResetEmail,
} from "@/features/email/password-reset-email";
import { resolvePreviewAuthOriginConfig } from "@/lib/auth-origin";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";

export const PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = 60 * 60;
export const PASSWORD_RESET_REQUEST_RATE_LIMIT = { window: 15 * 60, max: 5 } as const;
export const PASSWORD_RESET_SUBMIT_RATE_LIMIT = { window: 15 * 60, max: 10 } as const;

function createAuth() {
  const databaseUrl = resolveNodePostgresDatabaseUrl();
  const authSecret = resolveAuthSecret();
  const previewAuthOriginConfig = resolvePreviewAuthOriginConfig();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or a supported Postgres fallback is required to initialize Proffera auth.",
    );
  }

  if (!authSecret) {
    throw new Error(
      process.env.VERCEL_ENV === "preview"
        ? "PROFFERA_PREVIEW_AUTH_SECRET is required to initialize Proffera auth in Preview."
        : "BETTER_AUTH_SECRET or AUTH_SECRET is required to initialize Proffera auth.",
    );
  }

  return betterAuth({
    secret: authSecret,
    database: new Pool({
      connectionString: databaseUrl,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        const locale = passwordResetLocaleFromGeneratedUrl(url);
        after(async () => {
          await sendPasswordResetEmail({
            recipientEmail: user.email,
            token,
            locale,
          });
        });
      },
    },
    rateLimit: {
      customRules: {
        "/request-password-reset": PASSWORD_RESET_REQUEST_RATE_LIMIT,
        "/reset-password": PASSWORD_RESET_SUBMIT_RATE_LIMIT,
      },
    },
    ...(previewAuthOriginConfig ?? {}),
  });
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
}

export const authIntegrationStatus = "configured-not-routed" as const;
