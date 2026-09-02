import { getSql } from "@/lib/db/server";
import type { VerifiedCustomerAddress } from "@/lib/lantmateriet-address-verification";
import type { PublicLocale } from "@/lib/public-locale";
import type { QuoteRequestInput } from "./schema";

type StoreQuoteRequestResult =
  | {
      ok: true;
      referenceId: string;
      created: boolean;
    }
  | {
      ok: false;
      message: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PRO-${timestamp}-${randomPart}`;
}

function validVerifiedReference(value: unknown) {
  return typeof value === "string" && value === value.trim() && UUID_PATTERN.test(value);
}

export async function storeQuoteRequest(
  input: QuoteRequestInput,
  verifiedAddress?: VerifiedCustomerAddress,
  locale: PublicLocale = "sv",
): Promise<StoreQuoteRequestResult> {
  const sql = getSql();

  if (!sql) {
    return {
      ok: false,
      message: locale === "en"
        ? "The database is not configured yet. Add DATABASE_URL in Vercel and run the database migration."
        : "Databasen är inte konfigurerad ännu. Lägg till DATABASE_URL i Vercel och kör databasmigrationen.",
    };
  }

  const normalizedLocale: PublicLocale = locale === "en" ? "en" : "sv";
  const referenceId = buildReferenceId();
  const customerAddressLine1 = input.locationSource === "address" ? input.addressLine1.trim() : null;
  const customerLatitude = input.locationSource === "geolocation" ? input.latitude : null;
  const customerLongitude = input.locationSource === "geolocation" ? input.longitude : null;

  try {
    const recentRows = await sql`
      select reference_id
      from quote_requests
      where created_at >= now() - interval '15 minutes'
        and (
          lower(contact_email) = lower(${input.contactEmail})
          or contact_phone = ${input.contactPhone}
        )
      order by created_at desc
      limit 1
    `;
    const recentReferenceId = String(recentRows[0]?.reference_id ?? "").trim();

    if (recentReferenceId) {
      return { ok: true, referenceId: recentReferenceId, created: false };
    }

    if (input.locationSource === "address" && verifiedAddress && !validVerifiedReference(verifiedAddress.referenceId)) {
      throw new Error("Invalid Lantmäteriet verified-address reference");
    }

    // During the additive rollout the application can deploy before migrations
    // 0059/0063. Probe both optional schema generations and keep old inserts
    // working until each column set is present in the current database.
    const readinessRows = await sql`
      select
        count(*) filter (where column_name in (
          'customer_verified_latitude',
          'customer_verified_longitude',
          'customer_location_verification_source',
          'customer_location_verification_reference',
          'customer_location_verified_at'
        )) = 5 as verified_ready,
        count(*) filter (where column_name = 'locale') = 1 as locale_ready
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'quote_requests'
        and column_name in (
          'customer_verified_latitude',
          'customer_verified_longitude',
          'customer_location_verification_source',
          'customer_location_verification_reference',
          'customer_location_verified_at',
          'locale'
        )
    `;
    const verifiedStorageReady = Boolean(readinessRows[0]?.verified_ready ?? readinessRows[0]?.ready);
    const localeStorageReady = Boolean(readinessRows[0]?.locale_ready);

    let verifiedLatitude: number | null = null;
    let verifiedLongitude: number | null = null;

    if (input.locationSource === "address" && verifiedAddress && verifiedStorageReady) {
      const coordinateRows = await sql`
        select
          st_y(transformed.point)::float8 as latitude,
          st_x(transformed.point)::float8 as longitude
        from (
          select st_transform(
            st_setsrid(st_makepoint(${verifiedAddress.easting}::float8, ${verifiedAddress.northing}::float8), 3006),
            4326
          ) as point
        ) transformed
      `;
      verifiedLatitude = Number(coordinateRows[0]?.latitude);
      verifiedLongitude = Number(coordinateRows[0]?.longitude);
      if (
        !Number.isFinite(verifiedLatitude)
        || !Number.isFinite(verifiedLongitude)
        || verifiedLatitude < -90
        || verifiedLatitude > 90
        || verifiedLongitude < -180
        || verifiedLongitude > 180
      ) {
        throw new Error("Lantmäteriet coordinate transformation failed");
      }
    }

    if (verifiedStorageReady && verifiedAddress && verifiedLatitude !== null && verifiedLongitude !== null && localeStorageReady) {
      await sql`
        insert into quote_requests (
          category,
          service_type,
          city,
          postal_code,
          customer_address_line1,
          customer_latitude,
          customer_longitude,
          customer_location_source,
          customer_verified_latitude,
          customer_verified_longitude,
          customer_location_verification_source,
          customer_location_verification_reference,
          customer_location_verified_at,
          description,
          preferred_date,
          contact_name,
          contact_email,
          contact_phone,
          consent_accepted,
          locale,
          status,
          reference_id
        ) values (
          ${input.category},
          ${input.serviceType},
          ${input.city},
          ${input.postalCode},
          ${customerAddressLine1},
          ${customerLatitude},
          ${customerLongitude},
          ${input.locationSource},
          ${verifiedLatitude},
          ${verifiedLongitude},
          ${verifiedAddress.source},
          ${verifiedAddress.referenceId},
          now(),
          ${input.description},
          ${input.preferredDate},
          ${input.contactName},
          ${input.contactEmail},
          ${input.contactPhone},
          ${input.consentAccepted},
          ${normalizedLocale},
          'submitted',
          ${referenceId}
        )
      `;
    } else if (verifiedStorageReady && verifiedAddress && verifiedLatitude !== null && verifiedLongitude !== null) {
      await sql`
        insert into quote_requests (
          category,
          service_type,
          city,
          postal_code,
          customer_address_line1,
          customer_latitude,
          customer_longitude,
          customer_location_source,
          customer_verified_latitude,
          customer_verified_longitude,
          customer_location_verification_source,
          customer_location_verification_reference,
          customer_location_verified_at,
          description,
          preferred_date,
          contact_name,
          contact_email,
          contact_phone,
          consent_accepted,
          status,
          reference_id
        ) values (
          ${input.category},
          ${input.serviceType},
          ${input.city},
          ${input.postalCode},
          ${customerAddressLine1},
          ${customerLatitude},
          ${customerLongitude},
          ${input.locationSource},
          ${verifiedLatitude},
          ${verifiedLongitude},
          ${verifiedAddress.source},
          ${verifiedAddress.referenceId},
          now(),
          ${input.description},
          ${input.preferredDate},
          ${input.contactName},
          ${input.contactEmail},
          ${input.contactPhone},
          ${input.consentAccepted},
          'submitted',
          ${referenceId}
        )
      `;
    } else if (localeStorageReady) {
      await sql`
        insert into quote_requests (
          category,
          service_type,
          city,
          postal_code,
          customer_address_line1,
          customer_latitude,
          customer_longitude,
          customer_location_source,
          description,
          preferred_date,
          contact_name,
          contact_email,
          contact_phone,
          consent_accepted,
          locale,
          status,
          reference_id
        ) values (
          ${input.category},
          ${input.serviceType},
          ${input.city},
          ${input.postalCode},
          ${customerAddressLine1},
          ${customerLatitude},
          ${customerLongitude},
          ${input.locationSource},
          ${input.description},
          ${input.preferredDate},
          ${input.contactName},
          ${input.contactEmail},
          ${input.contactPhone},
          ${input.consentAccepted},
          ${normalizedLocale},
          'submitted',
          ${referenceId}
        )
      `;
    } else {
      await sql`
        insert into quote_requests (
          category,
          service_type,
          city,
          postal_code,
          customer_address_line1,
          customer_latitude,
          customer_longitude,
          customer_location_source,
          description,
          preferred_date,
          contact_name,
          contact_email,
          contact_phone,
          consent_accepted,
          status,
          reference_id
        ) values (
          ${input.category},
          ${input.serviceType},
          ${input.city},
          ${input.postalCode},
          ${customerAddressLine1},
          ${customerLatitude},
          ${customerLongitude},
          ${input.locationSource},
          ${input.description},
          ${input.preferredDate},
          ${input.contactName},
          ${input.contactEmail},
          ${input.contactPhone},
          ${input.consentAccepted},
          'submitted',
          ${referenceId}
        )
      `;
    }
  } catch (error) {
    console.error("Failed to store Marketplace quote request", {
      referenceId,
      locationSource: input.locationSource,
      error,
    });
    return {
      ok: false,
      message: normalizedLocale === "en"
        ? "The request could not be saved right now. Check DATABASE_URL and that the migration has been run."
        : "Förfrågan kunde inte sparas just nu. Kontrollera DATABASE_URL och att migrationen har körts.",
    };
  }

  return {
    ok: true,
    referenceId,
    created: true,
  };
}
