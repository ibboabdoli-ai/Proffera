import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "proffera_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8;

export function isValidAdminCode(value: string) {
  const adminCode = process.env.ADMIN_ACCESS_CODE;
  return Boolean(adminCode && value && value === adminCode);
}

export async function hasAdminSession() {
  const adminCode = process.env.ADMIN_ACCESS_CODE;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  return Boolean(adminCode && cookieValue && cookieValue === adminCode);
}
