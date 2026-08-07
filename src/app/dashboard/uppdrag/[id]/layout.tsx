import type { ReactNode } from "react";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getDashboardServiceJobAttachments } from "@/lib/workspace-service-job-attachments-db";

import { ServiceJobAttachmentManager } from "./attachment-manager";

export default async function ServiceJobDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getUserWorkspaceAccess();
  if (!access.ok) return children;

  const attachments = await getDashboardServiceJobAttachments(id);
  const canManage = canManageWorkspaceSettings(access);

  return (
    <>
      <ServiceJobAttachmentManager jobId={id} attachments={attachments} canManage={canManage} />
      {children}
    </>
  );
}
