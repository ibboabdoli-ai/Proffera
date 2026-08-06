import { requireCompanyAdmin } from "@/lib/admin-authorization";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireCompanyAdmin();
  return children;
}
