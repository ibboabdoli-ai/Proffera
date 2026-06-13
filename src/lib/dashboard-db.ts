import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
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

export type DashboardBooking = {
  id: string;
  time: string;
  title: string;
  customer: string;
  status: string;
  city: string;
  service: string;
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

  try {
    const rows = await sql`
      select
        (select count(*) from customers where workspace_id = 'default') as customers_count,
        (select count(*) from customers where workspace_id = 'default' and status = 'active') as active_customers_count,
        (select count(*) from bookings where workspace_id = 'default') as bookings_count,
        (select count(*) from bookings where workspace_id = 'default' and status = 'confirmed') as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id = 'default') as customer_events_count
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
      where workspace_id = 'default'
      order by created_at desc
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

export async function getDashboardBookings(): Promise<DashboardBooking[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

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
      where b.workspace_id = 'default'
      order by b.starts_at asc nulls last, b.created_at desc
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
