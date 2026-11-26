import { notFound, redirect } from "next/navigation";
import { PagePreview } from "@/components/builder/page-preview";
import { isDevice } from "@/lib/devices";
import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";

export const instant = false;

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/builder/${encodeURIComponent(id)}/preview`);

  const site = getSite(id);
  if (!site) notFound();

  const { device } = await searchParams;
  return <PagePreview site={site} initialDevice={isDevice(device) ? device : "desktop"} />;
}
