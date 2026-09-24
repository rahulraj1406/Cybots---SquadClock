import { notFound, redirect } from "next/navigation";
import { getSquadByInviteCode } from "@/lib/squad";

/**
 * Resolves the invite code before anything streams. loading.tsx wraps
 * this segment's page (and /join) in a Suspense boundary but not this
 * layout, so checking here keeps an unknown code a real HTTP 404.
 * Called later, notFound() arrives after a 200 has already been sent
 * with the skeleton.
 *
 * getSquadByInviteCode is cache()d, so the pages reuse this lookup.
 */
export default async function SquadCodeLayout({
  children,
  params,
}: LayoutProps<"/s/[code]">) {
  const { code: rawCode } = await params;

  // Invite codes are generated lowercase; phones auto-capitalise them.
  const code = rawCode.toLowerCase();
  if (code !== rawCode) redirect(`/s/${code}`);

  if (!(await getSquadByInviteCode(code))) notFound();

  return children;
}
