import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableValue = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function hasSupabaseConfig() {
  return Boolean(projectUrl && publishableValue);
}

export function createSupabaseServerClient() {
  if (!projectUrl || !publishableValue) {
    return null;
  }

  return createClient<Database>(projectUrl, publishableValue, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
