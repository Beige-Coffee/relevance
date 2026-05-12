"use client";

import type Anthropic from "@anthropic-ai/sdk";
import type { ToolCall, ToolEvent } from "./tools";

// Anthropic-style message: content is either a string (text) or an array of
// content blocks (used when sending back tool_use / tool_result blocks).
export interface ChatTurnMessage {
  role: "user" | "assistant";
  content: string | unknown[];
}

export interface StreamOpts {
  client: Anthropic;
  model: string;
  system: string;
  messages: ChatTurnMessage[];
  tools?: readonly unknown[];
  executeTool?: (call: ToolCall) => Promise<unknown>;
  onDelta: (delta: string) => void;
  onToolEvent?: (event: ToolEvent) => void;
  maxTokens?: number;
  maxIterations?: number;
  signal?: AbortSignal;
}

interface BlockSeen {
  type: string;
  id?: string;
  name?: string;
  inputJson?: string;
}

// Stream a Claude response and call onDelta as text arrives. If tools are
// provided, recursively handle tool_use → tool_result rounds up to
// maxIterations times before forcing a final answer.
/**
 * Anthropic's SDK throws `APIConnectionError` with the bare message
 * "Connection error." for any fetch-level failure, hiding the real reason
 * (CORS, TLS, missing host, malformed stream chunk, etc.) inside `.cause`.
 * This drills down to surface something the user can actually act on.
 */
export function describeError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (!(e instanceof Error)) return String(e);

  const parts: string[] = [];
  parts.push(e.message);
  // Walk the .cause chain so the real underlying error surfaces.
  let cause: unknown = (e as { cause?: unknown }).cause;
  let safety = 0;
  while (cause && safety < 5) {
    safety++;
    if (cause instanceof Error) {
      if (cause.message && !parts.includes(cause.message)) {
        parts.push(cause.message);
      }
      cause = (cause as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  // Anthropic SDK APIError exposes status + error fields.
  const status = (e as { status?: number }).status;
  if (status) parts.unshift(`HTTP ${status}`);
  return parts.join(" · ");
}

export async function streamText(opts: StreamOpts): Promise<string> {
  const {
    client,
    model,
    system,
    messages,
    tools,
    executeTool,
    onDelta,
    onToolEvent,
    maxTokens = 2048,
    maxIterations = 5,
    signal,
  } = opts;

  // Anthropic's Messages API requires the conversation to start with a user
  // message. Drop any leading assistant turns (e.g., a seeded module opener
  // shown in the UI) so the API doesn't reject the request with a generic
  // "Connection error". We keep them in the UI; they just don't get sent.
  const firstUser = messages.findIndex((m) => m.role === "user");
  const trimmed = firstUser >= 0 ? messages.slice(firstUser) : messages;
  // We mutate this working copy as tool rounds add more turns.
  const working: ChatTurnMessage[] = trimmed.map((m) => ({ ...m }));
  let finalText = "";

  for (let iter = 0; iter < maxIterations; iter++) {
    const blocks: BlockSeen[] = [];

    const stream = client.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        system,
        tools: tools && tools.length ? (tools as unknown as Anthropic.Tool[]) : undefined,
        messages: working as Anthropic.MessageParam[],
      },
      { signal }
    );

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const cb = event.content_block as { type: string; id?: string; name?: string };
        blocks[event.index] = {
          type: cb.type,
          id: cb.type === "tool_use" ? cb.id : undefined,
          name: cb.type === "tool_use" ? cb.name : undefined,
          inputJson: cb.type === "tool_use" ? "" : undefined,
        };
      } else if (event.type === "content_block_delta") {
        const d = event.delta as { type: string; text?: string; partial_json?: string };
        if (d.type === "text_delta" && d.text) {
          finalText += d.text;
          onDelta(d.text);
        } else if (d.type === "input_json_delta" && d.partial_json) {
          const b = blocks[event.index];
          if (b && b.type === "tool_use") {
            b.inputJson = (b.inputJson ?? "") + d.partial_json;
          }
        }
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use" || !executeTool) {
      return finalText;
    }

    // Pull the tool_use blocks out of the final message and execute them.
    const toolUseBlocks = (final.content as unknown[]).filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        typeof b === "object" && b !== null && (b as { type?: string }).type === "tool_use"
    );

    const toolResultBlocks: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }> = [];

    for (const tu of toolUseBlocks) {
      onToolEvent?.({ kind: "start", id: tu.id, name: tu.name, input: tu.input });
      const result = await executeTool({ id: tu.id, name: tu.name, input: tu.input });
      const isCached = Boolean(
        result && typeof result === "object" && (result as { _cached?: boolean })._cached
      );
      onToolEvent?.({
        kind: "done",
        id: tu.id,
        name: tu.name,
        input: tu.input,
        result,
        cached: isCached,
      });
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }

    // Append the assistant turn (which included tool_use blocks) and a
    // user turn carrying the tool_result blocks. Then loop.
    working.push({ role: "assistant", content: final.content as unknown[] });
    working.push({ role: "user", content: toolResultBlocks });
  }

  return finalText;
}
