import { Suspense } from "react";
import { ChatGPTConnect } from "@/components/chatgpt-connect";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  return (
    <ChatGPTConnect
      request={{
        client_id: p.client_id || "",
        redirect_uri: p.redirect_uri || "",
        state: p.state || "",
        response_type: p.response_type || "code",
      }}
    />
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <Suspense fallback={<p>Loading connection…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
