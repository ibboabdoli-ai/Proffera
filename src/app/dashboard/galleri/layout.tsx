import { DashboardModuleGuard } from "@/components/dashboard/dashboard-module-guard";

export default function GalleryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardModuleGuard featureKey="media_gallery" moduleName="Media och galleri">{children}</DashboardModuleGuard>;
}
