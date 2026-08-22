import { getSql } from "@/lib/db/server";
import type { VerifiedCustomerAddress } from "@/lib/lantmateriet-address-verification";
import type { QuoteRequestInput } from "./schema";

type StoreQuoteRequestResult =
  | {
      ok: true;
      referenceId: string;
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
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export async function storeQuoteRequest(
  input: QuoteRequestInput,
  verifiedAddress?: VerifiedCustomerAddress,
): Promise<StoreQuoteRequestResult> {
  const sql = getSql();

  if (!sql) {
    return {
      ok: false,
      message: "Databasen är inte konfigurerad ännu. Lägg till DATABASE_URL i Vercel och kör databasmigrationen.",
    };
  }

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
      return { ok: true, referenceId: recentReferenceId };
    }

    let verifiedLatitude: number | null = null;
    let verifiedLongitude: number | null = null;
    let verifiedStorageReady = false;

    if (input.locationSource === "address" && verifiedAddress) {
      if (!validVerifiedReference(verifiedAddress.referenceId)) {
        throw new Error("Invalid Lantmäteriet verified-address reference");
      }

      // Rollout follow-up: after migration 0059 is confirmed in Production, remove this
      // runtime schema probe and the legacy insert branch below in a dedicated cleanup PR.
      const readinessRows = await sql`
        select count(*) = 5 as ready
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'quote_requests'
          and column_name in (
            'customer_verified_latitude',
            'customer_verified_longitude',
            'customer_location_verification_source',
            'customer_location_verification_reference',
            'customer_location_verified_at'
          )
      `;
      verifiedStorageReady = Boolean(readinessRows[0]?.ready);

      if (verifiedStorageReady) {
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
    }

    if (verifiedStorageReady && verifiedAddress && verifiedLatitude !== null && verifiedLongitude !== null) {
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
      message: "Förfrågan kunde inte sparas just nu. Kontrollera DATABASE_URL och att migrationen har körts.",
    };
  }

  return {
    ok: true,
    referenceId,
  };
}
