"use client";

import Anthropic from "@anthropic-ai/sdk";

export function makeClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("API key required");
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Available Anthropic models — kept here so we can update in one place.
export const MODELS = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 — deepest reasoning" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced (recommended)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast, low-cost" },
] as const;

export const DEFAULT_MODEL = "claude-sonnet-4-6";
