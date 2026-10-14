import { canonicalPayload } from "@/lib/handoff";
import {
  adminClient,
  bridgeUser,
  sessionFor,
  bridgeFailure,
  bridgeHeaders,
  readBody,
  check,
  hash,
  BridgeError,
} from "@/lib/bridge-server";
import { validateHandoffTurn } from "@/lib/handoff";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = adminClient(),
      user = await bridgeUser(req, db),
      { id } = await params;
    const body = JSON.parse(await readBody(req));
    const { story, players } = await sessionFor(db, id, user);
    // Recognize an exact retry before validating it against the newly advanced turn.
    const old = check(
      await db
        .from("gpt_turn_receipts")
        .select("payload_hash,revision")
        .eq("adventure_id", id)
        .eq("request_id", String(body.requestId || ""))
        .maybeSingle(),
    );
    const digest = hash(canonicalPayload(body));
    if (old) {
      if (old.payload_hash !== digest)
        throw new BridgeError("Request ID belongs to a different scene.", 409);
      return Response.json(
        { revision: old.revision, duplicate: true },
        { headers: bridgeHeaders },
      );
    }
    const turn = validateHandoffTurn(story, players, body);
    const result = check(
      await db.rpc("commit_gpt_turn", {
        a: id,
        u: user,
        r: body.revision,
        request_id: body.requestId,
        digest,
        segment: { ...turn.segment, created: new Date().toISOString() },
        memory: turn.summary,
        ending: body.ending === true,
        story_title: turn.title,
        story_world: turn.world,
      }),
    );
    return Response.json(
      { sessionId: id, ...result },
      { headers: bridgeHeaders },
    );
  } catch (e) {
    return bridgeFailure(e);
  }
}
