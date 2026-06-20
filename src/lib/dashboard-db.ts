import "server-only";

import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "default";

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    return LEGACY_WORKSPACE_ID;
  }

  return access.workspaceId;
}

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return numberValue;
}

function toDateText(value: unknown) {
  if (!value) {
    return "Ej bokad";
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Ej bokad";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toNullableText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export type DashboardStats = {
  customersCount: number;
  activeCustomersCount: number;
  bookingsCount: number;
  confirmedBookingsCount: number;
  customerEventsCount: number;
};

export type DashboardCustomer = {
  id: string;
  name: string;
  type: string;
  city: string;
  status: string;
  service: string;
  notes: string;
};

export type DashboardCustomerOption = {
  id: string;
  name: string;
  city: string;
  status: string;
  service: string;
};

export type DashboardCustomerProfile = DashboardCustomer & {
  email: string;
  phone: string;
  companyName: string;
  source: string;
  createdAt: string;
};

export type DashboardBooking = {
  id: string;
  time: string;
  title: string;
  customer: string;
  status: string;
  city: string;
  service: string;
};

export type DashboardBookingProfile = DashboardBooking & {
  customerId: string;
  endsAt: string;
  source: string;
  notes: string;
  createdAt: string;
};

export type DashboardCustomerEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
};

export type DashboardCustomerDetail = {
  customer: DashboardCustomerProfile;
  bookings: DashboardBooking[];
  events: DashboardCustomerEvent[];
};

export type DashboardBookingDetail = {
  booking: DashboardBookingProfile;
  customer: DashboardCustomerProfile | null;
  events: DashboardCustomerEvent[];
};

export type CreateDashboardCustomerInput = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  customerType: "private" | "company";
  city: string;
  status: "prospect" | "active" | "paused" | "lost";
  serviceCategorySlug: string;
  serviceSlug: string;
  notes: string;
};

export type CreateDashboardBookingInput = {
  customerId: string;
  title: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  startsAt: string;
  endsAt: string;
  city: string;
  service: string;
  serviceCategorySlug: string;
  serviceSlug: string;
  notes: string;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const sql = getSqlClient();

  const fallbackStats: DashboardStats = {
    customersCount: 0,
    activeCustomersCount: 0,
    bookingsCount: 0,
    confirmedBookingsCount: 0,
    customerEventsCount: 0,
  };

  if (!sql) {
    return fallbackStats;
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      select
        (select count(*) from customers where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})) as customers_count,
        (select count(*) from customers where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID}) and status = 'active') as active_customers_count,
        (select count(*) from bookings where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})) as bookings_count,
        (select count(*) from bookings where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID}) and status = 'confirmed') as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})) as customer_events_count
    `;

    const row = rows[0] ?? {};

    return {
      customersCount: toNumber(row.customers_count),
      activeCustomersCount: toNumber(row.active_customers_count),
      bookingsCount: toNumber(row.bookings_count),
      confirmedBookingsCount: toNumber(row.confirmed_bookings_count),
      customerEventsCount: toNumber(row.customer_events_count),
    };
  } catch (error) {
    console.error("Failed to read dashboard stats", error);
    return fallbackStats;
  }
}

export async function getDashboardCustomers(): Promise<DashboardCustomer[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      select
        id,
        name,
        customer_type,
        city,
        status,
        primary_service_slug,
        notes
      from customers
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
      order by case when workspace_id = ${workspaceId} then 0 else 1 end, created_at desc
      limit 20
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      name: toText(row.name, "Namnlös kund"),
      type: toText(row.customer_type) === "company" ? "Företag" : "Privatkund",
      city: toText(row.city, "Okänd ort"),
      status: toText(row.status, "prospect"),
      service: toText(row.primary_service_slug, "Ej valt"),
      notes: toText(row.notes, "Ingen notering"),
    }));
  } catch (error) {
    console.error("Failed to read dashboard customers", error);
    return [];
  }
}

export async function getDashboardCustomerOptions(): Promise<DashboardCustomerOption[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      select
        id,
        name,
        city,
        status,
        primary_service_slug
      from customers
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
      order by case when workspace_id = ${workspaceId} then 0 else 1 end, created_at desc
      limit 50
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      name: toText(row.name, "Namnlös kund"),
      city: toText(row.city, "Okänd ort"),
      status: toText(row.status, "prospect"),
      service: toText(row.primary_service_slug, "Ej valt"),
    }));
  } catch (error) {
    console.error("Failed to read dashboard customer options", error);
    return [];
  }
}

export async function getDashboardBookings(): Promise<DashboardBooking[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        c.name as customer_name
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
      order by case when b.workspace_id = ${workspaceId} then 0 else 1 end, b.starts_at asc nulls last, b.created_at desc
      limit 20
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      time: toDateText(row.starts_at),
      title: toText(row.title, "Namnlös bokning"),
      customer: toText(row.customer_name, "Okänd kund"),
      status: toText(row.status, "requested"),
      city: toText(row.city, "Okänd ort"),
      service: toText(row.service, "Ej vald tjänst"),
    }));
  } catch (error) {
    console.error("Failed to read dashboard bookings", error);
    return [];
  }
}

export async function createDashboardCustomer(input: CreateDashboardCustomerInput): Promise<string> {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for dashboard customer creation");
  }

  const workspaceId = await getActiveWorkspaceId();

  const rows = await sql`
    insert into customers (
      workspace_id,
      name,
      email,
      phone,
      company_name,
      customer_type,
      city,
      status,
      source,
      primary_service_category_slug,
      primary_service_slug,
      notes
    )
    values (
      ${workspaceId},
      ${input.name.trim()},
      ${toNullableText(input.email)},
      ${toNullableText(input.phone)},
      ${toNullableText(input.companyName)},
      ${input.customerType},
      ${toNullableText(input.city)},
      ${input.status},
      'dashboard_manual',
      ${toNullableText(input.serviceCategorySlug)},
      ${toNullableText(input.serviceSlug)},
      ${toNullableText(input.notes)}
    )
    returning id
  `;

  const customerId = toText(rows[0]?.id);

  if (!customerId) {
    throw new Error("Customer creation did not return an id");
  }

  return customerId;
}

export async function createDashboardBooking(input: CreateDashboardBookingInput): Promise<string> {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for dashboard booking creation");
  }

  const workspaceId = await getActiveWorkspaceId();

  const customerRows = await sql`
    select id
    from customers
    where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
      and id = ${input.customerId}
    limit 1
  `;

  const customerId = toText(customerRows[0]?.id);

  if (!customerId) {
    throw new Error("Selected customer does not exist");
  }

  const rows = await sql`
    insert into bookings (
      workspace_id,
      customer_id,
      title,
      service,
      service_category_slug,
      service_slug,
      city,
      status,
      starts_at,
      ends_at,
      source,
      notes
    )
    values (
      ${workspaceId},
      ${customerId},
      ${input.title.trim()},
      ${toNullableText(input.service)},
      ${toNullableText(input.serviceCategorySlug)},
      ${toNullableText(input.serviceSlug)},
      ${toNullableText(input.city)},
      ${input.status},
      ${input.startsAt}::timestamptz,
      ${input.endsAt}::timestamptz,
      'dashboard_manual',
      ${toNullableText(input.notes)}
    )
    returning id
  `;

  const bookingId = toText(rows[0]?.id);

  if (!bookingId) {
    throw new Error("Booking creation did not return an id");
  }

  await sql`
    update customers
    set status = 'active',
        updated_at = now()
    where id = ${customerId}
      and workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
      and status = 'prospect'
  `;

  return bookingId;
}

export async function getDashboardCustomerDetail(customerId: string): Promise<DashboardCustomerDetail | null> {
  const sql = getSqlClient();

  if (!sql) {
    return null;
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const customerRows = await sql`
      select
        id,
        name,
        email,
        phone,
        company_name,
        customer_type,
        city,
        status,
        source,
        primary_service_slug,
        notes,
        created_at
      from customers
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and id = ${customerId}
      limit 1
    `;

    const customerRow = customerRows[0];

    if (!customerRow) {
      return null;
    }

    const bookingRows = await sql`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        c.name as customer_name
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and b.customer_id = ${customerId}
      order by b.starts_at asc nulls last, b.created_at desc
      limit 20
    `;

    const eventRows = await sql`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and customer_id = ${customerId}
      order by case when workspace_id = ${workspaceId} then 0 else 1 end, created_at desc
      limit 20
    `;

    return {
      customer: {
        id: toText(customerRow.id),
        name: toText(customerRow.name, "Namnlös kund"),
        type: toText(customerRow.customer_type) === "company" ? "Företag" : "Privatkund",
        city: toText(customerRow.city, "Okänd ort"),
        status: toText(customerRow.status, "prospect"),
        service: toText(customerRow.primary_service_slug, "Ej valt"),
        notes: toText(customerRow.notes, "Ingen notering"),
        email: toText(customerRow.email, "Ingen e-post"),
        phone: toText(customerRow.phone, "Inget telefonnummer"),
        companyName: toText(customerRow.company_name, "Ej företag"),
        source: toText(customerRow.source, "Okänd källa"),
        createdAt: toDateText(customerRow.created_at),
      },
      bookings: bookingRows.map((row) => ({
        id: toText(row.id),
        time: toDateText(row.starts_at),
        title: toText(row.title, "Namnlös bokning"),
        customer: toText(row.customer_name, "Okänd kund"),
        status: toText(row.status, "requested"),
        city: toText(row.city, "Okänd ort"),
        service: toText(row.service, "Ej vald tjänst"),
      })),
      events: eventRows.map((row) => ({
        id: toText(row.id),
        type: toText(row.event_type, "note"),
        title: toText(row.title, "Namnlös händelse"),
        description: toText(row.description, "Ingen beskrivning"),
        createdAt: toDateText(row.created_at),
      })),
    };
  } catch (error) {
    console.error("Failed to read dashboard customer detail", error);
    return null;
  }
}

export async function getDashboardBookingDetail(bookingId: string): Promise<DashboardBookingDetail | null> {
  const sql = getSqlClient();

  if (!sql) {
    return null;
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const bookingRows = await sql`
      select
        b.id,
        b.customer_id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        b.ends_at,
        b.source,
        b.notes,
        b.created_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name as customer_company_name,
        c.customer_type,
        c.city as customer_city,
        c.status as customer_status,
        c.source as customer_source,
        c.primary_service_slug as customer_service_slug,
        c.notes as customer_notes,
        c.created_at as customer_created_at
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and b.id = ${bookingId}
      limit 1
    `;

    const bookingRow = bookingRows[0];

    if (!bookingRow) {
      return null;
    }

    const eventRows = await sql`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and booking_id = ${bookingId}
      order by case when workspace_id = ${workspaceId} then 0 else 1 end, created_at desc
      limit 20
    `;

    const customerId = toText(bookingRow.customer_id);

    return {
      booking: {
        id: toText(bookingRow.id),
        time: toDateText(bookingRow.starts_at),
        title: toText(bookingRow.title, "Namnlös bokning"),
        customer: toText(bookingRow.customer_name, "Okänd kund"),
        status: toText(bookingRow.status, "requested"),
        city: toText(bookingRow.city, "Okänd ort"),
        service: toText(bookingRow.service, "Ej vald tjänst"),
        customerId,
        endsAt: toDateText(bookingRow.ends_at),
        source: toText(bookingRow.source, "Okänd källa"),
        notes: toText(bookingRow.notes, "Ingen notering"),
        createdAt: toDateText(bookingRow.created_at),
      },
      customer: customerId
        ? {
            id: customerId,
            name: toText(bookingRow.customer_name, "Namnlös kund"),
            type: toText(bookingRow.customer_type) === "company" ? "Företag" : "Privatkund",
            city: toText(bookingRow.customer_city, "Okänd ort"),
            status: toText(bookingRow.customer_status, "prospect"),
            service: toText(bookingRow.customer_service_slug, "Ej valt"),
            notes: toText(bookingRow.customer_notes, "Ingen notering"),
            email: toText(bookingRow.customer_email, "Ingen e-post"),
            phone: toText(bookingRow.customer_phone, "Inget telefonnummer"),
            companyName: toText(bookingRow.customer_company_name, "Ej företag"),
            source: toText(bookingRow.customer_source, "Okänd källa"),
            createdAt: toDateText(bookingRow.customer_created_at),
          }
        : null,
      events: eventRows.map((row) => ({
        id: toText(row.id),
        type: toText(row.event_type, "note"),
        title: toText(row.title, "Namnlös händelse"),
        description: toText(row.description, "Ingen beskrivning"),
        createdAt: toDateText(row.created_at),
      })),
    };
  } catch (error) {
    console.error("Failed to read dashboard booking detail", error);
    return null;
  }
}
