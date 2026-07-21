const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    const type =
      body?.type === "list_request" ? "list_request" : "list_feedback";
    const listName = clean(body?.listName, 160);
    const message = clean(body?.message, 2000);
    const pageUrl = clean(body?.pageUrl, 500);
    if (!listName || !message) return json({ error: "Invalid feedback" }, 400);
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const recipient = Deno.env.get("FEEDBACK_TO_EMAIL");
    const sender = Deno.env.get("FEEDBACK_FROM_EMAIL");
    if (!apiKey || !recipient || !sender)
      return json({ error: "Email is not configured" }, 503);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject:
          type === "list_request"
            ? `[What Looks Good?] New list request: ${listName}`
            : `[What Looks Good?] List feedback: ${listName}`,
        text: [
          `Type: ${type}`,
          `List: ${listName}`,
          pageUrl ? `URL: ${pageUrl}` : "",
          "",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });
    if (!response.ok)
      return json({ error: "Email provider rejected the request" }, 502);
    return json({ sent: true });
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
});

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
