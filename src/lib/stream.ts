"use client";

import type Anthropic from "@anthropic-ai/sdk";

export interface StreamOpts {
  client: Anthropic;
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

// Stream a Claude response and call onDelta as text arrives. Returns the final text.
export async function streamText(opts: StreamOpts): Promise<string> {
  const { client, model, system, messages, maxTokens = 2048, onDelta, signal } = opts;
  const stream = client.messages.stream(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages,
    },
    { signal }
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      onDelta(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  const text = final.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("");
  return text;
}
