import {
  adminClient,
  bridgeUser,
  sessionFor,
  bridgeFailure,
  bridgeHeaders,
} from "@/lib/bridge-server";
import { handoffContext } from "@/lib/handoff";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = adminClient(),
      user = await bridgeUser(req, db),
      { id } = await params;
    const { story, players } = await sessionFor(db, id, user);
    return Response.json(handoffContext(story, players), {
      headers: bridgeHeaders,
    });
  } catch (e) {
    return bridgeFailure(e);
  }
}
