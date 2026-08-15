import PublicBookingPage from "../[slug]/page";

type JuliusPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    booked?: string | string[];
    lang?: string | string[];
    service_id?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default function JuliusBookingPage({ searchParams }: JuliusPageProps) {
  return PublicBookingPage({
    params: Promise.resolve({ slug: "julius-salong" }),
    searchParams,
  });
}
