import { getMariaPreviewPortalBase } from "@/lib/maria-preview-customer-safety";

/** Approved Maria client logo for transactional booking email HTML.
 * Keep this table-based and inline-styled for Gmail/iOS mail clients.
 * An untrusted origin must never be interpolated into the image HTML.
 */
const logoPath = "/demo/makeup-by-maria/assets/maria-client-logo.jpg";

/**
 * Render the customer-approved Maria logo in transactional email markup.
 * Only the configured HTTPS Preview deployment may supply the image origin;
 * untrusted URLs or non-Preview execution produce an empty string.
 */
export function mariaEmailLogoHtml(previewUrl: string | null | undefined) {
  if (!previewUrl) return "";
  let logoUrl: string;
  try {
    const url = new URL(previewUrl);
    // The environment-derived Preview origin is trusted; an arbitrary
    // vercel.app subdomain supplied by a caller is not.
    const approvedOrigin = getMariaPreviewPortalBase();
    if (!approvedOrigin || url.origin !== approvedOrigin
      || url.protocol !== "https:"
      || url.username || url.password || url.port) return "";
    logoUrl = new URL(logoPath, url.origin).toString();
  } catch {
    return "";
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fcfaf8">
    <tr><td align="center" style="padding:18px 12px 14px;text-align:center">
      <img src="${logoUrl}" alt="Makeup by Maria" width="180" height="180"
        style="display:block;border:0;width:180px;max-width:100%;height:auto;margin:0 auto;border-radius:9px" />
    </td></tr>
  </table>`;
}
