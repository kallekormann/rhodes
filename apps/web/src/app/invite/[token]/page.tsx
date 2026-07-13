import { InviteAcceptView } from "@/views/InviteAcceptView";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptView token={token} />;
}
