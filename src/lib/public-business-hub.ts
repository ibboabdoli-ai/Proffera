import "server-only";

import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getPublicWorkspaceExperienceSettings, type WorkspaceExperienceSettings } from "@/lib/workspace-experience";

export type PublicBusinessService = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  priceLabel: string;
  priceType: "fixed" | "from" | "quote" | null;
  priceAmountMinor: number | null;
  durationMinutes: number | null;
  serviceArea: string;
  publicSlug: string;
  conversionMode: "book" | "quote" | "book_or_quote" | "contact";
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

export type PublicBusinessReview = {
  id: string;
  reviewerName: string;
  rating: number;
  service: string;
  area: string;
  message: string;
};

export type PublicBusinessGalleryItem = {
  id: string;
  mediaType: "image" | "video";
  publicUrl: string;
  title: string;
  caption: string;
  altText: string;
};

export type PublicBusinessWorkspace = {
  id: string;
  slug: string;
  status: "active" | "trial";
  bookingSlug: string;
  companyName: string;
  primaryCity: string;
  contactEmail: string;
  contactPhone: string;
  billingCurrency: string;
  businessIntro: string;
  bookingEnabled: boolean;
  experience: WorkspaceExperienceSettings;
};

export type PublicBusinessHub = {
  workspace: PublicBusinessWorkspace;
  services: PublicBusinessService[];
  reviews: PublicBusinessReview[];
  gallery: PublicBusinessGalleryItem[];
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function priceType(value: unknown): PublicBusinessService["priceType"] {
  return value === "fixed" || value === "from" || value === "quote" ? value : null;
}

function conversionMode(value: unknown): PublicBusinessService["conversionMode"] {
  return value === "quote" || value === "book_or_quote" || value === "contact" ? value : "book";
}

export function formatPublicBusinessPrice(service: PublicBusinessService, currency: string, locale = "sv-SE") {
  if (service.priceType === "quote") return locale.startsWith("en") ? "Price on request" : "Pris efter offert";
  if ((service.priceType === "fixed" || service.priceType === "from") && service.priceAmountMinor !== null) {
    const amount = service.priceAmountMinor / 100;
    let formatted = `${amount} ${currency}`;
    try {
      formatted = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      // Keep a readable fallback for an unexpected workspace currency.
    }
    return service.priceType === "from"
      ? `${locale.startsWith("en") ? "From" : "Från"} ${formatted}`
      : formatted;
  }
  return service.priceLabel.trim();
}

export async function getPublicBusinessHub(workspaceSlug: string): Promise<PublicBusinessHub | null> {
  const normalizedSlug = workspaceSlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return null;

  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      select
        workspace.id::text as workspace_id,
        workspace.slug,
        workspace.status,
        coalesce(workspace.public_booking_slug, '') as public_booking_slug,
        coalesce(nullif(settings.company_name, ''), workspace.company_name, workspace.name) as company_name,
        coalesce(nullif(settings.primary_city, ''), workspace.primary_city, '') as primary_city,
        coalesce(nullif(settings.contact_email, ''), workspace.contact_email, '') as contact_email,
        coalesce(nullif(settings.contact_phone, ''), workspace.contact_phone, '') as contact_phone,
        coalesce(nullif(settings.billing_currency, ''), 'SEK') as billing_currency,
        coalesce(experience.business_intro, '') as business_intro
      from workspaces workspace
      left join workspace_settings settings on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience on experience.workspace_id = workspace.id
      where workspace.slug = ${normalizedSlug}
        and workspace.status in ('active', 'trial')
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;

    const workspaceId = text(row.workspace_id);
    const websiteEnabled = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder");
    if (!websiteEnabled) return null;

    const [bookingEnabled, experience, serviceRows, reviewRows, galleryRows] = await Promise.all([
      hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking"),
      getPublicWorkspaceExperienceSettings(workspaceId),
      sql`
        select id, name, description, short_description, category, price_label, price_type,
          price_amount_minor, duration_minutes, service_area, public_slug, conversion_mode,
          cover_image_url, seo_title, seo_description
        from workspace_services
        where workspace_id = ${workspaceId}
          and is_active = true
          and public_status = 'published'
          and public_slug is not null
        order by sort_order asc, name asc
      `,
      sql`
        select id, reviewer_name, rating, service, area, message
        from website_reviews
        where workspace_id = ${workspaceId}::uuid
          and status = 'approved'
        order by published_at desc nulls last, created_at desc
        limit 8
      `,
      sql`
        select id, media_type, public_url, title, caption, alt_text
        from website_gallery_items
        where workspace_id = ${workspaceId}::uuid
          and status = 'published'
        order by is_featured desc, sort_order asc, created_at desc
        limit 10
      `,
    ]);

    return {
      workspace: {
        id: workspaceId,
        slug: text(row.slug),
        status: row.status === "active" ? "active" : "trial",
        bookingSlug: text(row.public_booking_slug),
        companyName: text(row.company_name),
        primaryCity: text(row.primary_city),
        contactEmail: text(row.contact_email),
        contactPhone: text(row.contact_phone),
        billingCurrency: text(row.billing_currency) || "SEK",
        businessIntro: text(row.business_intro),
        bookingEnabled,
        experience,
      },
      services: serviceRows.map((service) => ({
        id: text(service.id),
        name: text(service.name),
        description: text(service.description),
        shortDescription: text(service.short_description),
        category: text(service.category),
        priceLabel: text(service.price_label),
        priceType: priceType(service.price_type),
        priceAmountMinor: nullableNumber(service.price_amount_minor),
        durationMinutes: nullableNumber(service.duration_minutes),
        serviceArea: text(service.service_area),
        publicSlug: text(service.public_slug),
        conversionMode: conversionMode(service.conversion_mode),
        coverImageUrl: text(service.cover_image_url),
        seoTitle: text(service.seo_title),
        seoDescription: text(service.seo_description),
      })),
      reviews: experience.reviewsEnabled ? reviewRows.map((review) => ({
        id: text(review.id), reviewerName: text(review.reviewer_name), rating: Number(review.rating) || 0,
        service: text(review.service), area: text(review.area), message: text(review.message),
      })) : [],
      gallery: experience.galleryEnabled ? galleryRows.map((item) => ({
        id: text(item.id), mediaType: item.media_type === "video" ? "video" as const : "image" as const,
        publicUrl: text(item.public_url), title: text(item.title), caption: text(item.caption), altText: text(item.alt_text),
      })) : [],
    };
  } catch (error) {
    console.error("Failed to read public business hub", error);
    return null;
  }
}

export async function getPublicBusinessService(workspaceSlug: string, serviceSlug: string) {
  const hub = await getPublicBusinessHub(workspaceSlug);
  if (!hub) return null;
  const normalizedServiceSlug = serviceSlug.trim().toLowerCase();
  const service = hub.services.find((item) => item.publicSlug === normalizedServiceSlug);
  return service ? { ...hub, service } : null;
}
