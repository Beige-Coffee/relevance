"use client";

import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "openrouter";

export interface ProviderModel {
  id: string;
  label: string;
  description: string;
}

export interface ModelDetails {
  id: string;
  name: string;
  vendor: string;
  inputPerM: number;        // USD per 1M input tokens
  outputPerM: number;       // USD per 1M output tokens
  contextLabel: string;     // e.g. "1M", "200K"
  speedLabel: string;       // human-readable
  capabilities: {
    code: number;           // 0-5
    toolCalls: number;      // 0-5
    reasoning: number;      // 0-5
  };
  description: string;
  recommendedFor?: string;  // short tag shown as a chip
}

// Baseline used for "vs baseline" comparisons in the UI.
export const COMPARISON_BASELINE_ID = "anthropic/claude-sonnet-4.6";

// Estimated cost-per-turn assumes a typical Conversation turn: ~5,000 input
// tokens (retrieved passages + prompt + history) and ~1,000 output tokens.
const TURN_INPUT_TOKENS = 5000;
const TURN_OUTPUT_TOKENS = 1000;

export function estimateCostPerTurn(m: { inputPerM: number; outputPerM: number }): number {
  return (m.inputPerM * TURN_INPUT_TOKENS + m.outputPerM * TURN_OUTPUT_TOKENS) / 1_000_000;
}

// Anthropic native: simple list, no per-card UI (pricing is documented elsewhere).
export const ANTHROPIC_MODELS: ProviderModel[] = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Deepest reasoning, slower, costlier" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced, recommended default" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fast and inexpensive" },
];

// OpenRouter: rich detail. Numbers are best-effort estimates as of early 2026.
// Real prices and speeds vary; users should verify on openrouter.ai.
export const OPENROUTER_MODEL_DETAILS: ModelDetails[] = [
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    inputPerM: 3.0,
    outputPerM: 15.0,
    contextLabel: "200K",
    speedLabel: "Fast",
    capabilities: { code: 5, toolCalls: 5, reasoning: 5 },
    description: "The default workhorse for Sage. Best instruction-following of the lot, excellent at corpus-grounded synthesis, very reliable about citing episodes inline. Start here.",
    recommendedFor: "Recommended default",
  },
  {
    id: "anthropic/claude-opus-4.7",
    name: "Claude Opus 4.7",
    vendor: "Anthropic",
    inputPerM: 15.0,
    outputPerM: 75.0,
    contextLabel: "1M",
    speedLabel: "Moderate",
    capabilities: { code: 5, toolCalls: 5, reasoning: 5 },
    description: "Highest capability ceiling. Notably slower and more expensive than Sonnet. Worth it for hard reasoning, long Conversation sessions where you want the agent to track many threads, or when you want richer responses to ambiguous philosophical prompts.",
    recommendedFor: "Deepest",
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    vendor: "OpenAI",
    inputPerM: 5.0,
    outputPerM: 15.0,
    contextLabel: "400K",
    speedLabel: "Fast",
    capabilities: { code: 5, toolCalls: 5, reasoning: 4 },
    description: "OpenAI's flagship. Strong at code and creative writing. Comparable to Sonnet for Socratic dialogue but tends to be more declarative; you may need to nudge it to keep asking questions.",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    vendor: "Google",
    inputPerM: 1.25,
    outputPerM: 5.0,
    contextLabel: "2M",
    speedLabel: "Very Fast",
    capabilities: { code: 4, toolCalls: 4, reasoning: 4 },
    description: "Best context window in the lineup (2M tokens) and the cheapest high-capability option. Strong at long-document analysis. Slightly weaker at sustained Socratic rhythm than Claude, but the price-to-capability ratio is hard to beat.",
    recommendedFor: "Best value",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    vendor: "Meta",
    inputPerM: 0.4,
    outputPerM: 0.4,
    contextLabel: "128K",
    speedLabel: "Fast",
    capabilities: { code: 3, toolCalls: 3, reasoning: 3 },
    description: "Open-weights, hosted on OpenRouter. Cheapest option by a wide margin. A solid baseline, but it follows Socratic instructions less precisely and the citation behavior is looser. Good for casual exploration.",
    recommendedFor: "Cheapest",
  },
];

export const OPENROUTER_MODELS: ProviderModel[] = OPENROUTER_MODEL_DETAILS.map((m) => ({
  id: m.id,
  label: m.name,
  description: m.description,
}));

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openrouter: "anthropic/claude-sonnet-4.6",
};

export function modelsFor(provider: Provider): ProviderModel[] {
  return provider === "anthropic" ? ANTHROPIC_MODELS : OPENROUTER_MODELS;
}

export function makeAnthropicClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("Anthropic API key required");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export function makeOpenRouterClient(apiKey: string): Anthropic {
  if (!apiKey) throw new Error("OpenRouter API key required");
  return new Anthropic({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "relevance",
    },
  });
}

export function makeClientForProvider(provider: Provider, apiKey: string): Anthropic {
  return provider === "anthropic" ? makeAnthropicClient(apiKey) : makeOpenRouterClient(apiKey);
}

export function makeClient(apiKey: string): Anthropic {
  return makeAnthropicClient(apiKey);
}

export const MODELS = ANTHROPIC_MODELS;
export const DEFAULT_MODEL = DEFAULT_MODELS.anthropic;
