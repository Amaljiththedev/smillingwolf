import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/builder/editor";
import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";

export const instant = false;

export default async function SiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/builder");

  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();

  return <Editor site={site} session={session} />;
}
