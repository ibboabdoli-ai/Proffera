export type EmailRecipient = {
  email: string;
  name?: string;
};

function trimmed(value: string | undefined) {
  return value?.trim() || null;
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function resolveBrevoApiKey(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview") {
    return trimmed(env.PROFFERA_PREVIEW_BREVO_API_KEY);
  }

  return trimmed(env.BREVO_API_KEY);
}

export function resolveEmailRecipient(
  recipient: EmailRecipient,
  env: NodeJS.ProcessEnv = process.env,
): EmailRecipient | null {
  if (env.VERCEL_ENV !== "preview") {
    return recipient;
  }

  const previewRecipient = trimmed(env.PROFFERA_PREVIEW_EMAIL_RECIPIENT)?.toLowerCase() ?? null;
  if (!previewRecipient || !isValidEmail(previewRecipient)) {
    return null;
  }

  return {
    email: previewRecipient,
    name: "Proffera Preview",
  };
}
