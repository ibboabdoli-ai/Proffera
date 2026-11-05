/**
 * Maria Preview contact checks: reject malformed input before starting OTP.
 * Email ownership is established only by the separate email verification flow.
 */
export function isValidMariaBookingEmail(value: string): boolean {
  const email = value.trim();
  if (email.length < 6 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.length < 2 || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false;
  if (!/^[a-z]{2,63}$/i.test(labels[labels.length - 1])) return false;
  // Gmail account usernames must contain at least six non-dot characters.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const username = local.split("+", 1)[0].replace(/\./g, "");
    if (username.length < 6) return false;
  }
  return true;
}

export function isValidMariaBookingPhone(value: string): boolean {
  const phone = value.trim();
  if (!/^\+?[0-9 ()-]+$/.test(phone) || phone.startsWith("-")) return false;
  const opening = (phone.match(/\(/g) ?? []).length;
  const closing = (phone.match(/\)/g) ?? []).length;
  if (opening !== closing || opening > 1 || (opening && phone.indexOf("(") > phone.indexOf(")"))) return false;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (phone.startsWith("+") && digits.startsWith("0")) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}
