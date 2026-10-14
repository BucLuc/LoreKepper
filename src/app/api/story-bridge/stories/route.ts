import { canonicalPayload } from "@/lib/handoff";
import {
  adminClient,
  bridgeUser,
  bridgeFailure,
  bridgeHeaders,
  readBody,
  check,
  hash,
  BridgeError,
} from "@/lib/bridge-server";
import { presetDesign } from "@/lib/edition-design";
export async function POST(req: Request) {
  try {
    const db = adminClient(),
      user = await bridgeUser(req, db),
      b = JSON.parse(await readBody(req));
    if (
      typeof b.requestId !== "string" ||
      !b.requestId.trim() ||
      b.requestId.length > 100 ||
      typeof b.markdown !== "string" ||
      !b.markdown.trim() ||
      b.markdown.length > 75000 ||
      typeof b.title !== "string" ||
      !b.title.trim() ||
      b.title.length > 120 ||
      typeof b.world !== "string" ||
      b.world.length > 6000 ||
      typeof b.summary !== "string" ||
      b.summary.length > 12000
    )
      throw new BridgeError(
        "Provide a requestId, title, world, summary and complete Markdown story (up to 75,000 characters).",
      );
    const id = check(
      await db.rpc("import_gpt_story", {
        u: user,
        request_id: b.requestId,
        digest: hash(canonicalPayload(b)),
        story_title: b.title.trim(),
        story_world: b.world,
        memory: b.summary,
        markdown: b.markdown,
        edition: "glorious",
        design: { ...presetDesign("glorious"), showCover: false },
      }),
    );
    return Response.json(
      { sessionId: id, status: "completed", path: `/interactive/${id}` },
      { headers: bridgeHeaders },
    );
  } catch (e) {
    return bridgeFailure(e);
  }
}
