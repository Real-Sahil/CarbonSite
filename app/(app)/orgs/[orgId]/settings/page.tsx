import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function SettingsIndexPage({ params }: Props) {
  const { orgId } = await params;
  redirect(`/orgs/${orgId}/settings/operations`);
}
