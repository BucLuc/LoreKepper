import {
  adminClient,
  bridgeUser,
  check,
  bridgeFailure,
  bridgeHeaders,
} from "@/lib/bridge-server";
export async function GET(req: Request) {
  try {
    const db = adminClient(),
      user = await bridgeUser(req, db);
    const sessions = check(
      await db
        .from("adventures")
        .select("id,title,status,revision,created_at")
        .eq("owner_id", user)
        .eq("ai_mode", "chatgpt")
        .order("created_at", { ascending: false })
        .limit(20),
    );
    return Response.json({ sessions }, { headers: bridgeHeaders });
  } catch (e) {
    return bridgeFailure(e);
  }
}
