import type { Metadata } from "next";
import { getCustomerPortalPresentation } from "@/lib/customer-portal-language";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  if (process.env.VERCEL_ENV !== "preview") return {};
  const { token } = await params;
  const presentation = await getCustomerPortalPresentation(token);
  if (presentation?.publicBookingSlug !== "makeup-by-maria") return {};
  return {
    title: "Makeup by Maria — Mina bokningar",
    icons: {
      icon: "/demo/makeup-by-maria/assets/maria-favicon.svg",
      apple: "/demo/makeup-by-maria/assets/maria-apple-touch-icon.png",
    },
  };
}
export default function CustomerPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
