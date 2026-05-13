// Streaming proxy to OpenRouter's Anthropic-compat Messages API.
//
// Temporary "shared key" mode. The Anthropic SDK on the client is pointed
// at /api as its baseURL (which means it POSTs here at /api/v1/messages),
// and this route adds the OPENROUTER_API_KEY env var as the bearer token
// before forwarding to OpenRouter. The key never reaches the browser.
//
// To turn the shared key off: delete OPENROUTER_API_KEY from the Vercel
// project's Environment Variables and redeploy. This route will return
// HTTP 503 with a message that prompts the user to add their own key on
// the Settings page.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          message:
            "Shared key not configured. Add your own API key on the Settings page to continue.",
        },
      },
      { status: 503 },
    );
  }

  // Forward the raw body and the streaming SSE response back to the browser.
  const body = await req.text();
  const upstream = await fetch("https://openrouter.ai/api/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": req.headers.get("origin") ?? "",
      "X-Title": "relevance (shared)",
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-store",
    },
  });
}
