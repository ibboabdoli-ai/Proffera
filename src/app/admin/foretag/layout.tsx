import { requireAdminArea } from "@/lib/admin-authorization";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminArea("company");
  return children;
}
