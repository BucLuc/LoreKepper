import { gptActionSchema } from "@/lib/gpt-action-schema";
export async function GET(req: Request) {
  return Response.json(
    gptActionSchema(process.env.LORE_PUBLIC_URL || new URL(req.url).origin),
    { headers: { "Cache-Control": "no-store" } },
  );
}
